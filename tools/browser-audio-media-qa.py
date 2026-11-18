#!/usr/bin/env python3
"""Real Chromium decode, signal, playback and game controls; no human audition."""
import functools,json,threading
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'app/src/main/assets'
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/favicon.ico':
   self.send_response(204);self.end_headers();return
  if self.path=='/__audio_test':
   body=b'''<!doctype html><button id="start">Start audio</button><script src="audio-catalog.js"></script><script src="game-audio.js"></script><script>
window.rows=[];window.ac=new AudioContext();
window.audio=ThornhavenCreateAudio({makeAudio:()=>{const el=new Audio(),source=ac.createMediaElementSource(el),meter=ac.createAnalyser();meter.fftSize=2048;source.connect(meter);meter.connect(ac.destination);rows.push({el,meter});el.addEventListener('error',()=>console.error('media-error:'+el.src));return el;}});
window.inspect=()=>rows.map(({el,meter})=>{const data=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(data);return {src:el.getAttribute('src'),time:el.currentTime,duration:el.duration,volume:el.volume,paused:el.paused,ready:el.readyState,error:el.error&&el.error.code,rms:Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length)};});
setInterval(()=>audio.tick(),100);document.getElementById('start').onclick=()=>{ac.resume();audio.unlock();};
</script>'''
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ASSETS)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
report={'scope':'Real Chromium, not human listening or Android','checks':{}}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=(shutil.which('chromium') or shutil.which('google-chrome')),headless=True,args=['--no-sandbox'])
  page=browser.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(base+'/__audio_test');page.locator('#start').click()
  page.wait_for_function("inspect().some(r=>r.src==='audio/town.ogg'&&r.time>.5&&r.rms>.00001)",timeout=20000)
  report['checks']['town_signal']=page.evaluate('inspect()')
  # All actual packaged OGGs decode in the browser and contain nonzero samples.
  report['decoded']=page.evaluate('''async()=>{const out=[];for(const src of new Set(Object.values(ThornhavenAudioCatalog).map(x=>x.src))){const response=await fetch(src);if(!response.ok)throw Error(src);const data=await ac.decodeAudioData(await response.arrayBuffer());let peak=0;for(let c=0;c<data.numberOfChannels;c++){const channel=data.getChannelData(c);for(let i=0;i<channel.length;i++)peak=Math.max(peak,Math.abs(channel[i]));}if(!(peak>0&&peak<1))throw Error('invalid peak '+src);out.push({src,duration:data.duration,peak});}return out;}''')
  assert len(report['decoded'])==17
  page.wait_for_timeout(3200)
  page.evaluate("audio.setScene('exploration')")
  page.wait_for_function("inspect().some(r=>r.src==='audio/town.ogg'&&!r.paused&&r.volume>.01)&&inspect().some(r=>r.src==='audio/exploration.ogg'&&!r.paused&&r.volume>.01)")
  report['checks']['scene_overlap']=page.evaluate('inspect()')
  page.wait_for_timeout(3400)
  page.wait_for_function("inspect().some(r=>r.src==='audio/exploration.ogg'&&r.rms>.00001)&&inspect().some(r=>r.src==='audio/forest.ogg'&&r.rms>.00001)")
  # Seek near the actual decoded boundary, then observe a second native stream.
  page.evaluate("rows.find(r=>r.el.getAttribute('src')==='audio/exploration.ogg').el.currentTime=rows.find(r=>r.el.getAttribute('src')==='audio/exploration.ogg').el.duration-3.2")
  page.wait_for_function("inspect().filter(r=>r.src==='audio/exploration.ogg'&&!r.paused&&r.volume>.01).length===2")
  report['checks']['loop_overlap']=page.evaluate('inspect()')
  page.wait_for_timeout(3500)
  assert page.evaluate("inspect().filter(r=>r.src==='audio/exploration.ogg'&&!r.paused).length") == 1
  for _ in range(3):
   assert page.evaluate("audio.effect('attack')")
   page.wait_for_timeout(100)
  assert page.evaluate("inspect().filter(r=>r.src==='audio/attack.ogg').some(r=>r.time>0)")
  page.evaluate("audio.set('effects',{volume:0});audio.set('music',{muted:true});audio.set('ambience',{volume:0})")
  assert not page.evaluate("audio.effect('attack')")
  assert page.evaluate('inspect().every(r=>r.paused||r.volume===0)')
  page.evaluate("audio.set('effects',{volume:.75});audio.set('music',{muted:false});audio.set('ambience',{volume:.3});audio.setScene('dungeon')")
  page.wait_for_function("inspect().some(r=>r.src==='audio/tomb.ogg'&&r.time>.3&&r.rms>.00001)")
  page.evaluate('audio.pause()');before=page.evaluate('inspect()');page.wait_for_timeout(600);after=page.evaluate('inspect()')
  assert all(r['paused'] for r in after)
  assert all(abs(a['time']-b['time'])<.05 for a,b in zip(before,after))
  page.evaluate('audio.resume()');page.wait_for_function("inspect().some(r=>r.src==='audio/tomb.ogg'&&!r.paused&&r.rms>.00001)")
  for scene in ['combat','town','dungeon','exploration','combat']:
   page.evaluate('(s)=>audio.setScene(s)',scene);page.wait_for_timeout(120)
   assert page.evaluate('audio.status().loops')<=4
  page.wait_for_timeout(3500)
  assert page.evaluate('audio.status().loops')==2
  assert page.evaluate('audio.status().failed')==[]
  report['checks']['final_playback']=page.evaluate('inspect()')
  report['checks']['repeated_mute_pause_resume_rapid_transitions']=True
  page.evaluate('audio.pause()')
  # Actual game initialization, settings, native-style lifecycle events and reload.
  game=browser.new_page(viewport={'width':412,'height':915})
  game.add_init_script("const NativeAudio=window.Audio;window.__gameMedia=[];window.Audio=function(){const el=new NativeAudio();__gameMedia.push(el);return el;};")
  game.on('pageerror',lambda e:errors.append(str(e)))
  game.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  game.goto(base+'/index.html',wait_until='load');game.wait_for_function("window.ThornhavenAudio&&!document.getElementById('titleMenu').hidden")
  game.locator('#titleSettings').click();game.locator('#audioSettings > summary').click()
  game.wait_for_function('__gameMedia.some(el=>!el.paused&&el.currentTime>.3)')
  game.evaluate("window.dispatchEvent(new Event('pagehide'))")
  assert game.evaluate('__gameMedia.every(el=>el.paused)')
  stopped=game.evaluate('__gameMedia.map(el=>el.currentTime)');game.wait_for_timeout(600)
  assert all(abs(a-b)<.05 for a,b in zip(stopped,game.evaluate('__gameMedia.map(el=>el.currentTime)')))
  game.evaluate("window.dispatchEvent(new Event('pageshow'))")
  game.wait_for_function('(times)=>__gameMedia.some((el,i)=>!el.paused&&el.currentTime>(times[i]||0)+.2)',arg=stopped)
  report['checks']['game_active_media_pagehide_pageshow']=True

  for id,bus in [('soundVolume','effects'),('audio-music','music'),('audio-ambience','ambience')]:
   slider=game.locator('#'+id);assert slider.is_visible();slider.evaluate("el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));}")
   assert game.evaluate('(bus)=>ThornhavenAudio.preferences()[bus].volume',bus)==0
  game.evaluate("window.dispatchEvent(new Event('pagehide'))");assert game.evaluate('ThornhavenAudio.status().paused')
  game.evaluate("window.dispatchEvent(new Event('pageshow'))");assert not game.evaluate('ThornhavenAudio.status().paused')
  game.reload(wait_until='load');game.wait_for_function('window.ThornhavenAudio')
  assert game.evaluate('Object.values(ThornhavenAudio.preferences()).every(p=>p.volume===0)')
  assert game.evaluate('ThornhavenAudio.status().failed')==[]
  assert not errors,errors
  report['checks']['game_controls_lifecycle_persistence']=True;report['console_errors']=errors
  browser.close()
finally:server.shutdown()
(ROOT/'reports').mkdir(exist_ok=True)
(ROOT/'reports/audio-browser-media.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: 17 real Chromium decodes; playback advances with measured output signal; scene/loop crossfades, repeated effects, mutes, pause/resume, rapid transitions and game controls; no console/media failures. Not phone or human audition.')

#!/usr/bin/env python3
"""Chromium geometry/route/render probe; not native Android performance."""
import importlib.util,json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
spec=importlib.util.spec_from_file_location('interactive',Path(__file__).with_name('browser-interactive-qa.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=Path('/tmp/thornhaven-wilderness-browser');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 results=[]
 baseline=browser.new_page()
 baseline_html=m.html_for_browser(Path('app/src/main/assets')).replace('<script>\n'+Path('app/src/main/assets/wilderness-slice.js').read_text()+'\n</script>','').replace("id==='elderwood'?{width:15360,height:9600,ox:7200,oy:4500}:",'')
 baseline_html=baseline_html.replace('<script>\n'+Path('app/src/main/assets/wilderness-activities.js').read_text()+'\n</script>','')
 baseline.set_content(baseline_html,wait_until='domcontentloaded',timeout=60000)
 benchmark="""() => {const start=safeMapPosition('elderwood',480,315,14),target=safeMapPosition('elderwood',-1200,1200,14),times=[];for(let i=0;i<20;i++){const t=performance.now();if(!findWalkingPath('elderwood',start,target,14))throw Error('Core path unavailable');times.push(performance.now()-t);}return {times,cells:walkingGrid('elderwood',14).free.length};}"""
 original=baseline.evaluate(benchmark);baseline.close()
 (out/'baseline-navigation.json').write_text(json.dumps(original,indent=2))
 for width,height in [(915,412),(412,915)]:
  page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(m.html_for_browser(Path('app/src/main/assets')),wait_until='domcontentloaded',timeout=60000)
  page.get_by_role('button',name='Start New Game',exact=False).click();page.get_by_role('button',name='Tap to Continue').click();page.locator('#characterName').fill('WildernessQA');page.get_by_role('button',name='Begin Journey').click()
  core_navigation=page.evaluate(benchmark)
  activity_paths=page.evaluate('''() => {const times=[];for(const radius of [12,14,20])for(const target of [...wildernessActivities.resources,...wildernessActivities.enemies]){const p=safeMapPosition('elderwood',target.x,target.y,radius),t=performance.now(),path=findWalkingPath('elderwood',{x:480,y:315},p,radius);if(!path)throw Error('Activity unreachable');times.push(performance.now()-t);}return times;}''')
  metrics=page.evaluate('''() => {setMap('elderwood',-6200,315,false);player.hp=player.maxHp;const times=[];for(let i=0;i<20;i++){const t=performance.now();const path=findWalkingPath('elderwood',player,{x:-2700,y:-1800},14);if(!path)throw Error('No western loop');times.push(performance.now()-t);}return {times,bounds:worldBounds(),speed:player.speed};}''')
  page.evaluate("keys.add('ArrowRight');window.__startX=player.x;window.__startTime=performance.now()")
  page.wait_for_timeout(3000)
  movement=page.evaluate("() => {keys.clear();return {distance:player.x-window.__startX,seconds:(performance.now()-window.__startTime)/1000};}")
  page.evaluate("setMap('elderwood',-6200,-1400,false);window.revealLocalTerrain();updateCamera();draw()")
  page.screenshot(path=str(out/f'western-lake-{width}.png'))
  assert not errors,errors
  assert movement['distance']>100,movement
  results.append({'viewport':[width,height],'metrics':metrics,'coreNavigation':core_navigation,'activityPaths':activity_paths,'realTimeMovement':movement,'errors':errors})
  page.close()
 browser.close()
 (out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))

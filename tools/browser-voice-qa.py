#!/usr/bin/env python3
"""Actual game DOM with a recording native bridge; not native speech or listening."""
import importlib.util,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('browser_qa',root/'tools/browser-interactive-qa.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
bridge='''<script>window.voiceCalls=[];window.voiceState='ready';window.ThornhavenNativeVoice={status:()=>voiceState,stop:()=>voiceCalls.push({kind:'stop'}),speak:(speakerId,profile,text,volume)=>voiceCalls.push({kind:'speak',speakerId,profile,text,volume})};</script>'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':412,'height':915});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(helper.html_for_browser(root/'app/src/main/assets').replace('<head>','<head>'+bridge,1),wait_until='load')
 page.wait_for_function('window.ThornhavenVoice')
 page.evaluate("leaveTitleMenu();hasStarted=true;player.name='Voice QA';setMap('ashvale',200,200,false)")
 speakers=[("maps.ashvale.npcs.find(n=>/^Tilda\\b/.test(n.name))",'merchant'),("({name:'Edda the Carpenter',dialogueId:'edda'})",'carpenter'),("({name:'Sera',npcStoryId:'npc_sera'})",'courier')]
 coverage=[]
 for expression,profile in speakers:
  page.evaluate('openNpcConversation('+expression+')')
  greeting=page.evaluate('npcConversation.greeting');last=page.evaluate("voiceCalls.filter(c=>c.kind==='speak').at(-1)")
  assert last['text']==greeting and last['profile']==profile
  assert page.locator('.npcGreeting').inner_text()==greeting
  page.evaluate("askNpc('Tell me about yourself')")
  reply=page.evaluate('npcAgentMemory(npcConversation.npc).history.at(-1).reply')
  assert page.evaluate("voiceCalls.filter(c=>c.kind==='speak').at(-1).text")==reply
  coverage.append({'profile':profile,'speaker':last['speakerId'],'greeting':greeting})
 # Generic/companion-style callers own their new utterance after opening a dialog.
 # Await the actual MutationObserver checkpoint, not merely synchronous JS state.
 result=page.evaluate('''async()=>{
  openAdventureDialog('Companion advice','Existing companion-style text.',[]);
  ThornhavenVoice.speak({speakerId:'companion:test',profile:'courier',text:'Existing companion-style text.'});
  const count=voiceCalls.length;await new Promise(resolve=>queueMicrotask(resolve));
  return {before:count,after:voiceCalls.length,last:voiceCalls.at(-1)};
 }''')
 assert result['before']==result['after'] and result['last']['kind']=='speak' and result['last']['speakerId']=='companion:test'
 page.evaluate("closePanel('adventureScreen')");assert page.evaluate('voiceCalls.at(-1).kind')=='stop'
 # Replacing a real NPC dialog still stops its speech immediately.
 page.evaluate("openNpcConversation({name:'Sera',npcStoryId:'npc_sera'});openAdventureDialog('Other panel','Other text.',[])")
 assert page.evaluate('voiceCalls.at(-1).kind')=='stop'
 # Direct class changes cancel the owning NPC, but not a later external request.
 result=page.evaluate('''async()=>{
  openNpcConversation({name:'Sera',npcStoryId:'npc_sera'});
  document.getElementById('adventureScreen').classList.remove('npcTalkView');
  await new Promise(resolve=>queueMicrotask(resolve));return voiceCalls.at(-1).kind;
 }''');assert result=='stop'
 result=page.evaluate('''async()=>{
  openNpcConversation({name:'Sera',npcStoryId:'npc_sera'});
  document.getElementById('adventureScreen').classList.remove('npcTalkView');
  ThornhavenVoice.speak({speakerId:'companion:new',text:'A newer visible reply.'});
  const count=voiceCalls.length;await new Promise(resolve=>queueMicrotask(resolve));
  return {before:count,after:voiceCalls.length,last:voiceCalls.at(-1)};
 }''');assert result['before']==result['after'] and result['last']['speakerId']=='companion:new'
 # Direct hiding cancels even a generic/API-owned utterance.
 result=page.evaluate('''async()=>{
  document.getElementById('adventureScreen').hidden=true;
  await new Promise(resolve=>queueMicrotask(resolve));return voiceCalls.at(-1).kind;
 }''');assert result=='stop'
 page.evaluate("openNpcConversation({name:'Sera',npcStoryId:'npc_sera'})")
 # Rapid replacement reads only new lines, never the accumulated history.
 page.evaluate("askNpc('Any news around here?');askNpc('How are you?')")
 assert page.evaluate("voiceCalls.filter(c=>c.kind==='speak').at(-1).text===npcAgentMemory(npcConversation.npc).history.at(-1).reply")
 page.get_by_role('button',name='Stop voice',exact=True).click();assert page.evaluate('voiceCalls.at(-1).kind')=='stop'
 page.get_by_role('button',name='Replay voice',exact=True).click();assert page.evaluate('voiceCalls.at(-1).kind')=='speak'
 page.evaluate("window.dispatchEvent(new Event('pagehide'))");count=page.evaluate("voiceCalls.filter(c=>c.kind==='speak').length")
 page.evaluate("window.dispatchEvent(new Event('pageshow'))");assert page.evaluate("voiceCalls.filter(c=>c.kind==='speak').length")==count
 page.evaluate("closePanel('adventureScreen')");assert page.evaluate('voiceCalls.at(-1).kind')=='stop'
 page.evaluate("openNpcConversation({name:'Sera',npcStoryId:'npc_sera'});setMap('whisperwood',200,200,false)");assert page.evaluate('voiceCalls.at(-1).kind')=='stop'
 page.evaluate("setMap('ashvale',200,200,false);openNpcConversation({name:'Unvoiced Resident',lines:['Existing text.']})")
 assert page.locator('#npcVoiceControls').count()==0
 page.evaluate("ThornhavenVoice.set({volume:0})");count=page.evaluate("voiceCalls.filter(c=>c.kind==='speak').length")
 page.evaluate("openNpcConversation({name:'Sera',npcStoryId:'npc_sera'})");assert page.evaluate("voiceCalls.filter(c=>c.kind==='speak').length")==count
 page.evaluate("ThornhavenVoice.set({volume:.65,muted:true})");seed=page.evaluate('window.__qaStorage')
 page.close();page=browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 # No bridge: browsers and installations with no voice engine remain text-only.
 page.set_content(helper.html_for_browser(root/'app/src/main/assets',seed),wait_until='load');page.wait_for_function('window.ThornhavenVoice')
 assert page.evaluate('ThornhavenVoice.preferences()')=={'volume':.65,'muted':True}
 assert page.evaluate('ThornhavenVoice.status()')=='unavailable'
 page.locator('#titleSettings').click();page.locator('#audioSettings > summary').click()
 assert page.locator('#voiceVolume').is_visible();assert page.locator('#voiceMute').get_attribute('aria-pressed')=='false'
 assert page.locator('#soundVolume').is_visible() and page.locator('#audio-music').is_visible() and page.locator('#audio-ambience').is_visible()
 page.locator('#voiceVolume').evaluate("el=>{el.value='40';el.dispatchEvent(new Event('input',{bubbles:true}));}")
 assert page.evaluate('ThornhavenVoice.preferences().volume')==.4
 assert not errors,errors
 browser.close()
(root/'reports').mkdir(exist_ok=True);(root/'reports/voice-browser.json').write_text(json.dumps({'scope':'Real Chromium DOM, recording native bridge; no synthesized audio','coverage':coverage,'observer_ownership':{'companion_after_open_survives':True,'npc_replacement_stops':True,'newer_request_survives_class_mutation':True,'hidden_stops_any_owner':True},'errors':errors},indent=2)+'\n')
print('PASS: actual NPC greetings/replies unchanged, three profiles, generation-safe companion/NPC observer ownership, rapid skip, replay/stop, map/close/background cancellation, no stale resume, separate persisted controls and missing-engine text fallback; native bridge mocked')

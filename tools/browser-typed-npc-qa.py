#!/usr/bin/env python3
"""Offline typed NPC QA in the restored game; synthetic state only in tests."""
import argparse,json,re,runpy,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
html_for_browser=runpy.run_path(str(Path(__file__).with_name('browser-interactive-qa.py')))['html_for_browser']

def run(browser,width,height,assets,output):
 page=browser.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
 page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda r:r.abort());page.context.set_offline(True)
 page.set_content(html_for_browser(assets),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click();page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('TypedQA');page.get_by_role('button',name='Begin Journey').click()
 page.evaluate("setMap('ashvale',480,500,false);window.trader=maps.ashvale.npcs.find(n=>n.name==='Tilda the Trader');openNpcConversation(trader)")
 def ask(q):
  page.locator('#typedNpcInput').fill(q);page.locator('#typedNpcForm button[type=submit]').click()
  return page.locator('#typedNpcReply').inner_text()
 assert page.locator('#npcChatForm').count()==0
 page.locator('#adventureScreen .screenClose').focus();page.keyboard.press('Shift+Tab')
 assert page.evaluate('document.activeElement.textContent')=='Goodbye'
 page.keyboard.press('Tab');assert page.evaluate('document.activeElement.classList.contains("screenClose")')

 assert 'not generative AI' in page.locator('#adventureScreen .screenFoot').inner_text()
 page.evaluate("window.speech=[];window.ThornhavenVoice={stop(){speech.push({stop:true})},speak(p){speech.push({...p,visible:document.getElementById('typedNpcReply').textContent.includes(p.text)})}}")
 assert 'father taught me' in ask('Who are you?')
 assert 'Browse the shop' in ask('What services do you offer?')
 assert 'do not have an active task' in ask('What should I do next?')
 assert 'Ask about me' in ask('Who are you and what is my progress?')
 assert 'Ask about me' in ask('How do I defeat the unknown emperor?')
 assert 'Ask about me' in ask('<img src=x onerror=window.injected=1>')
 assert page.locator('#typedNpcReply img').count()==0 and not page.evaluate('Boolean(window.injected)')
 before=page.locator('#typedNpcReply').inner_text();page.locator('#typedNpcInput').fill('   ');page.locator('#typedNpcForm button[type=submit]').click()
 assert 'Type a question' in page.locator('#typedNpcFeedback').inner_text() and page.locator('#typedNpcReply').inner_text()==before
 page.evaluate("document.getElementById('typedNpcInput').value='x'.repeat(181);document.getElementById('typedNpcForm').requestSubmit()")
 assert '180 characters' in page.locator('#typedNpcFeedback').inner_text()
 # Composition Enter must not submit; final ordinary Enter submits exactly once.
 page.locator('#typedNpcInput').fill('Who are you?')
 page.evaluate("document.getElementById('typedNpcInput').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));window.speechBefore=speech.length;document.getElementById('typedNpcInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));document.getElementById('typedNpcForm').requestSubmit()")
 assert page.evaluate('speech.length===speechBefore')
 page.evaluate("document.getElementById('typedNpcInput').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))")
 page.locator('#typedNpcInput').press('Enter');assert 'father taught me' in page.locator('#typedNpcReply').inner_text()
 assert page.evaluate('document.activeElement.id')=='typedNpcInput'
 for _ in range(3):assert 'father taught me' in ask('Who are you?')
 assert page.locator('#typedNpcReply').count()==1
 assert page.evaluate("speech.filter(x=>x.text).every(x=>x.visible&&x.speakerId==='npc:'+npcAgentKey(trader)&&!x.text.includes('Offline authored'))")
 # Known NPC-specific objective; an unrelated trader cannot narrate it.
 page.evaluate("window.giver=maps.ashvale.npcs.find(n=>n.questId==='ashvale_watch');townQuestState.recruit_dalen={accepted:true,kills:2,claimed:true};townQuestState.ashvale_watch={accepted:true,kills:0,claimed:false};openNpcConversation(giver)")
 assert 'Kills 0/' in ask('How is my progress?')
 page.evaluate("townQuestState.ashvale_watch.kills=townQuestDefs.ashvale_watch.target;addItem(townQuestDefs.ashvale_watch.drop,townQuestDefs.ashvale_watch.dropTarget)")
 assert 'Return to' in ask('What should I do next?')
 page.evaluate("townQuestState._journal.paused.ashvale_watch=true")
 assert 'do not have an active task' in ask('Any advice?')
 page.evaluate("delete townQuestState._journal.paused.ashvale_watch;townQuestState.ashvale_watch.claimed=true")
 assert 'do not have an active task' in ask('Any advice?')
 # Unsupported questions must not read hidden confidence or global quest lore.
 assert 'Ask about me' in ask('Tell me your secret about Ada')
 page.evaluate('openNpcConversation(trader)')
 assert 'do not have an active task' in ask('What should I do next?')
 # Existing preset and service UI remain usable. Service opens the actual shop.
 page.locator('#adventureChoices').get_by_role('button',name='Tell me about yourself',exact=True).click()
 assert page.locator('#typedNpcInput').count()==1
 assert 'father taught me' in page.locator('.npcChatHistory').inner_text()
 page.locator('#adventureChoices').get_by_role('button',name='Browse the shop',exact=True).click()
 assert page.locator('#shopScreen').is_visible() and page.locator('#typedNpcForm').count()==0
 page.evaluate('openNpcConversation(trader)')
 # Tiny landscape viewport approximates soft-keyboard resizing; controls and
 # scroll panes must remain reachable, without auto-opening the keyboard.
 page.set_viewport_size({'width':width,'height':300})
 page.locator('#typedNpcInput').scroll_into_view_if_needed()
 box=page.locator('#typedNpcInput').bounding_box();assert box and box['height']>=44 and box['y']>=0 and box['y']+box['height']<=300,box
 assert 'father taught me' in ask('Who are you?')
 page.set_viewport_size({'width':width,'height':height})
 # Snapshot stability: typed questions do not write history/trust or progression.
 page.evaluate('journalActiveRows();window.beforeTyped=JSON.stringify(snapshotGameState())')
 ask('Who are you?');ask('Any advice?')
 assert page.evaluate('JSON.stringify(snapshotGameState())===beforeTyped')
 # Stale detached submissions, replaced NPC, map/character switch, no voice.
 page.evaluate("window.staleForm=document.getElementById('typedNpcForm');openNpcConversation(giver);staleForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
 assert page.locator('#typedNpcReply').count()==0
 assert 'Reeve' in page.locator('#adventureTitle').inner_text()
 page.evaluate("window.oldSlot=activeSlotId;activeSlotId='other';document.getElementById('typedNpcInput').value='Who are you?';document.getElementById('typedNpcForm').requestSubmit();activeSlotId=oldSlot")
 assert page.locator('#typedNpcReply').count()==0
 page.evaluate("window.oldMap=mapId;mapId='redfen';document.getElementById('typedNpcForm').requestSubmit();mapId=oldMap")
 assert page.locator('#typedNpcReply').count()==0
 for implementation in ['undefined',"{speak(){throw Error('speech')},stop(){throw Error('stop')}}","{speak(){return Promise.reject(Error('speech'))},stop(){return Promise.reject(Error('stop'))}}"]:
  page.evaluate('window.ThornhavenVoice='+implementation);page.evaluate('openNpcConversation(trader)');assert 'father taught me' in ask('Who are you?')
 page.evaluate("openAdventureDialog('Other story','Narrator remains unchanged',[])")
 assert page.locator('#typedNpcForm').count()==0 and not page.locator('#adventureScreen').evaluate("e=>e.classList.contains('typedNpcView')")
 assert page.locator('#adventureText').inner_text()=='Narrator remains unchanged'
 assert 'Offline authored' not in page.locator('#adventureScreen .screenFoot').inner_text()
 page.evaluate('openNpcConversation(trader)');page.locator('#typedNpcInput').focus();page.keyboard.press('Escape')
 assert page.locator('#adventureScreen').is_hidden()
 page.evaluate('openNpcConversation(trader)');ask('Who are you?')
 out=output;out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/f'npc-{width}x{height}.png'))
 page.evaluate("closePanel('adventureScreen');saveGame()")
 assert page.evaluate("ThornhavenCloudSaveCore.parse(ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId)).slots[activeSlotId].state.player.name==='TypedQA'")
 seed=page.evaluate('window.__qaStorage')
 resumed=browser.new_page(viewport={'width':width,'height':height});resumed.route('**/*',lambda r:r.abort());resumed.context.set_offline(True)
 resumed.on('pageerror',lambda e:errors.append(str(e)))
 resumed.set_content(html_for_browser(assets,seed),wait_until='domcontentloaded',timeout=60000);resumed.locator('#titleContinue').click()
 resumed.evaluate("openNpcConversation(maps.ashvale.npcs.find(n=>n.name==='Tilda the Trader'))")
 assert resumed.locator('#typedNpcReply').count()==0
 assert resumed.evaluate('townQuestState.ashvale_watch.claimed') is True
 resumed.close()
 assert not errors,errors
 page.close();return {'viewport':[width,height],'result':'PASS','pageErrors':errors}

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--assets',type=Path,default=Path('app/src/main/assets'))
parser.add_argument('--evidence-dir',type=Path,default=Path('reports/browser-typed-npc-qa'))
args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 results=[run(b,w,h,args.assets,args.evidence_dir) for w,h in [(412,915),(915,412)]];b.close()
 (args.evidence_dir/'result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))

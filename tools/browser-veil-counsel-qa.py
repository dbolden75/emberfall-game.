#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/veil-counsel'
OUT.mkdir(parents=True,exist_ok=True)

def new_page(browser,width,height):
 page=browser.new_page(viewport={'width':width,'height':height})
 def asset(route):
  path=ROOT/'app/src/main/assets'/route.request.url.split('thornhaven.test/',1)[1]
  if path.is_file():route.fulfill(path=str(path))
  else:route.abort()
 page.route('http://thornhaven.test/**',asset)
 return page

def markup(seed=None):
 return html_for_browser(ROOT/'app/src/main/assets',seed).replace('<head>','<head><base href="http://thornhaven.test/">',1)

def run(browser,orientation,width,height):
 page=new_page(browser,width,height)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click()
 page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('CounselQA'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 assert page.evaluate("!questCatalog().some(q=>q.id==='veil_counsel')")
 # Explicit QA seed, never a production unlock or persisted developer override.
 page.evaluate("() => {townQuestState._lastLanternAccess={revealed:true};townQuestState.last_lantern={claimed:true,bell:true,register:true,inventory:true};companions=[];}")
 def talk(who):
  page.evaluate("who=>{const n=maps.veilhaven.npcs.find(n=>n.vampireId===who);setMap('veilhaven',n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}",who)
  page.locator('#attack').click()
 talk('mirelle')
 page.get_by_role('button',name='Review the secured evidence',exact=True).click()
 page.get_by_role('button',name='Hear this resident’s position',exact=True).click()
 page.get_by_role('button',name='Hear Mirelle of the Night Clinic’s proposal',exact=True).click()
 page.wait_for_timeout(350)
 page.screenshot(path=str(OUT/f'{orientation}-mirelle.png'))
 page.get_by_role('button',name='Consider the other residents',exact=True).click()
 partial=page.evaluate('window.__qaStorage')
 for who,name in [('orven','Orven the Deserter'),('vaelis','Vaelis the Witness')]:
  talk(who)
  page.get_by_role('button',name='Hear '+name+'’s proposal',exact=True).click()
  page.get_by_role('button',name='Continue the discussion',exact=True).click()
  if who=='orven':page.get_by_role('button',name='Leave',exact=True).click()
 page.wait_for_timeout(350)
 page.screenshot(path=str(OUT/f'{orientation}-decision.png'))
 page.get_by_role('button',name='Prepare a witness ledger',exact=True).click()
 page.evaluate("pauseJournalQuest('veil_counsel')")
 page.get_by_role('button',name='Confirm this recommendation',exact=True).click()
 assert page.evaluate('!townQuestState.veil_counsel.choice')
 talk('vaelis')
 assert page.get_by_role('button',name='Prepare a witness ledger',exact=True).count()==0
 page.wait_for_timeout(350);page.screenshot(path=str(OUT/f'{orientation}-paused.png'))
 page.get_by_role('button',name='Other matters',exact=True).click()
 assert page.evaluate("npcConversation.npc.vampireId==='vaelis'")
 page.locator('#adventureScreen .screenClose').click()
 page.evaluate("resumeJournalQuest('veil_counsel')")
 talk('vaelis')
 page.get_by_role('button',name='Prepare a witness ledger',exact=True).click()
 page.get_by_role('button',name='Confirm this recommendation',exact=True).click()
 assert page.evaluate("townQuestState.veil_counsel.choice==='testimony'")
 page.wait_for_timeout(350)
 page.screenshot(path=str(OUT/f'{orientation}-consequence.png'))
 page.get_by_role('button',name='Leave',exact=True).click()
 talk('mirelle')
 page.evaluate("pauseJournalQuest('veil_counsel')")
 page.get_by_role('button',name='Record the unresolved concern',exact=True).click()
 assert page.evaluate('!townQuestState.veil_counsel.response')
 page.evaluate("resumeJournalQuest('veil_counsel')")
 talk('mirelle')
 page.get_by_role('button',name='Record the unresolved concern',exact=True).click()
 assert page.evaluate('townQuestState.veil_counsel.response')
 page.wait_for_timeout(350)
 page.screenshot(path=str(OUT/f'{orientation}-branch-knowledge.png'))
 page.get_by_role('button',name='Keep this knowledge in the journal',exact=True).click()
 complete=page.evaluate('window.__qaStorage')
 for seed,done in [(partial,False),(complete,True)]:
  page.close();page=new_page(browser,width,height)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(markup(seed),wait_until='domcontentloaded',timeout=60000)
  page.locator('#titleContinue').click()
  assert page.evaluate('!!townQuestState.veil_counsel.mirelle')
  assert page.evaluate("townQuestState.veil_counsel.choice==='testimony'")==done
  assert page.evaluate('!!townQuestState.veil_counsel.response')==done
  talk('vaelis')
  assert page.get_by_role('button',name='Review the secured evidence',exact=True).count()==0
  page.get_by_role('button',name='Leave',exact=True).click()
  if done:
   page.evaluate("() => {delete townQuestState._lastLanternAccess;ui();}")
   assert page.evaluate("!questCatalog().some(q=>q.id==='veil_counsel')")
   talk('vaelis')
   assert 'After the decision' not in page.locator('#adventureScreen').inner_text()
 assert not errors,errors
 page.close()
 return {'orientation':orientation,'passed':['default closed','real NPC interaction and evidence review','three differing proposals','confirmed recommendation and branch-specific follow-up','partial/completed document reload','reentry consequences','paused stale confirmation/follow-up blocked; resume and ordinary conversation work','gate removed hides new content'],'pageErrors':errors}

parser=argparse.ArgumentParser()
parser.add_argument('--browser',default=shutil.which('chromium') or shutil.which('google-chrome'))
args=parser.parse_args()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 results=[run(browser,'landscape',960,600),run(browser,'portrait',412,915)]
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))

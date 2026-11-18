#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/last-lantern'
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
 page.locator('#characterName').fill('LanternQA'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 page.evaluate("() => {player.level=13;syncHeroStats();player.hp=player.max;companions=[];setMap('briarhollow',650,315,false);ui();}")
 page.screenshot(path=str(OUT/f'{orientation}-briar-entrance.png'),animations='disabled')
 # Actual Interact button and choice enter the optional map.
 page.locator('#attack').click()
 page.get_by_role('button',name='Enter the ruined church',exact=True).click()
 assert page.evaluate('mapId')=='last_lantern'
 page.wait_for_timeout(400)
 page.screenshot(path=str(OUT/f'{orientation}-churchyard.png'),animations='disabled')
 # The real movement engine crosses both broad doorways; no geometry overrides.
 page.evaluate("() => {player.x=280;player.y=315;enemies.forEach(e=>e.stun=20);ui();}")
 page.keyboard.down('ArrowRight');page.wait_for_timeout(850);page.keyboard.up('ArrowRight')
 assert page.evaluate('player.x')>340,'Nave doorway blocked'
 page.evaluate("() => {player.x=600;player.y=315;}")
 page.keyboard.down('ArrowRight');page.wait_for_timeout(750);page.keyboard.up('ArrowRight')
 assert page.evaluate('player.x')>660,'Undercroft doorway blocked'
 # All four standard attacks must wind up; committed attacks can be dodged.
 for index in range(4):
  page.evaluate("""i=>{setMap('last_lantern',80,490,false);const e=enemies[i];for(const n of enemies){n.stun=50;n.windup=0;n.swing=null;}e.stun=0;e.combatCool=0;e.recoveryTime=0;player.x=e.x-45;player.y=e.y;player.hp=player.max;player.cool=100;dodgeCooldown=0;player.faceX=-1;player.faceY=0;}""",index)
  page.wait_for_function('i=>enemies[i].windup>0',arg=index,timeout=6000)
  hp=page.evaluate('player.hp')
  if index==3:page.screenshot(path=str(OUT/f'{orientation}-captain-telegraph.png'),animations='disabled')
  page.locator('#dodgeButton').click()
  page.wait_for_timeout(1600)
  assert page.evaluate('player.hp')==hp, f'Attack {index} not evaded'
 # Opening evidence while a strike is pending pauses simulation and damage.
 page.evaluate("""()=>{const o=activeMap.worldObjects.find(o=>o.id==='lantern_register');player.x=o.x;player.y=o.y;const e=enemies[1];e.stun=0;e.windup=.1;e.swing={x:player.x,y:player.y,radius:100};interact();}""")
 hp=page.evaluate('player.hp');windup=page.evaluate('enemies[1].windup')
 page.wait_for_timeout(1300)
 assert page.evaluate('player.hp')==hp and page.evaluate('enemies[1].windup')==windup
 page.screenshot(path=str(OUT/f'{orientation}-refuge-register.png'),animations='disabled')
 page.get_by_role('button',name='Keep the evidence in the journal').click()
 # Save intermediate state; defeat using actual combat controls and standard stats.
 page.evaluate("() => {setMap('last_lantern',80,490,false);saveGame();}")
 partial=page.evaluate('window.__qaStorage')
 for index in range(4):
  page.evaluate("""i=>{setMap('last_lantern',80,490,false);const e=enemies[i];player.x=e.x-40;player.y=e.y;player.hp=player.max;player.cool=0;for(const n of enemies)n.stun=0;ui();}""",index)
  # Hold attack engages normal auto-attack; dodge tests above used normal timing.
  attack=page.locator('#attack');attack.hover();page.mouse.down()
  page.wait_for_function('i=>!enemies[i].alive',arg=index,timeout=45000)
  page.mouse.up()
 for oid in ['lantern_bell','lantern_inventory']:
  page.evaluate("oid=>{const o=activeMap.worldObjects.find(o=>o.id===oid);player.x=o.x;player.y=o.y;ui();}",oid)
  page.locator('#attack').click()
  page.get_by_role('button',name='Keep the evidence in the journal').click()
 page.evaluate("() => {player.x=175;player.y=455;ui();}")
 coins=page.evaluate('player.coins')
 page.locator('#attack').click()
 assert page.evaluate('townQuestState.last_lantern.claimed')
 assert page.evaluate('player.coins')==coins+65
 page.screenshot(path=str(OUT/f'{orientation}-complete.png'),animations='disabled')
 page.get_by_role('button',name='Keep the road lit').click()
 page.evaluate("() => {player.x=80;player.y=490;ui();}")
 page.locator('#attack').click()
 assert page.evaluate('mapId')=='briarhollow'
 page.locator('#attack').click();page.get_by_role('button',name='Enter the ruined church',exact=True).click()
 assert page.evaluate('enemies.every(e=>!e.alive)')
 complete=page.evaluate('window.__qaStorage')
 # Full document reload exercises module installation before saved-map restoration.
 for seed,claimed in [(partial,False),(complete,True)]:
  page.close()
  page=new_page(browser,width,height)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(markup(seed),wait_until='domcontentloaded',timeout=60000)
  page.locator('#titleContinue').click()
  assert page.evaluate('mapId')=='last_lantern'
  assert page.evaluate('!!townQuestState.last_lantern.register')
  assert page.evaluate('!!townQuestState.last_lantern.claimed')==claimed
  assert page.evaluate('enemies.every(e=>!e.alive)')==claimed
 assert not errors,errors
 page.close()
 return {'orientation':orientation,'passed':['UI entry/exit/reentry','keyboard movement through both doors','four telegraphs and dodge','dialogue pauses pending attack','combat-control clearance','evidence and reward','partial/completed document reload'],'pageErrors':errors}

parser=argparse.ArgumentParser()
parser.add_argument('--browser',default=shutil.which('chromium') or shutil.which('google-chrome'))
args=parser.parse_args()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 results=[run(browser,'landscape',960,600),run(browser,'portrait',412,915)]
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))

#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/early-quest-choices'
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
 page=new_page(browser,width,height);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click()
 page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('RoadChoices'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 def use(area,id):
  page.evaluate("([area,id])=>{const o=maps[area].worldObjects.find(o=>o.id===id);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;ui();}",[area,id])
  page.locator('#attack').click()
 def click(name):page.get_by_role('button',name=name,exact=True).click()
 use('wayfarers_camp','camp_fire');click('Record the clue')
 use('wayfarers_camp','camp_letter');page.screenshot(path=str(OUT/f'{orientation}-caller-choice.png'));click('Compare the public waymark')
 use('wayfarers_camp','camp_waymark');assert page.evaluate('campState().compared')
 use('wayfarers_camp','camp_board');assert page.evaluate('campState().claimed')
 use('wayfarers_camp','camp_board');click('Road Warden patrols');click('Repair the road · three Wood Logs')
 page.evaluate("addItem('wood_log',3)") # QA resource setup only; no progression flags granted.
 for i in range(3):
  use('whisperwood','camp_patrol_marker_'+str(i))
 assert page.evaluate('townQuestState._campPatrol.markers.length===3')
 use('wayfarers_camp','camp_board');click('Road Warden patrols');click('Collect patrol reward')
 assert page.evaluate('townQuestState._campPatrol.completed===1')
 page.evaluate("() => {setMap('willowfen',170,480,false);for(const e of enemies)if(e.alive)damageEnemy(e,100000);}") # QA accelerated combat clears the existing marsh guards.
 use('willowfen','regional_willowfen');page.screenshot(path=str(OUT/f'{orientation}-lantern-choice.png'));click('Rehang the lanterns · three Wood Logs')
 page.evaluate("addItem('wood_log',3)")
 for i in range(3):use('willowfen','regional_piece_willowfen_'+str(i))
 use('willowfen','regional_willowfen');assert page.evaluate("regionalState('willowfen').claimed")
 page.evaluate("() => {const o=maps.willowfen.worldObjects.find(o=>o.piece===0);player.x=o.x+65;player.y=o.y+60;saveGame();}")
 page.wait_for_timeout(300);page.screenshot(path=str(OUT/f'{orientation}-rehung-lantern.png'))
 saved=page.evaluate('window.__qaStorage');coins=page.evaluate('player.coins')
 page.close();page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(markup(saved),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Continue')).first.click()
 assert page.evaluate("campState().method==='seal'&&campState().claimed&&townQuestState._campPatrol.completed===1&&regionalState('willowfen').method==='rehang'&&regionalState('willowfen').claimed")
 assert page.evaluate('player.coins')==coins
 assert page.evaluate("!townQuestState._lastLanternAccess?.revealed")
 assert not errors,errors
 page.close();return {'orientation':orientation,'passed':True,'errors':errors,'scope':'Real UI interactions and reload; QA relocation/resource setup and accelerated marsh combat, not normal-speed traversal.'}

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  results=[run(browser,'portrait',412,915),run(browser,'landscape',915,412)];browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))

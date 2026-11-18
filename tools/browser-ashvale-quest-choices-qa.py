#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/ashvale-quest-choices'
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

def run(browser,orientation,width,height,watch,scout):
 page=new_page(browser,width,height);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click()
 page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('DalenChoices'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 def click(label):page.get_by_role('button',name=label,exact=True).click()
 def close():
  if page.locator('#adventureScreen').is_visible():page.locator('#adventureScreen .screenClose').click()
 def use(area,id):
  close();page.evaluate("([area,id])=>{const o=maps[area].worldObjects.find(o=>o.id===id);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;ui();}",[area,id]);page.locator('#attack').click()
 def dalen():
  use('wayfarers_camp','camp_board');click('Companions · recruit, swap and talk');page.get_by_role('button',name=re.compile('Dalen the Guard')).click()
 def giver(id):
  close();page.evaluate("id=>{const area=id==='ashvale_watch'?'ashvale':'whisperwood',n=maps[area].npcs.find(n=>n.questId===id);setMap(area,n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}",id);page.locator('#attack').click();click('Discuss my request')
 def kills(count):
  close();page.evaluate("count=>{setMap('whisperwood',160,300,false);const targets=enemies.filter(e=>e.kind==='slime').slice(0,count);for(const e of targets){e.alive=true;e.hp=e.maxHp||e.baseHp||5;e.lootClaimed=false;damageEnemy(e,100000);}}",count)
 use('wayfarers_camp','camp_fire');click('Record the clue');use('wayfarers_camp','camp_letter');click('Follow the footprints');use('wayfarers_camp','camp_tracks');click('Stay and explore camp')
 dalen();click('Accept: A Shared Summons');kills(2);dalen();click('Complete the summons · establish your bond')
 assert page.evaluate('townQuestState.recruit_dalen.claimed')
 click('Begin: Whisperwood Watch');page.screenshot(path=str(OUT/f'{orientation}-watch-choice.png'))
 click('Establish a refuge · 24 crowns + roadside rest' if watch=='shelter' else 'Clear the threats · 36 crowns')
 if watch=='shelter':
  page.evaluate("() => {addItem('wood_log',2);addItem('field_ration',1);}") # QA gathering setup.
  use('whisperwood','ashvale_refuge');click('Build with 2 Wood Logs and 1 Field Ration')
  assert page.evaluate('townQuestState.ashvale_watch.built')
  page.evaluate("() => {player.x+=65;player.y+=65;}");page.wait_for_timeout(300);page.screenshot(path=str(OUT/f'{orientation}-refuge-built.png'))
 else:kills(3)
 giver('ashvale_watch');coins=page.evaluate('player.coins');click('Record the result and claim the chapter');assert page.evaluate('player.coins')==coins+(24 if watch=='shelter' else 36)
 giver('ashvale_scout');page.screenshot(path=str(OUT/f'{orientation}-report-choice.png'));click('Compare the two watch accounts' if scout=='accounts' else 'Recover the patrol signal from the nests')
 if scout=='accounts':
  giver('ashvale_scout');click('Record Rowan’s departure column');dalen();page.screenshot(path=str(OUT/f'{orientation}-two-accounts.png'));click('Compare Dalen’s gate account');click('Continue: Scout’s Report')
 else:
  kills(2);giver('ashvale_scout')
 coins=page.evaluate('player.coins');click('Record the result and claim the chapter');assert page.evaluate('player.coins')==coins+16
 assert page.evaluate("townRelicState.ashvale&&bagCount('ashvale_seal')===1&&!hasFourfoldKey&&!townQuestState._lastLanternAccess?.revealed")
 page.evaluate('saveGame()');saved=page.evaluate('window.__qaStorage');page.close()
 page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(markup(saved),wait_until='domcontentloaded',timeout=60000);page.get_by_role('button',name=re.compile('Continue')).first.click()
 assert page.evaluate("([watch,scout])=>townQuestState.ashvale_watch.claimed&&townQuestState.ashvale_watch.method===watch&&townQuestState.ashvale_scout.claimed&&townQuestState.ashvale_scout.method===scout&&bagCount('ashvale_seal')===1",[watch,scout])
 assert not errors,errors
 page.close();return {'orientation':orientation,'watch':watch,'scout':scout,'passed':True,'errors':errors,'scope':'Actual UI, initial camp/recruitment, both chapters and reload. QA relocation, gathering setup and accelerated combat; not normal-speed/device play.'}

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  results=[run(browser,'portrait',412,915,'shelter','accounts'),run(browser,'landscape',915,412,'clear','recover')];browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))

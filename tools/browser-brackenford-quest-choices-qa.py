#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/brackenford-quest-choices'
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

def run(browser,orientation,width,height,route,medicine):
 page=new_page(browser,width,height);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click()
 page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('SylviChoices'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 def click(label):page.get_by_role('button',name=label,exact=True).click()
 def close():
  if page.locator('#adventureScreen').is_visible():page.locator('#adventureScreen .screenClose').click()
 def use(area,id):
  close();page.evaluate("([area,id])=>{const o=maps[area].worldObjects.find(o=>o.id===id);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;ui();}",[area,id]);page.locator('#attack').click()
 def sylvi():
  use('wayfarers_camp','camp_board');click('Companions · recruit, swap and talk');page.get_by_role('button',name=re.compile('Sylvi the Outrider')).click()
 def giver(id):
  close();page.evaluate("id=>{const n=maps.brackenford.npcs.find(n=>n.questId===id);setMap('brackenford',n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}",id);page.locator('#attack').click();click('Discuss my request')
 def kills(count):
  close();page.evaluate("count=>{setMap('redfen',160,300,false);for(let i=0;i<count;i++){const e=enemies.find(e=>e.kind==='spider');e.alive=true;e.hp=e.maxHp||5;e.lootClaimed=false;damageEnemy(e,100000);}}",count)
 use('wayfarers_camp','camp_fire');click('Record the clue');use('wayfarers_camp','camp_letter');click('Follow the footprints');use('wayfarers_camp','camp_tracks');click('Stay and explore camp')
 sylvi();click('Accept: A Shared Summons');kills(2);sylvi();click('Complete the summons · establish your bond')
 click('Begin: Redfen Patrol');page.screenshot(path=str(OUT/f'{orientation}-patrol-choice.png'))
 click('Cover the reed-route diversion' if route=='diversion' else 'Clear the direct trail')
 page.evaluate("() => addItem('bog_resin',3)") # QA material setup, not gathering evidence.
 if route=='diversion':
  close();page.evaluate("() => {setMap('redfen',400,330,false);for(const e of enemies)if(e.alive)damageEnemy(e,100000);}") # Accelerated clearing allows interact targeting; not survival evidence.
  use('redfen','bracken_signal');click('Burn three Bog Resin and cover the crossing');close()
  page.wait_for_function('townQuestState.bracken_patrol.held>=3',timeout=20000)
  page.evaluate("pauseJournalQuest('bracken_patrol')");held=page.evaluate('townQuestState.bracken_patrol.held');page.wait_for_timeout(800);assert page.evaluate('townQuestState.bracken_patrol.held')==held
  page.evaluate("resumeJournalQuest('bracken_patrol')");page.screenshot(path=str(OUT/f'{orientation}-signal-cover.png'))
  page.wait_for_function('townQuestState.bracken_patrol.held>=12',timeout=25000)
 else:kills(3)
 giver('bracken_patrol');coins=page.evaluate('player.coins');click('Finish this chapter with Sylvi');assert page.evaluate('player.coins')==coins+30
 giver('bracken_herbs');page.screenshot(path=str(OUT/f'{orientation}-medicine-choice.png'));stock=page.evaluate("townStock('brackenford').items.potion_25")
 click('Set aside town medicine · 4 bottles' if medicine=='reserve' else 'Distill Fen Stalker samples')
 if medicine=='reserve':
  assert page.evaluate("townStock('brackenford').items.potion_25")==stock-4
  use('redfen','bracken_medicine');click('Deliver the sealed medicine')
 else:
  kills(2);page.evaluate("() => addItem('fen_venom',2)")
 giver('bracken_herbs');coins=page.evaluate('player.coins');click('Finish this chapter with Sylvi');assert page.evaluate('player.coins')==coins+22
 assert page.evaluate("townRelicState.brackenford&&bagCount('brackenford_seal')===1&&!hasFourfoldKey&&!townQuestState._lastLanternAccess?.revealed")
 page.screenshot(path=str(OUT/f'{orientation}-chapter-complete.png'))
 page.evaluate('saveGame()');saved=page.evaluate('window.__qaStorage');page.close()
 page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(markup(saved),wait_until='domcontentloaded',timeout=60000);page.get_by_role('button',name=re.compile('Continue')).first.click()
 assert page.evaluate("([route,medicine])=>townQuestState.bracken_patrol.claimed&&townQuestState.bracken_patrol.method===route&&townQuestState.bracken_herbs.claimed&&townQuestState.bracken_herbs.method===medicine&&bagCount('brackenford_seal')===1",[route,medicine])
 assert page.evaluate("townStock('brackenford').items.potion_25")==stock-(4 if medicine=='reserve' else 0)
 assert not errors,errors
 page.close();return {'orientation':orientation,'route':route,'medicine':medicine,'passed':True,'errors':errors,'scope':'Actual UI, camp recruitment, both chapters and reload; real-frame signal timer and pause. QA relocation, material setup and accelerated combat; not normal-speed survival or device play.'}

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('google-chrome') or shutil.which('chromium-browser'),args=['--no-sandbox'])
  results=[run(browser,'portrait',412,915,'diversion','reserve'),run(browser,'landscape',915,412,'clear_route','brew')];browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))

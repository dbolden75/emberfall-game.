#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/sunmere-quest-choices'
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

def run(browser,orientation,width,height,method,repair):
 page=new_page(browser,width,height);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click()
 page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('ErynChoices'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 def click(label):page.get_by_role('button',name=label,exact=True).click()
 def close():
  if page.locator('#adventureScreen').is_visible():page.locator('#adventureScreen .screenClose').click()
 def use(area,id):
  close();page.evaluate("([area,id])=>{const o=maps[area].worldObjects.find(o=>o.id===id);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;ui();}",[area,id]);page.locator('#attack').click()
 def eryn():
  use('wayfarers_camp','camp_board');click('Companions · recruit, swap and talk');page.get_by_role('button',name=re.compile('Eryn the Arcanist')).click()
 def giver(id):
  close();page.evaluate("id=>{const n=maps.sunmere.npcs.find(n=>n.questId===id);setMap('sunmere',n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}",id);page.locator('#attack').click();click('Discuss my request')
 def kills(count):
  close();page.evaluate("count=>{setMap('frostmarch',160,300,false);for(let i=0;i<count;i++){const e=enemies.find(e=>e.kind==='spider');e.alive=true;e.hp=e.maxHp||5;e.lootClaimed=false;damageEnemy(e,100000);}}",count)
 use('wayfarers_camp','camp_fire');click('Record the clue');use('wayfarers_camp','camp_letter');click('Follow the footprints');use('wayfarers_camp','camp_tracks');click('Stay and explore camp')
 eryn();click('Accept: A Shared Summons');kills(2);eryn();click('Complete the summons · establish your bond')
 click('Begin: Pass Watch');page.screenshot(path=str(OUT/f'{orientation}-watch-choice.png'))
 click('Vent the damaged charge · 40 crowns' if method=='vent' else 'Reinforce with Frost Shards · 55 crowns')
 if method=='vent':
  use('sunmere','sunmere_beacon_work');click('Test the pressure balance');assert not page.evaluate('townQuestState.sunmere_hunt.vented')
  use('sunmere','sunmere_beacon_work');click('Turn harbor vent');click('Turn harbor vent');click('Turn pass vent');page.screenshot(path=str(OUT/f'{orientation}-pressure-test.png'));click('Test the pressure balance')
 else:
  kills(4);page.evaluate("() => addItem('frost_shard',4)") # QA gathering setup.
 giver('sunmere_hunt');coins=page.evaluate('player.coins');click('Record Eryn’s repair and claim the chapter');assert page.evaluate('player.coins')==coins+(40 if method=='vent' else 55)
 giver('sunmere_weavers');page.screenshot(path=str(OUT/f'{orientation}-repair-choice.png'))
 click('Convert to manual shutters · 24 crowns / 36 XP' if repair=='shutters' else 'Rebind the lens · 36 crowns / 24 XP')
 if repair=='shutters':
  use('sunmere','sunmere_beacon_work');click('Dismantle the control and fit the crank')
  close();page.evaluate("() => {setMap('frostmarch',160,420,false);for(const e of enemies)if(e.alive)damageEnemy(e,100000);}") # Accelerated encounter clearing, not survival evidence.
  use('frostmarch','sunmere_shutter_mount');page.screenshot(path=str(OUT/f'{orientation}-linkage.png'));click('Fit and test the shutter linkage')
 else:
  kills(2);page.evaluate("() => addItem('ice_silk',2)")
 giver('sunmere_weavers');coins=page.evaluate('player.coins');click('Record Eryn’s repair and claim the chapter');assert page.evaluate('player.coins')==coins+(24 if repair=='shutters' else 36)
 assert page.evaluate("townRelicState.sunmere&&bagCount('sunmere_seal')===1&&!hasFourfoldKey&&!townQuestState._lastLanternAccess?.revealed")
 close();page.evaluate("() => {const o=maps.sunmere.worldObjects.find(o=>o.id==='sunmere_beacon_work');player.x=o.x-50;player.y=o.y+30;}");page.wait_for_timeout(300);page.screenshot(path=str(OUT/f'{orientation}-beacon-complete.png'))
 page.evaluate('saveGame()');saved=page.evaluate('window.__qaStorage');page.close()
 page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(markup(saved),wait_until='domcontentloaded',timeout=60000);page.get_by_role('button',name=re.compile('Continue')).first.click()
 assert page.evaluate("([method,repair])=>townQuestState.sunmere_hunt.claimed&&townQuestState.sunmere_hunt.method===method&&townQuestState.sunmere_weavers.claimed&&townQuestState.sunmere_weavers.method===repair&&bagCount('sunmere_seal')===1",[method,repair])
 assert not errors,errors
 page.close();return {'orientation':orientation,'method':method,'repair':repair,'passed':True,'errors':errors,'scope':'Actual camp recruitment and chapter UI, pressure failure/success, field assembly and save reload. QA relocation, materials and accelerated combat; not normal-speed survival or device play.'}

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('google-chrome') or shutil.which('chromium-browser'),args=['--no-sandbox'])
  results=[run(browser,'portrait',412,915,'vent','shutters'),run(browser,'landscape',915,412,'reinforce','weave')];browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))

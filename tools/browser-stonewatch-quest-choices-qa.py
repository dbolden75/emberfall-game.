#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/stonewatch-quest-choices'
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

def run(browser,orientation,width,height,method,vigil):
 page=new_page(browser,width,height);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name=re.compile('Start New Game')).click()
 page.get_by_role('button',name='Tap to Continue').click()
 page.locator('#characterName').fill('CorinChoices'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 def click(label):page.get_by_role('button',name=label,exact=True).click()
 def close():
  if page.locator('#adventureScreen').is_visible():page.locator('#adventureScreen .screenClose').click()
 def use(area,id):
  close();page.evaluate("([area,id])=>{const o=maps[area].worldObjects.find(o=>o.id===id);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;ui();}",[area,id]);page.locator('#attack').click()
 def corin():
  use('wayfarers_camp','camp_board');click('Companions · recruit, swap and talk');page.get_by_role('button',name=re.compile('Corin the Acolyte')).click()
 def giver(id):
  close();page.evaluate("id=>{const n=maps.stonewatch.npcs.find(n=>n.questId===id);setMap('stonewatch',n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}",id);page.locator('#attack').click();click('Discuss my request')
 def kills(count,kind):
  close();page.evaluate("([count,kind])=>{setMap('highmoor',160,300,false);for(let i=0;i<count;i++){const e=enemies.find(e=>e.kind===kind);e.alive=true;e.hp=e.maxHp||5;e.lootClaimed=false;damageEnemy(e,100000);}}",[count,kind])
 use('wayfarers_camp','camp_fire');click('Record the clue');use('wayfarers_camp','camp_letter');click('Follow the footprints');use('wayfarers_camp','camp_tracks');click('Stay and explore camp')
 corin();click('Accept: A Shared Summons');kills(2,'skeleton');corin();click('Complete the summons · establish your bond')
 click('Begin: Clear the Moor');page.screenshot(path=str(OUT/f'{orientation}-warning-choice.png'))
 click('Give a spare Buckler to the warning frame' if method=='gong' else 'Recover Grave Iron from the wardens')
 if method=='gong':
  close();page.evaluate("() => {const n=maps.stonewatch.npcs.find(n=>n.shopId==='stonewatch_weapons');setMap('stonewatch',n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}");page.locator('#attack').click();click('Browse the shop')
  coins=page.evaluate('player.coins');buy=page.locator('[data-shop-action="buy"][data-id="buckler"]');buy.click();buy.click();assert page.evaluate('bagCount("buckler")')==2;assert page.evaluate('player.coins')==coins-24
  page.screenshot(path=str(OUT/f'{orientation}-buckler-purchase.png'));page.get_by_role('button',name='Close shop',exact=True).click()
  page.evaluate("() => equipItem('buckler')") # Equipment setup; purchases above use actual UI.
  close();page.evaluate("() => {setMap('highmoor',145,350,false);for(const e of enemies)if(e.alive)damageEnemy(e,100000);}") # Accelerated clearing, not survival evidence.
  use('highmoor','stonewatch_warning');click('Permanently hang one spare Buckler');assert page.evaluate('bagCount("buckler")')==1;assert page.evaluate('player.shield')=='buckler'
 else:
  kills(3,'skeleton');page.evaluate("() => addItem('grave_iron',3)") # QA gathering setup.
 giver('stonewatch_sweep');coins=page.evaluate('player.coins');click('Record the vigil chapter');assert page.evaluate('player.coins')==coins+42
 giver('stonewatch_silk');page.screenshot(path=str(OUT/f'{orientation}-vigil-choice.png'))
 click('Accompany an open vigil · 18 crowns / 30 XP' if vigil=='open_vigil' else 'Prepare the shrine cloth · 28 crowns / 20 XP')
 if vigil=='open_vigil':
  for station,label in [('watch','Witness Corin’s return to duty'),('memory','Witness the remembrance')]:
   use('highmoor','stonewatch_'+station);click(label)
  use('highmoor','stonewatch_warning');page.screenshot(path=str(OUT/f'{orientation}-witness-without-vows.png'));click('Close the vigil as a witness')
 else:
  kills(2,'spider');page.evaluate("() => addItem('ruin_silk',2)")
 giver('stonewatch_silk');coins=page.evaluate('player.coins');click('Record the vigil chapter');assert page.evaluate('player.coins')==coins+(18 if vigil=='open_vigil' else 28)
 assert page.evaluate("townRelicState.stonewatch&&bagCount('stonewatch_seal')===1&&!hasFourfoldKey&&!townQuestState._lastLanternAccess?.revealed")
 page.screenshot(path=str(OUT/f'{orientation}-vigil-complete.png'))
 page.evaluate('saveGame()');saved=page.evaluate('window.__qaStorage');page.close()
 page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(markup(saved),wait_until='domcontentloaded',timeout=60000);page.get_by_role('button',name=re.compile('Continue')).first.click()
 assert page.evaluate("([method,vigil])=>townQuestState.stonewatch_sweep.claimed&&townQuestState.stonewatch_sweep.method===method&&townQuestState.stonewatch_silk.claimed&&townQuestState.stonewatch_silk.method===vigil&&bagCount('stonewatch_seal')===1",[method,vigil])
 assert not errors,errors
 page.close();return {'orientation':orientation,'method':method,'vigil':vigil,'passed':True,'errors':errors,'scope':'Actual camp recruitment and chapter UI, normal-price Buckler purchase and equipped-copy protection, open vigil and reload. QA relocation, other materials and accelerated combat; not normal-speed survival/device play.'}

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('google-chrome') or shutil.which('chromium-browser'),args=['--no-sandbox'])
  results=[run(browser,'portrait',412,915,'gong','open_vigil'),run(browser,'landscape',915,412,'iron','cloth')];browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))

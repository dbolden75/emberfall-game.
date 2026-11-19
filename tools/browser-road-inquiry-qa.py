#!/usr/bin/env python3
"""Chromium checks with real UI/frames; QA relocations set up encounters.
Uses repository in-memory browser storage transport; no Android durability claim.
"""
import argparse, json, re, runpy, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html_for_browser=runpy.run_path(str(ROOT/'tools/browser-interactive-qa.py'))['html_for_browser']
OUT=ROOT/'reports/road-inquiry'
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
 page.locator('#characterName').fill('RoadQA'+orientation)
 page.get_by_role('button',name='Begin Journey').click()
 def close():page.locator('#adventureScreen .screenClose').click()
 # QA clears pre-existing road/coast encounters through the engine; this test
 # exercises investigation UI, not another general-combat playthrough.
 def inspect(oid,mid):
  page.evaluate("([oid,mid])=>{setMap(mid,480,315,false);const o=maps[mid].worldObjects.find(o=>o.id===oid);player.x=o.x;player.y=o.y;if(['stonewatchroad','sunharbor','worldsend'].includes(mid))enemies.filter(e=>e.alive).forEach(e=>finishEnemy(e,player.class));ui();}",[oid,mid])
  page.locator('#attack').click()
 def sister():
  page.evaluate("()=>{const n=maps.stonewatch.npcs.find(n=>n.name==='Sister Elowen');setMap('stonewatch',n.x,n.y,false);player.x=n.x;player.y=n.y;ui();}")
  page.locator('#attack').click()
  page.get_by_role('button',name='Ask about the uncounted passengers',exact=True).click()
 assert page.evaluate("!vampireRevealKnown()&&!questCatalog().some(q=>q.id==='night_visitor')&&vampireBestiaryText()===''&&setMap('veilhaven',480,480,false)===false")
 page.evaluate('openBestiary()')
 assert not re.search(r'vampire|bloodbound|veil stalker|crimson elder',page.locator('#adventureScreen').inner_text(),re.I)
 close();sister()
 assert page.get_by_role('button',name='Begin comparing the records',exact=True).count()==0
 page.screenshot(path=str(OUT/f'{orientation}-early-guidance.png'));close()
 # Complete the opening camp through its real UI, then Briar Hollow.
 inspect('camp_fire','wayfarers_camp');page.get_by_role('button',name='Record the clue',exact=True).click()
 inspect('camp_letter','wayfarers_camp');page.get_by_role('button',name='Follow the footprints',exact=True).click()
 inspect('camp_tracks','wayfarers_camp');page.get_by_role('button',name='Follow the south road to Ashvale',exact=True).click()
 inspect('briar_sign','briarhollow');page.get_by_role('button',name='Investigate the abandoned town',exact=True).click();close()
 for clue in ['briar_bell','briar_clinic','briar_gate']:inspect(clue,'briarhollow');close()
 inspect('briar_cellar','briarhollow')
 assert 'vampire' not in page.locator('#adventureScreen').inner_text().lower()
 page.get_by_role('button',name='Keep watch while Ada prepares (no supplies needed)',exact=True).click();close()
 inspect('briar_signal','briarhollow');close();inspect('briar_memorial','briarhollow')
 assert 'vampire' not in page.locator('#adventureScreen').inner_text().lower()
 close();assert not page.evaluate('vampireRevealKnown()')
 # QA represents the already-earned campaign prerequisite; it does not set the
 # reveal flag or inquiry records. Full four-town/shrine campaign is not replayed.
 page.evaluate("()=>{done=true;huntRewarded=true;hasFourfoldKey=true;hasSigil=true;shrineRewarded=true;deepQuestDone=true;maps.mosslight.chest.open=true;maps.shrine_rootmaze.chest.open=true;maps.shrine_heart.treasure.opened=true;companions=[];}")
 sister();page.get_by_role('button',name='Begin comparing the records',exact=True).click();close()
 for oid,mid in [('inquiry_road','stonewatchroad'),('inquiry_harbor','sunharbor')]:
  inspect(oid,mid);page.get_by_role('button',name='Keep the finding in the journal',exact=True).click()
 partial=page.evaluate('window.__qaStorage')
 page.close();page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(partial),wait_until='domcontentloaded',timeout=60000);page.locator('#titleContinue').click()
 assert page.evaluate('townQuestState.road_inquiry.road&&townQuestState.road_inquiry.harbor&&!vampireRevealKnown()')
 sister();page.wait_for_timeout(350);page.screenshot(path=str(OUT/f'{orientation}-method-choice.png'))
 paper=orientation=='landscape'
 page.get_by_role('button',name='Trace the carrier’s paperwork' if paper else 'Read a protected witness account',exact=True).click();close()
 inspect('inquiry_copy' if paper else 'inquiry_account','stonewatchroad' if paper else 'sunharbor')
 page.get_by_role('button',name='Keep the finding in the journal',exact=True).click();sister()
 page.get_by_role('button',name='Compare the clinical archive',exact=True).click()
 assert page.evaluate('vampireRevealKnown()&&townQuestState.road_inquiry.revealed')
 page.wait_for_timeout(350);page.screenshot(path=str(OUT/f'{orientation}-earned-reveal.png'))
 page.get_by_role('button',name='Record what we now know',exact=True).click();close()
 inspect('lantern_road','briarhollow');page.get_by_role('button',name='Enter the ruined church',exact=True).click()
 assert page.evaluate("mapId==='last_lantern'&&enemies.filter(e=>e.alive).length===4")
 inspect('lantern_return','last_lantern')
 inspect('veil_departure','worldsend');page.get_by_role('button',name='Sail to Veilhaven',exact=True).click()
 assert page.evaluate("mapId==='veilhaven'")
 inspect('veil_ferry','veilhaven');page.get_by_role('button',name='Sail to Worldsend',exact=True).click()
 final=page.evaluate('window.__qaStorage');page.close();page=new_page(browser,width,height);page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(markup(final),wait_until='domcontentloaded',timeout=60000);page.locator('#titleContinue').click()
 assert page.evaluate('vampireRevealKnown()&&townQuestState.road_inquiry.corroborated&&townQuestState.briar_hollow.claimed')
 assert not errors,errors
 page.close()
 return {'orientation':orientation,'method':'paper' if paper else 'witness','passed':['new character spoiler gates','Briar rescue through UI without reveal','campaign prerequisite QA seeded, not replayed','earned inquiry records and exclusive method','partial/completed document reload','production reveal without QA reveal flag','Last Lantern entrance and retreat','Veilhaven free round-trip ferry'],'pageErrors':errors}

parser=argparse.ArgumentParser();parser.add_argument('--browser',default=shutil.which('chromium') or shutil.which('google-chrome'));args=parser.parse_args()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 results=[run(browser,'landscape',960,600),run(browser,'portrait',412,915)]
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))

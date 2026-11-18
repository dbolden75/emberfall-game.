#!/usr/bin/env python3
"""Real-time Chromium route + pet/human traversal and saturated fog benchmark.
QA setup recruits an existing human and suppresses encounters to isolate navigation.
No movement speed, dt, collision, follower recovery or save code is replaced.
"""
import json,runpy,shutil,time,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
html_for_browser=runpy.run_path(str(Path(__file__).with_name('browser-interactive-qa.py')))['html_for_browser']
out=Path('/tmp/thornhaven-wilderness-endurance');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
 html=html_for_browser(Path('app/src/main/assets'))
 pages=[];results={}
 for route_id in [4,5]:
  page=browser.new_page(viewport={'width':915,'height':412});errors=[];page.on('pageerror',lambda e,errors=errors:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded',timeout=60000)
  page.get_by_role('button',name='Start New Game',exact=False).click();page.get_by_role('button',name='Tap to Continue').click();page.locator('#characterName').fill('RouteQA');page.get_by_role('button',name='Begin Journey').click()
  if route_id==4:
   results['fog']=page.evaluate('''() => {
    setMap('elderwood',480,315,false);const b=worldBounds(),cells={};
    for(let y=Math.floor(b.minY/64);y<=Math.floor(b.maxY/64);y++)for(let x=Math.floor(b.minX/64);x<=Math.floor(b.maxX/64);x++)cells[x+','+y]=1;
    const emptySerialize=[],emptySave=[];townQuestState._localExploration={elderwood:{}};for(let i=0;i<5;i++){let t=performance.now();JSON.stringify(snapshotGameState());emptySerialize.push(performance.now()-t);t=performance.now();saveGame();emptySave.push(performance.now()-t);}
    townQuestState._localExploration={elderwood:cells};
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=637;const g=canvas.getContext('2d');g.scale(1024/(b.maxX-b.minX),637/(b.maxY-b.minY));g.translate(-b.minX,-b.minY);
    const rebuild=[],cached=[],serialize=[],save=[];let bytes=0;
    for(let i=0;i<5;i++){townQuestState._localExploration.elderwood={...cells};window.localExplorationRevision++;let t=performance.now();window.drawSoftExplorationFog(g,b);g.getImageData(0,0,1,1);rebuild.push(performance.now()-t);t=performance.now();window.drawSoftExplorationFog(g,b);g.getImageData(0,0,1,1);cached.push(performance.now()-t);t=performance.now();const text=JSON.stringify(snapshotGameState());serialize.push(performance.now()-t);bytes=new TextEncoder().encode(text).length;t=performance.now();saveGame();save.push(performance.now()-t);}
    const incremental=[];for(let i=0;i<5;i++){const current={...cells};delete current['0,0'];townQuestState._localExploration.elderwood=current;window.localExplorationRevision++;window.drawSoftExplorationFog(g,b);g.getImageData(0,0,1,1);current['0,0']=1;window.localExplorationRevision++;const t=performance.now();window.drawSoftExplorationFog(g,b);g.getImageData(0,0,1,1);incremental.push(performance.now()-t);}
    const cloud=ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId),decoded=ThornhavenCloudSaveCore.parse(cloud);
    if(Object.keys(decoded.slots[activeSlotId].state.townQuestState._localExploration.elderwood).length!==Object.keys(cells).length)throw Error('Fog cloud roundtrip lost cells');
    townQuestState._localExploration={};window.localExplorationRevision++;
    return {emptySerializeMs:emptySerialize,emptySaveMs:emptySave,cells:Object.keys(cells).length,snapshotUtf8Bytes:bytes,rebuildMs:rebuild,incrementalMs:incremental,cachedMs:cached,serializeMs:serialize,saveMs:save,cloudRoundtrip:true};
   }''')
   (out/'fog.json').write_text(json.dumps(results['fog'],indent=2));print('FOG '+json.dumps(results['fog']),flush=True)
  if '--fog-only' in sys.argv:
   browser.close();sys.exit(0)
  page.evaluate('''routeId => {
   setMap('elderwood',-6200,315,false);const humanId=Object.keys(humanStories)[0],party=humanParty();party.roster[humanId]=makeHuman(humanId);party.active=humanId;snapCompanionsToPlayer();
   if(activeCompanions().length!==2||!activeCompanions().some(c=>c.human))throw Error('Need existing pet and human');
   for(const e of enemies){e.alive=false;e.respawnAt=Date.now()+3600000;}
   const route=[...wildernessSlice.routes[routeId].slice(1),[4900,500],[3900,315],[2350,315],[480,315],[-1400,315],[-3200,315],[-6200,315]];
   window.endurance={routeId,start:performance.now(),waypoints:route.length,reached:0,frames:0,collisions:0,snaps:0,maxLag:0,distance:0,last:{x:player.x,y:player.y},party:activeCompanions().map(c=>({id:c.id,human:!!c.human})),speed:player.speed,done:false};
   const previous=updateCompanions;
   updateCompanions=function(dt){const before=activeCompanions().map(c=>({x:c.x,y:c.y}));previous(dt);const q=window.endurance;q.frames++;q.distance+=Math.hypot(player.x-q.last.x,player.y-q.last.y);q.last={x:player.x,y:player.y};for(const [i,c] of activeCompanions().entries()){if(mapPlacementBlocked(mapId,c.x,c.y,14))q.collisions++;if(Math.hypot(c.x-before[i].x,c.y-before[i].y)>30)q.snaps++;q.maxLag=Math.max(q.maxLag,Math.hypot(c.x-player.x,c.y-player.y));}if(mapPlacementBlocked(mapId,player.x,player.y,player.r))q.collisions++;};
   let current=null,progressAt=performance.now(),lastDistance=Infinity;
   const timer=setInterval(()=>{const q=window.endurance;if(q.done)return;if(mapId!=='elderwood'){q.error='Unexpected region exit';q.done=true;}if(current){const d=Math.hypot(player.x-current[0],player.y-current[1]);if(d<8){q.reached++;current=null;lastDistance=Infinity;progressAt=performance.now();}else if(d<lastDistance-20){progressAt=performance.now();lastDistance=d;}}
    if(!current){current=route.shift();if(!current){q.done=true;q.seconds=(performance.now()-q.start)/1000;keys.clear();tapTarget=null;clearInterval(timer);return;}tapTarget={x:current[0],y:current[1]};}
    if(performance.now()-progressAt>30000){q.error='No progress for 30 seconds';q.done=true;clearInterval(timer);}
   },50);
  }''',route_id)
  pages.append((page,errors))
 start=time.monotonic()
 while time.monotonic()-start<900:
  states=[page.evaluate('window.endurance') for page,_ in pages]
  print('ROUTES '+json.dumps([{'route':s['routeId'],'reached':s['reached'],'total':s['waypoints'],'snaps':s['snaps'],'collisions':s['collisions'],'done':s['done'],'error':s.get('error')} for s in states]),flush=True)
  (out/'progress.json').write_text(json.dumps(states,indent=2))
  if all(s['done'] for s in states):break
  pages[0][0].wait_for_timeout(10000)
 else:raise AssertionError('Real-time routes timed out')
 results['routes']=states;results['pageErrors']=[errors for _,errors in pages]
 (out/'results.json').write_text(json.dumps(results,indent=2));browser.close()
 assert not any(results['pageErrors']),results['pageErrors']
 for s in states:
  assert not s.get('error') and s['reached']==s['waypoints'] and s['collisions']==0,s
  assert s['snaps']==0 and s['maxLag']<380 and len(s['party'])==2,s
 print('PASS real-time full outer loops with pet + human; saturated fog roundtrip',flush=True)

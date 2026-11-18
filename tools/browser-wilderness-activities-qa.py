#!/usr/bin/env python3
"""Real-time new-activity circuit with actual combat, gathering and both followers.
QA grants existing starter gear/tools and gathering levels; no combat stats altered.
Only legacy central encounters are suppressed to isolate the appended content.
"""
import json,runpy,shutil,time
from pathlib import Path
from playwright.sync_api import sync_playwright
html_for_browser=runpy.run_path(str(Path(__file__).with_name('browser-interactive-qa.py')))['html_for_browser']
out=Path('/tmp/thornhaven-wilderness-activities');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':915,'height':412});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html_for_browser(Path('app/src/main/assets')),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name='Start New Game',exact=False).click();page.get_by_role('button',name='Tap to Continue').click();page.locator('#characterName').fill('ActivityQA');page.get_by_role('button',name='Begin Journey').click()
 page.evaluate('''() => {
  setMap('elderwood',-6200,315,false);player.inventory=[];
  for(const id of ['short_sword','light_chainmail','mining_pick','woodcutting_hatchet','fishing_rod'])addItem(id);
  addItem('health_tonic',3);equipItem('short_sword');equipItem('light_chainmail');
  gatheringSkills={mining:{level:5,xp:200},woodcutting:{level:3,xp:100},fishing:{level:1,xp:0}};
  const humanId=Object.keys(humanStories).find(id=>companionDefs[id].class==='cleric');humanParty().roster[humanId]=makeHuman(humanId);humanParty().active=humanId;snapCompanionsToPlayer();
  for(const e of maps.elderwood.enemies.slice(0,wildernessActivities.initialEnemyCount)){e.alive=false;e.respawnAt=Date.now()+3600000;}
  const nodes=wildernessActivities.resources;
  const visit=i=>{const n=nodes[i],p=safeMapPosition('elderwood',n.x,n.y,14);return {...p,node:i};};
  const point=(x,y)=>({x,y});
  const route=[point(-6400,-1700),visit(0),point(-6500,-2600),point(-4000,-2500),point(-3400,-1200),visit(2),visit(3),visit(4),point(-3400,-1200),point(-2300,-1400),point(480,-2100),point(3800,-2400),visit(5),visit(6),visit(7),point(3800,-2400),point(7000,-2900),visit(11),visit(12),point(7000,-2900),point(7000,315),point(7000,2200),point(4400,2500),point(2100,2200),point(480,2400),point(-2400,1900),point(-3400,2700),visit(8),visit(9),visit(10),point(-3400,2700),point(-5400,2425),visit(1),point(-6400,2300),point(-6200,315)];
  window.activityQA={start:performance.now(),waypoints:route.length,reached:0,kills:[],gathered:[],sales:0,heals:0,collisions:0,snaps:0,maxLag:0,damageTaken:0,distance:0,frames:0,done:false,speed:player.speed,initialLevel:player.level,party:activeCompanions().map(c=>({id:c.id,human:!!c.human}))};
  const finish=finishEnemy;finishEnemy=function(e,...args){const was=e.alive;const result=finish(e,...args);if(was&&!e.alive&&e.wildernessId&&!activityQA.kills.includes(e.wildernessId))activityQA.kills.push(e.wildernessId);return result;};
  const hit=enemyHit;enemyHit=function(v,e){const before=v.hp;const result=hit(v,e);if(v===player)activityQA.damageTaken+=Math.max(0,before-v.hp);return result;};
  const follow=updateCompanions;let previous={x:player.x,y:player.y};
  updateCompanions=function(dt){const before=activeCompanions().map(c=>({x:c.x,y:c.y}));follow(dt);const q=activityQA;if(q.done)return;q.frames++;q.distance+=Math.hypot(player.x-previous.x,player.y-previous.y);previous={x:player.x,y:player.y};for(const [i,c] of activeCompanions().entries()){if(mapPlacementBlocked(mapId,c.x,c.y,14))q.collisions++;if(before[i]&&Math.hypot(c.x-before[i].x,c.y-before[i].y)>30)q.snaps++;q.maxLag=Math.max(q.maxLag,Math.hypot(c.x-player.x,c.y-player.y));}if(mapPlacementBlocked(mapId,player.x,player.y,player.r))q.collisions++;};
  let current=null,lastProgress=performance.now(),best=Infinity,fighting=false;
  const timer=setInterval(()=>{const q=activityQA;if(q.done)return;
   if(mapId!=='elderwood'||activeCompanions().length!==2){q.error='Hero or follower lost';q.done=true;clearInterval(timer);return;}
   if(player.hp<player.max*.6&&bagCount('health_tonic')){useItem('health_tonic');q.heals++;}
   while(bagUnits()>19){const row=player.inventory.find(r=>!['short_sword','light_chainmail','mining_pick','woodcutting_hatchet','fishing_rod','health_tonic'].includes(r.id)&&itemDefs[r.id]?.sell);if(!row)break;sellItem(row.id);q.sales++;}
   const threat=wildernessActivities.enemies.filter(e=>e.alive&&Math.hypot(e.x-player.x,e.y-player.y)<240).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
   if(threat){lockedEnemy=threat;attackHeld=true;tapTarget=null;fighting=true;lastProgress=performance.now();if(skillCooldown<=0)useCombatSkill();return;}
   attackHeld=false;lockedEnemy=null;
   if(fighting){fighting=false;if(current)tapTarget={x:current.x,y:current.y};}
   if(current){const d=Math.hypot(player.x-current.x,player.y-current.y);if(d<8){if(current.node!==undefined){const n=nodes[current.node];if(n.readyAt<=Date.now())gatherNode(n);if(n.readyAt<=Date.now()){q.error='Gather failed '+n.id;q.done=true;clearInterval(timer);return;}q.gathered.push(n.id);}q.reached++;current=null;best=Infinity;lastProgress=performance.now();}else if(d<best-20){best=d;lastProgress=performance.now();}}
   if(!current){current=route.shift();if(!current){q.done=true;q.seconds=(performance.now()-q.start)/1000;q.finalLevel=player.level;q.hp=player.hp;q.coins=player.coins;tapTarget=null;clearInterval(timer);saveGame();return;}tapTarget={x:current.x,y:current.y};}
   if(performance.now()-lastProgress>30000){q.error='Navigation stalled';q.stall={x:player.x,y:player.y,current,tapTarget};q.done=true;clearInterval(timer);}
  },100);
 }''')
 start=time.monotonic()
 while time.monotonic()-start<720:
  state=page.evaluate('activityQA');(out/'progress.json').write_text(json.dumps(state,indent=2));print({k:state[k] for k in ['reached','kills','gathered','collisions','snaps','done']},flush=True)
  if state['done']:break
  page.wait_for_timeout(10000)
 else:raise AssertionError('Activity circuit timed out')
 page.screenshot(path=str(out/'final.png'))
 result={'state':state,'pageErrors':errors};(out/'results.json').write_text(json.dumps(result,indent=2));browser.close()
 assert not errors,errors
 assert not state.get('error') and state['reached']==state['waypoints'],state
 assert len(state['kills'])==8 and len(state['gathered'])==13 and state['collisions']==0,state
 print('PASS: real-time activity circuit, eight distinct kills and thirteen gathers with both followers',flush=True)

const fs=require('fs');
const harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8');
const extra=String.raw`
vm.runInContext(\`
 (()=>{
 const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 const activity=wildernessActivities,m=maps.elderwood;
 check(activity.enemies.length===8&&activity.resources.length===13,'Bounded activity counts');
 check(m.enemies.length===activity.initialEnemyCount+8&&m.gatherNodes.length===activity.initialGatherCount+13,'Append-only indices');
 const ids=activity.resources.map(n=>n.id);check(new Set(ids).size===13,'Unique resource ids');
 setMap('elderwood',480,315,false);const original=snapshotGameState();
 original.mapStates.elderwood.enemies.length=activity.initialEnemyCount;original.mapStates.elderwood.gatherNodes.length=activity.initialGatherCount;
 original.mapStates.elderwood.enemies[0].alive=false;original.mapStates.elderwood.enemies[0].hp=0;original.mapStates.elderwood.enemies[0].lootClaimed=true;
 original.mapStates.elderwood.gatherNodes[0]=Date.now()+25000;
 activity.enemies[0].alive=false;activity.enemies[0].hp=0;activity.resources[0].readyAt=Date.now()+50000;
 applySavedGame(original);
 check(!m.enemies[0].alive&&m.enemies[0].hp===0&&m.enemies[0].lootClaimed,'Original enemy progress reset');
 check(m.gatherNodes[0].readyAt===original.mapStates.elderwood.gatherNodes[0],'Original gathering cooldown reset');
 check(activity.enemies.every(e=>e.alive&&e.hp>0)&&activity.resources.every(n=>n.readyAt===0),'Old saves receive deterministic fresh tail');
 const approaches=[];
 for(const node of activity.resources){const p=safeMapPosition('elderwood',node.x,node.y,14);check(Math.hypot(p.x-node.x,p.y-node.y)<62,'Unusable resource '+node.id);approaches.push(p);}
 for(const e of activity.enemies)approaches.push({x:e.x,y:e.y});
 for(const radius of [12,14,20])for(const raw of approaches){const p=safeMapPosition('elderwood',raw.x,raw.y,radius),path=findWalkingPath('elderwood',{x:480,y:315},p,radius);check(path?.length,'Activity unreachable');let a={x:480,y:315};for(const b of path){check(walkingLine('elderwood',a,b,radius),'Activity path collision');a=b;}}
 player.inventory=[];const savedRandom=Math.random;Math.random=()=>.9;
 for(const n of activity.resources){const tool=gatheringSkillDefs[n.skill].tool;if(!bagCount(tool))addItem(tool);gatheringSkills[n.skill]={xp:450,level:10};const output=gatherOutput(n),before=bagCount(output);gatherNode(n);check(bagCount(output)===before+1,'Gather reward changed '+n.id);check(n.readyAt>Date.now()&&n.readyAt<=Date.now()+30000,'Cooldown changed');const count=bagCount(output);gatherNode(n);check(bagCount(output)===count,'Repeated gather before cooldown');}
 Math.random=savedRandom;
 const enemy=activity.enemies[0],coins=player.coins,reward=enemyRewards(enemy);finishEnemy(enemy,player.class);
 check(player.coins===coins+reward.coins&&!enemy.alive&&enemy.respawnAt>Date.now(),'Existing enemy reward/respawn rules');
 const saved=snapshotGameState(),tailIndex=activity.initialEnemyCount;
 saveGame();const disk=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY));
 check(disk[activeSlotId].state.mapStates.elderwood.enemies[tailIndex].alive===false,'Death checkpoint not durable');
 check(disk[activeSlotId].state.mapStates.elderwood.gatherNodes.at(-1)>Date.now(),'Gather checkpoint not durable');
 const text=ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId),decoded=ThornhavenCloudSaveCore.parse(text);ThornhavenCloudSaveCore.assertRestorableMapLayout(decoded,maps);
 const legacyMaps={...maps,elderwood:{...m,enemies:m.enemies.slice(0,activity.initialEnemyCount),gatherNodes:m.gatherNodes.slice(0,activity.initialGatherCount)}};
 let refused=false;try{ThornhavenCloudSaveCore.assertRestorableMapLayout(decoded,legacyMaps);}catch(e){refused=true;}check(refused,'Older client must refuse lossy appended content');
 const isolated=new Map(),S=ThornhavenCloudSaveCore.SLOT_KEY,A=ThornhavenCloudSaveCore.ACTIVE_SLOT_KEY;
 isolated.set(S,JSON.stringify({slot1:{id:'slot1',updated:1,state:original}}));isolated.set(A,'slot1');
 const storage={getItem:k=>isolated.get(k)??null,setItem:(k,v)=>isolated.set(k,String(v)),removeItem:k=>isolated.delete(k)};
 const beforeImport=storage.getItem(S);ThornhavenCloudSaveCore.restore(storage,text,{confirmed:true,allowOlder:true,expectedCurrent:beforeImport});
 check(JSON.parse(storage.getItem(S))[activeSlotId].state.mapStates.elderwood.gatherNodes.at(-1)===saved.mapStates.elderwood.gatherNodes.at(-1),'Import cooldown persistence');
 check(ThornhavenCloudSaveCore.parse(ThornhavenCloudSaveCore.recoveryText(storage)).slots.slot1.state.mapStates.elderwood.enemies.length===activity.initialEnemyCount,'Import recovery retains old layout');

 applySavedGame(original);check(activity.enemies[0].alive&&activity.resources[0].readyAt===0,'Slot isolation');
 applySavedGame(saved);check(!activity.enemies[0].alive&&activity.resources[0].readyAt===saved.mapStates.elderwood.gatherNodes[activity.initialGatherCount],'Tail load/cooldown loss');
 enemy.respawnAt=Date.now()-1;Object.assign(player,safeMapPosition('elderwood',enemy.spawnX-60,enemy.spawnY,14));window.jarvisPaused=false;frame(last+16);check(!enemy.alive,'Enemy respawned near hero');
 Object.assign(player,{x:-6200,y:315});frame(last+16);check(enemy.alive&&enemy.hp===enemy.maxHp&&enemy.respawnAt===0&&!enemy.lootClaimed,'Far respawn failed');
 console.log('ACTIVITY_METRICS '+JSON.stringify({enemies:activity.enemies.length,resources:activity.resources.length,level:regionCombatLevel('elderwood'),respawnMs:m.respawnMs,resourceIds:ids,coreCounts:[activity.initialEnemyCount,activity.initialGatherCount],rewards:enemyRewards(enemy),appendOnly:true,oldSaveMigration:true,slotIsolation:true,cooldownPersistence:true,cloudRoundtrip:true,reachabilityQueries:approaches.length*3}));
 window.__activityFixture=saved;
 })();
\`,root);
fs.writeFileSync('/tmp/wilderness-activity-fixture.json',JSON.stringify(root.__activityFixture));
`;
new Function('require',harness+extra.replaceAll('\\`','`'))(require);
// Cold startup: the core loader runs before extension scripts. Ensure the
// extension restores its own saved tail without resetting/reapplying core progress.
const state=JSON.parse(fs.readFileSync('/tmp/wilderness-activity-fixture.json','utf8'));
const seeded=harness.slice(0,harness.indexOf('if(root.runProbe)')).replace('const storage=new Map();',`const storage=new Map([['emberfall_character_slots_v1',${JSON.stringify(JSON.stringify({slot1:{id:'slot1',name:state.player.name,class:state.player.class,level:state.player.level,updated:Date.now(),state}}))}],['emberfall_active_character_slot_v1','slot1']]);`);
new Function('require',seeded+`vm.runInContext("if(wildernessActivities.enemies[0].alive||wildernessActivities.resources[0].readyAt<=Date.now())throw Error('Cold tail restore failed');",root);`)(require);
console.log('PASS: cold-start appended enemy and resource progress restored');

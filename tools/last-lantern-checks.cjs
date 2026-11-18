'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Reuse the full-game DOM/canvas fixture, not a substitute quest implementation.
const fixture=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8').split('const probe=')[0];
const root=new Function('require',fixture+`return root;`)(require);
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(m[1].includes('application/'))continue;
 const src=m[1].match(/src="([^"]+)"/);
 vm.runInContext(src?fs.readFileSync('app/src/main/assets/'+src[1],'utf8'):m[2],root);
}
root.assert=assert;root.TextEncoder=TextEncoder;
vm.runInContext(`
 hasStarted=true;titleMenuActive=false;player.name='LanternQA';player.level=13;syncHeroStats();companions=[];
 const original=snapshotGameState(),briarBefore=JSON.stringify(townQuestState.briar_hollow);
 const m=maps.last_lantern;
 assert(!questCatalog().some(q=>q.id==='last_lantern'));
 assert(!maps.briarhollow.worldObjects.some(o=>o.id==='lantern_road'));
 assert(!mapConnections.briarhollow.exits.some(e=>e.to==='last_lantern'));
 assert(!worldPositions.last_lantern);assert(!vampireBestiaryText().includes('Last Lantern'));assert(!vampireBestiaryText().includes('Captain Veyr'));assert.equal(setMap('last_lantern',80,490,false),false);
 const beforeClosedTravel=mapId;travelTo('last_lantern');showAtlasDetails('last_lantern');assert.equal(mapId,beforeClosedTravel);assert(!document.getElementById('atlasSelection').textContent.includes('Lantern'));
 const savedQuestFlags=structuredClone(townQuestState);townQuestState.briar_hollow={claimed:true};townQuestState._camp={claimed:true,stage:3};townQuestState._vampire={accepted:true};townQuestState._visited={last_lantern:true};player.level=99;assert.equal(setMap('last_lantern',80,490,false),false);assert(!questCatalog().some(q=>q.id==='last_lantern'));townQuestState=savedQuestFlags;player.level=13;
 townQuestState._lastLanternAccess={revealed:true};
 assert.equal(m.enemies.length,4);assert.equal(m.npcs.length,0);assert(!m.town&&!m.interior&&!m.respawnMs);
 for(const o of m.worldObjects){assert(!mapPlacementBlocked('last_lantern',o.x,o.y,14),o.id+' blocked');assert(findWalkingPath('last_lantern',{x:80,y:490},o,14),o.id+' unreachable');}
 for(const e of m.enemies){assert(!mapPlacementBlocked('last_lantern',e.x,e.y,14));assert(findWalkingPath('last_lantern',{x:80,y:490},e,14));}
 assert(mapPlacementBlocked('last_lantern',315,160));assert(!mapPlacementBlocked('last_lantern',315,315));
 assert(mapPlacementBlocked('last_lantern',635,150));assert(!mapPlacementBlocked('last_lantern',635,315));
 assert(!walkingLine('last_lantern',{x:280,y:180},{x:350,y:180},14));
 assert(findWalkingPath('briarhollow',{x:570,y:315},{x:650,y:315},14),'Entrance disconnected from remembrance stone');
 assert(!mapPlacementBlocked('briarhollow',650,315,14));
 setMap('briarhollow',650,315,false);interact();adventureChoices[0].action();
 assert.equal(mapId,'last_lantern');assert(townQuestState.last_lantern.accepted);
 const use=id=>{const o=m.worldObjects.find(o=>o.id===id);player.x=o.x;player.y=o.y;return worldObjectInteract(o);};
 const rewardBefore=player.coins;use('lantern_light');assert(!townQuestState.last_lantern.claimed);assert.equal(player.coins,rewardBefore);
 use('lantern_register');const intermediate=snapshotGameState();assert(intermediate.townQuestState.last_lantern.register);
 m.enemies[0].hp-=3;const retreatHp=m.enemies[0].hp;m.enemies[0].windup=.5;
 use('lantern_return');assert.equal(mapId,'briarhollow');interact();adventureChoices[0].action();assert.equal(mapId,'last_lantern');assert.equal(m.enemies[0].hp,retreatHp);assert.equal(m.enemies[0].windup,0);
 finishEnemy(m.enemies[0],player.class);assert(townQuestState.last_lantern.yard);assert(!m.enemies[0].alive);
 const partial=snapshotGameState();applySavedGame(original);assert(m.enemies.every(e=>e.alive),'slot leak');assert(!townQuestState.last_lantern);
 applySavedGame(partial);assert(!m.enemies[0].alive);assert(m.enemies.slice(1).every(e=>e.alive));assert(townQuestState.last_lantern.register);
 const captain=m.enemies[3];assert.equal(enemyPattern(captain).label,'CRIMSON SWEEP');assert.equal(encounterLevel(captain,22,13),24);assert.equal(encounterLevel(m.enemies[1],22,13),22);
 for(const e of m.enemies.filter(e=>e.alive))finishEnemy(e,player.class);
 assert(townQuestState.last_lantern.cleared);assert(townQuestState.last_lantern.captain);
 use('lantern_light');assert(!townQuestState.last_lantern.claimed,'evidence gate');
 use('lantern_bell');use('lantern_inventory');const coins=player.coins,xp=player.xp;
 use('lantern_light');assert(townQuestState.last_lantern.claimed);assert.equal(player.coins,coins+65);assert.equal(player.xp,xp+70);
 const complete=snapshotGameState();use('lantern_light');assert.equal(player.coins,coins+65);assert.equal(player.xp,xp+70);
 use('lantern_return');assert.equal(mapId,'briarhollow');assert.equal(JSON.stringify(townQuestState.briar_hollow),briarBefore);
 setMap('last_lantern',80,490,false);assert(m.enemies.every(e=>!e.alive));
 applySavedGame(original);applySavedGame(complete);assert(m.enemies.every(e=>!e.alive));assert(townQuestState.last_lantern.claimed);
 const core=ThornhavenCloudSaveCore,row={id:'slot1',updated:100,state:complete};
 const decoded=core.parse(core.encode({slot1:row},'slot1',100));assert.equal(core.assertRestorableMapLayout(decoded,maps),true);
 for(const key of ['accepted','claimed','cleared','bell','register','inventory','yard','nave','stalker','captain']){const bad=structuredClone(row);bad.state.townQuestState.last_lantern[key]='false';assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
 const gated=structuredClone(complete);delete gated.townQuestState._lastLanternAccess;applySavedGame(gated);assert.equal(mapId,'briarhollow');assert(townQuestState.last_lantern.claimed);assert(!questCatalog().some(q=>q.id==='last_lantern'));assert(!maps.briarhollow.worldObjects.some(o=>o.id==='lantern_road'));
 townQuestState._lastLanternAccess={revealed:true};setMap('last_lantern',80,490,false);assert(m.enemies.every(e=>!e.alive));const preservedCoins=player.coins;use('lantern_light');assert.equal(player.coins,preservedCoins);
 const badAccess=structuredClone(row);badAccess.state.townQuestState._lastLanternAccess={revealed:'true'};assert.throws(()=>core.parse(core.encode({slot1:badAccess},'slot1',100)));
 const legacy=structuredClone(original);delete legacy.mapStates.last_lantern;delete legacy.townQuestState.last_lantern;
 applySavedGame(legacy);assert(m.enemies.every(e=>e.alive));assert(!townQuestState.last_lantern);assert(!mapPlacementBlocked(mapId,player.x,player.y,player.r));
 for(const town of ['ashvale','sunmere','brackenford','stonewatch']){setMap(town,480,320,false);assert(!enemies.length);assert(npcs.length>0);}
 assert.equal(maps.veilhaven.npcs.filter(n=>n.vampireId).length,3);assert(!maps.veilhaven.enemies.length);
`,root);
console.log('PASS Last Lantern: reachable entrance/objects/enemies, shared walls and doors, independent quest, reward gates, no duplicates, partial/completed/legacy save restoration, slot isolation, cloud validation, scaling and town/sanctuary safety. Mock runtime; browser combat checked separately.');

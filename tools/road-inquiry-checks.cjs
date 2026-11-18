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
 hasStarted=true;titleMenuActive=false;player.name='InquiryQA';companions=[];
 const initial=snapshotGameState(),core=ThornhavenCloudSaveCore;
 const select=label=>{const c=adventureChoices.find(c=>c.label===label);assert(c,'Missing '+label);c.action();};
 const visitSister=()=>{const n=maps.stonewatch.npcs.find(n=>n.name==='Sister Elowen');setMap('stonewatch',n.x,n.y,false);player.x=n.x;player.y=n.y;openNpcConversation(n);select('Ask about the uncounted passengers');};
 const use=id=>{const mid=id==='inquiry_road'||id==='inquiry_copy'?'stonewatchroad':'sunharbor';const o=maps[mid].worldObjects.find(o=>o.id===id);setMap(mid,o.x,o.y,false);player.x=o.x;player.y=o.y;worldObjectInteract(o);};
 const roundtrip=()=>{const data=snapshotGameState(),row={id:'slot1',updated:100,state:data};assert(core.parse(core.encode({slot1:row},'slot1',100)));applySavedGame(structuredClone(data));return data;};
 assert(!vampireRevealKnown());assert(!questCatalog().some(q=>q.id==='night_visitor'));assert.equal(vampireBestiaryText(),'');assert.equal(setMap('veilhaven',480,480,false),false);assert.equal(setMap('last_lantern',80,490,false),false);
 const vampires=Object.values(maps).flatMap(m=>m.enemies).filter(e=>e.kind==='vampire'||e.catalogType==='vampire_hunter');assert(vampires.length>=13);assert(vampires.every(e=>!e.alive));player.level=40;setMap('whisperwood',480,315,false);const dormant=maps.whisperwood.enemies.find(e=>e.kind==='vampire');assert.equal(dormant.hp,dormant.maxHp,'dormant scaling lost health');player.level=1;
 for(const [mid,m] of Object.entries(maps))for(const [i,e] of m.enemies.entries())if(e.kind==='vampire'||e.catalogType==='vampire_hunter')assert.equal(initial.mapStates[mid].enemies[i].alive,true,'canonical save alive');
 for(const mid of ['stonewatchroad','sunharbor'])for(const o of maps[mid].worldObjects.filter(o=>o.id.startsWith('inquiry_'))){assert(!mapPlacementBlocked(mid,o.x,o.y,14),o.id+' collision');assert(findWalkingPath(mid,{x:480,y:315},o,14),o.id+' unreachable');}
 visitSister();assert(!adventureChoices.some(c=>c.label==='Begin comparing the records'));use('inquiry_road');assert(!townQuestState.road_inquiry.road);
 player.level=99;townQuestState.briar_hollow={claimed:true};visitSister();assert(!adventureChoices.some(c=>c.label==='Begin comparing the records'));assert(!vampireRevealKnown());
 deepQuestDone=true;done=true;huntRewarded=true;hasFourfoldKey=true;hasSigil=true;shrineRewarded=true;
 for(const m of ['mosslight','shrine_rootmaze'])maps[m].chest.open=true;maps.shrine_heart.treasure.opened=true;
 const eligible=snapshotGameState();
 for(const method of ['paper','witness']){
  applySavedGame(structuredClone(eligible));visitSister();select('Begin comparing the records');assert(townQuestState.road_inquiry.accepted);roundtrip();
  use('inquiry_road');assert(townQuestState.road_inquiry.road);roundtrip();use('inquiry_harbor');assert(townQuestState.road_inquiry.harbor);roundtrip();
  visitSister();select(method==='paper'?'Trace the carrier’s paperwork':'Read a protected witness account');roundtrip();
  use(method==='paper'?'inquiry_account':'inquiry_copy');assert(!townQuestState.road_inquiry.corroborated);
  use(method==='paper'?'inquiry_copy':'inquiry_account');assert(townQuestState.road_inquiry.corroborated);roundtrip();
  visitSister();const reveal=adventureChoices.find(c=>c.label==='Compare the clinical archive').action;
  const before=snapshotGameState(),coins=player.coins,xp=player.xp;
  applySavedGame(structuredClone(before));reveal();assert(!vampireRevealKnown(),'stale character callback');visitSister();select('Compare the clinical archive');assert(vampireRevealKnown());assert(townQuestState.road_inquiry.revealed);assert(questCatalog().some(q=>q.id==='night_visitor'));assert(vampireBestiaryText().includes('VAMPIRE'));assert(maps.veilhaven.hint.includes('Vampire'));
  assert.equal(player.coins,coins);assert.equal(player.xp,xp);reveal();assert.equal(player.coins,coins);
  const complete=roundtrip();assert(vampireRevealKnown());setMap('last_lantern',80,490,false);assert.equal(mapId,'last_lantern');assert(enemies.every(e=>e.alive));
  setMap('veilhaven',480,480,false);assert.equal(mapId,'veilhaven');assert.equal(enemies.length,0);
  const row={id:'slot1',updated:100,state:complete};for(const key of ['version','accepted','road','harbor','method','corroborated','revealed','legacy']){const bad=structuredClone(row);bad.state.townQuestState.road_inquiry[key]='bad';assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
 }
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){applySavedGame(structuredClone(eligible));player.class=cls;player.gender=gender;visitSister();select('Begin comparing the records');assert(townQuestState.road_inquiry.accepted);assert(!vampireRevealKnown());}
 // Explicit historical knowledge, not level or accepted quest, migrates once.
 for(const flags of [{_vampire:{clues:['mosslight']}},{_vampire:{choice:'hunt',complete:true}},{_vampire:{turned:true}},{last_lantern:{register:true}},{briar_hollow:{claimed:true}},{_visited:{veilhaven:true}}]){const old=structuredClone(initial);delete old.townQuestState.road_inquiry;Object.assign(old.townQuestState,flags);applySavedGame(old);assert(vampireRevealKnown());assert(townQuestState.road_inquiry.legacy);for(const k of Object.keys(flags))for(const field of Object.keys(flags[k]))assert.equal(JSON.stringify(townQuestState[k][field]),JSON.stringify(flags[k][field]));}
 const old=structuredClone(initial);delete old.townQuestState.road_inquiry;old.townQuestState._vampire={accepted:true,clues:['whisperwood']};old.player.level=50;applySavedGame(old);assert(!vampireRevealKnown());assert.equal(townQuestState._vampire.clues[0],'whisperwood');
 applySavedGame(structuredClone(initial));assert(!vampireRevealKnown());assert(vampires.filter(e=>e.kind!=='vampire'||!e.lanternRaider).every(e=>!e.alive));assert(!questCatalog().some(q=>q.id==='last_lantern'||q.id==='veil_counsel'));
 console.log('PASS road inquiry: earned prerequisites, both exclusive evidence paths, in-person reveal, all-stage saves/cloud, stale callbacks, canonical enemy indices, legacy knowledge migration and spoiler gates.');
`,root);

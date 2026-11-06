#!/usr/bin/env node
'use strict';
// Refuse malformed/unrecognized regions before mutating local saves. The
// game checks maps[mapId] via a plain object, so inherited property names
// can otherwise crash map setup instead of selecting the restored region.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const fs=require('node:fs');
// The packaged game creates outdoor maps from the complete 9x9 worldGrid.
// Do not infer the map catalog from the smaller initial maps object.
// Story sanctums are added later through storyDungeons, not worldGrid.
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const gridMatch=game.match(/const worldGrid=(\[[\s\S]*?\n\]);/);
assert(gridMatch,'Actual packaged world grid missing');
const grid=JSON.parse(gridMatch[1]);
assert.equal(grid.length,9);
assert(grid.every(row=>row.length===9));
const regions=[...new Set([...grid.flat(),
 'ashvale_home','brackenford_home','frontier_quarry','memory_valley',
 'shrine_heart','shrine_rootmaze','stonewatch_home','sunmere_home',
 'veilhaven','wayfarers_camp',
 'embercrypt','tidevault','stormspire','hollowcrown','worldsend'
])];
assert.equal(regions.length,96,'All generated regions, interiors and story sanctums must be covered');
const row=mapId=>({id:'slot1',updated:1000,name:'Map Keeper',class:'warrior',level:3,state:{
 player:{name:'Map Keeper',class:'warrior',level:3,xp:0,coins:4,inventory:[],hp:30,max:40,x:300,y:200,speed:3},
 mapId,companions:[],mapStates:{},townQuestState:{}}});
const backup=mapId=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:row(mapId)}});
const original=JSON.stringify({slot1:row('ashvale')});
for(const bad of ['not_a_real_region','__proto__','constructor','toString','',null,13,'Ashvale']){
 const raw=backup(bad);
 assert.throws(()=>core.parse(raw),/region|map/i,'Reject unknown region '+String(bad));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(bad)})).unreadable,true,
  'Unknown local region must be flagged before a restore: '+String(bad));
 const saved=new Map([[core.SLOT_KEY,original],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:key=>saved.get(key)??null,
  setItem:(key,val)=>{writes++;saved.set(key,String(val));},
  removeItem:key=>{writes++;saved.delete(key);}};
 assert.throws(()=>core.restore(storage,raw,{confirmed:true,allowOlder:true}),/region|map/i);
 assert.equal(writes,0,'Refused import must not overwrite a character or recovery copy');
 assert.equal(saved.get(core.SLOT_KEY),original);
}
for(const region of regions){
 assert.doesNotThrow(()=>core.parse(backup(region)),'Current region '+region);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(region)})).unreadable,false,
  'Current region must remain importable: '+region);
}
const storageMap=new Map([[core.SLOT_KEY,original],[core.ACTIVE_SLOT_KEY,'slot1']]);
const storage={getItem:key=>storageMap.get(key)??null,
 setItem:(key,val)=>storageMap.set(key,String(val)),
 removeItem:key=>storageMap.delete(key)};
core.restore(storage,backup('wayfarers_camp'),{confirmed:true,allowOlder:true});
assert.equal(JSON.parse(storageMap.get(core.SLOT_KEY)).slot1.state.mapId,'wayfarers_camp');
assert.equal(core.parse(core.recoveryText(storage)).slots.slot1.state.mapId,'ashvale');
console.log('PASS: 8 unknown/inherited regions refused without writes; all packaged outdoor/interior regions and recovery import preserved.');

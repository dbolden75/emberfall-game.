#!/usr/bin/env node
'use strict';
// Refuse malformed/unrecognized regions before mutating local saves. The
// game checks maps[mapId] via a plain object, so inherited property names
// can otherwise crash map setup instead of selecting the restored region.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const regions=[
 'ashvale','ashvale_home','brackenford','brackenford_home','crowfield','emberdeep',
 'frontier_outpost','frontier_quarry','frostmarch','glassridge','greenhollow',
 'highmoor','memory_valley','mosslight','redfen','shrine_heart',
 'shrine_rootmaze','stonewatch','stonewatch_home','stonewatchroad','sunharbor',
 'sunmere','sunmere_home','veilhaven','wayfarers_camp','whisperwood','willowfen'
];
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
console.log('PASS: 8 unknown/inherited regions refused without writes; 27 actual regions and recovery import preserved.');

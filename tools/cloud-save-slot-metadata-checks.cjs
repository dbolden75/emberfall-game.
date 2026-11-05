#!/usr/bin/env node
'use strict';
// Mocked storage/API validation, not a device or Google Play upgrade test.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const makeState=()=>({player:{name:'ActualHero',class:'warrior',level:8,coins:50,xp:17,inventory:[{id:'copper_ore',count:3}]},mapId:'ashvale',mapStates:{},townQuestState:{},companions:[]});
const makeSlots=()=>({slot1:{id:'slot1',name:'ActualHero',class:'warrior',level:8,updated:1234,state:makeState()}});
const good=core.encode(makeSlots(),'slot1',123456);
assert.equal(core.parse(good).slots.slot1.state.player.level,8);
const saved=new Map([[core.SLOT_KEY,JSON.stringify(makeSlots())],[core.ACTIVE_SLOT_KEY,'slot1']]);
const storage={getItem:k=>saved.has(k)?saved.get(k):null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};
for(const [field,value] of [['name','NotMyHero'],['class','mage'],['level',500],['level','8']]){
 const changed=JSON.parse(good);
 changed.slots.slot1[field]=value;
 const backup=JSON.stringify(changed),before=storage.getItem(core.SLOT_KEY);
 assert.throws(()=>core.parse(backup),/character listing/,`Corrupt ${field} metadata must be rejected`);
 assert.throws(()=>core.restore(storage,backup,{confirmed:true,expectedCurrent:before}),/character listing/);
 assert.equal(storage.getItem(core.SLOT_KEY),before,'Rejected import must not replace character progress');
 assert.equal(storage.getItem(core.ACTIVE_SLOT_KEY),'slot1','Rejected import must not switch characters');
 assert.equal(storage.getItem(core.RECOVERY_KEY),null,'Rejected import must not overwrite recovery data');
}
const legacy=JSON.parse(good);
for(const field of ['name','class','level'])delete legacy.slots.slot1[field];
assert.doesNotThrow(()=>core.parse(JSON.stringify(legacy)), 'Missing historical header fields remain supported');
assert.equal(core.parse(JSON.stringify(legacy)).slots.slot1.state.player.name,'ActualHero');
console.log('PASS: character selector metadata must agree with imported gameplay, invalid imports leave storage untouched; legacy headers remain optional.');

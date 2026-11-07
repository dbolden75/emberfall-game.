#!/usr/bin/env node
'use strict';
// Imported hero appearance should not silently revert to class default.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const baseline={id:'slot1',updated:123456,name:'Sentinel',class:'warrior',level:3,state:{
 player:{name:'Sentinel',class:'warrior',gender:'female',level:3,coins:20,xp:8,x:450,y:400,hp:80,max:80,speed:190,inventory:[]},
 mapId:'ashvale',mapStates:{ashvale:{enemies:[]}},companions:[],townQuestState:{}
}};
function payload(gender,omitted=false){
 const slot=structuredClone(baseline);
 if(omitted)delete slot.state.player.gender;else slot.state.player.gender=gender;
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:123457,activeSlot:'slot1',slots:{slot1:slot}});
}
for(const gender of ['male','female',null]){
 const input=payload(gender);
 assert.equal(core.parse(input).slots.slot1.state.player.gender,gender);
 assert.equal(core.readLocal(JSON.stringify(JSON.parse(input).slots)).unreadable,false);
}
assert.doesNotThrow(()=>core.parse(payload(undefined,true)),'Legacy save without gender should remain supported');
assert.equal(core.readLocal(JSON.stringify(JSON.parse(payload(undefined,true)).slots)).unreadable,false);
for(const gender of ['invalid','FEMALE',false,0,{},['female']]){
 const input=payload(gender);
 assert.throws(()=>core.parse(input),/character gender/i,`invalid gender ${JSON.stringify(gender)} should not reset appearance`);
 assert.equal(core.readLocal(JSON.stringify(JSON.parse(input).slots)).unreadable,true);
 const original=JSON.stringify({slot1:baseline});
 const m=new Map([[core.SLOT_KEY,original],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'older recovery']]);
 const writes=[];
 const store={getItem:key=>m.has(key)?m.get(key):null,
  setItem:(key,value)=>{writes.push(key);m.set(key,String(value))},
  removeItem:key=>{writes.push(key);m.delete(key)}};
 assert.throws(()=>core.restore(store,input,{confirmed:true,allowOlder:true}),/character gender/i);
 assert.deepEqual(writes,[],'Corrupt import cannot overwrite saved data');
 assert.equal(store.getItem(core.SLOT_KEY),original);
 assert.equal(store.getItem(core.RECOVERY_KEY),'older recovery');
}
console.log('PASS: 4 valid/legacy gender states preserved; 6 malformed imports and local rows rejected without writes');

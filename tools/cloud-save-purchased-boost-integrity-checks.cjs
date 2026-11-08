#!/usr/bin/env node
'use strict';
// Regression: malformed purchased boosts must not turn into unlimited speed or be silently lost.
const assert=require('node:assert/strict');
const core=require(process.env.THORNHAVEN_CLOUD_CORE||'../app/src/main/assets/cloud-save-core.js');
const base={id:'slot1',updated:123456,name:'Sentinel',class:'warrior',level:3,state:{
 player:{name:'Sentinel',class:'warrior',gender:'female',level:3,coins:20,xp:8,x:450,y:400,hp:80,max:80,speed:190,inventory:[]},
 mapId:'ashvale',mapStates:{ashvale:{enemies:[]}},companions:[],townQuestState:{}
}};
const kinds=['_builderBoost','_xpBoost'];
function backup(kind,boost,omit=false){
 const slot=structuredClone(base);
 if(!omit)slot.state.townQuestState[kind]=boost;
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:123457,activeSlot:'slot1',slots:{slot1:slot}});
}
for(const kind of kinds){
 for(const [boost,omit] of [[null,true],[null,false],[{seconds:0},false],[{seconds:900},false],[{seconds:14.75},false]]){
  const input=backup(kind,boost,omit);
  assert.doesNotThrow(()=>core.parse(input),`${kind} valid/historical boost should restore`);
  assert.equal(core.readLocal(JSON.stringify(JSON.parse(input).slots)).unreadable,false);
 }
 const invalid=[{seconds:'Infinity'},{seconds:'60'},{seconds:1e308},{seconds:-1},{seconds:null},{seconds:[]},{},[],'900'];
 for(const boost of invalid){
  const input=backup(kind,boost);
  assert.throws(()=>core.parse(input),/town quest progress/i,`${kind} ${JSON.stringify(boost)} should not be accepted`);
  assert.equal(core.readLocal(JSON.stringify(JSON.parse(input).slots)).unreadable,true);
  const original=JSON.stringify({slot1:base});
  const values=new Map([[core.SLOT_KEY,original],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'older recovery']]);
  const writes=[];
  const store={getItem:key=>values.has(key)?values.get(key):null,
   setItem:(key,value)=>{writes.push(key);values.set(key,String(value))},
   removeItem:key=>{writes.push(key);values.delete(key)}};
  assert.throws(()=>core.restore(store,input,{confirmed:true,allowOlder:true}),/town quest progress/i);
  assert.deepEqual(writes,[],'Rejected restore must not touch local storage');
  assert.equal(store.getItem(core.SLOT_KEY),original);
  assert.equal(store.getItem(core.RECOVERY_KEY),'older recovery');
 }
}
assert.equal(1e308-0.25,1e308,'Oversized boost timer can never decrement in real arithmetic');
console.log('PASS: 10 valid/legacy boost cases, 18 malformed purchased boost cases rejected before any storage writes');

#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const core = require('../app/src/main/assets/cloud-save-core.js');
const makeBackup = (coins) => ({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{
 slot1:{id:'slot1',updated:2000,name:'Test',class:'warrior',level:2,state:{
  player:{name:'Test',class:'warrior',level:2,coins,inventory:[]},mapId:'ashvale',mapStates:{},companions:[],townQuestState:{}
 }}
}});
function storage(existing){
 const map=new Map([[core.SLOT_KEY,existing],[core.ACTIVE_SLOT_KEY,'slot1']]);
 const writes=[];
 return {writes,getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>{writes.push(key);map.set(key,String(value));},
  removeItem:key=>{writes.push(key);map.delete(key);}};
}
const valid=[0,1,2500,Number.MAX_SAFE_INTEGER];
for(const coins of valid){
 const data=makeBackup(coins),text=JSON.stringify(data);
 assert.equal(core.parse(text).slots.slot1.state.player.coins,coins);
 assert.equal(core.readLocal(JSON.stringify(data.slots)).unreadable,false);
}
const bad=['100',null,1.25,-1,1e308,Number.MAX_SAFE_INTEGER+1];
for(const coins of bad){
 const data=makeBackup(coins),text=JSON.stringify(data);
 assert.throws(()=>core.parse(text),/character progress/i,`Corrupt money ${JSON.stringify(coins)} cannot be imported`);
 assert.equal(core.readLocal(JSON.stringify(data.slots)).unreadable,true,`Corrupt local money ${JSON.stringify(coins)} must be detected`);
 const existing=JSON.stringify(makeBackup(100).slots),store=storage(existing);
 assert.throws(()=>core.restore(store,text,{confirmed:true,allowOlder:true}),/character progress/i);
 assert.deepEqual(store.writes,[],'Rejected backup must cause zero writes');
 assert.equal(store.getItem(core.SLOT_KEY),existing,'Existing hero must be unchanged');
}
console.log(`PASS: ${valid.length} valid/historical coin amounts and ${bad.length} corrupt amounts; local and zero-write restore checks`);

#!/usr/bin/env node
'use strict';
// A malformed Cloud Save "defeated" counter can bypass the First Hunt after
// a single enemy kill. Rejected imports must never alter existing saved heroes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
for(const fragment of [
 'defeated=Number(save.defeated)||0',
 "if(mapId==='whisperwood'&&!done)defeated++",
 "if(mapId==='whisperwood'&&defeated>=3&&!done)"
])assert(html.includes(fragment),'First Hunt gameplay path changed: '+fragment);
// Reproduce the exploit with the same expressions that run in the shipped game.
const bypass=vm.runInNewContext("let defeated=Number('Infinity')||0,done=false;"+
 "function kill(){if(!done)defeated++;if(defeated>=3&&!done)done=true}"+
 "kill();({defeated,done})");
assert.equal(bypass.defeated,Infinity);
assert.equal(bypass.done,true,'Corrupt saved counter prematurely completes the First Hunt');
function slot(defeated){
 const state={
  player:{name:'Traveler',class:'warrior',level:3,coins:12,xp:5,hp:20,max:20,
   x:400,y:400,speed:180,inventory:[]},
  mapId:'whisperwood',companions:[],mapStates:{whisperwood:{enemies:[]}},
  townQuestState:{}
 };
 if(defeated!==undefined)state.defeated=defeated;
 return {id:'slot1',name:'Traveler',class:'warrior',level:3,updated:100,state};
}
function payload(value){return JSON.stringify({format:'thornhaven-save',schema:1,
 createdAt:100,activeSlot:'slot1',slots:{slot1:slot(value)}});}
const old=JSON.stringify({slot1:slot(1)});
let checks=4;
for(const bad of ['Infinity','3','false','',-1,-3,2.5,1e100,{count:3},[],true,false]){
 assert.throws(()=>core.parse(payload(bad)),/Invalid saved quest or home progress/);checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:slot(bad)})).unreadable,true);checks++;
 const records=new Map([[core.SLOT_KEY,old],[core.RECOVERY_KEY,'original recovery']]);
 let writes=0;
 const storage={getItem:k=>records.get(k)??null,
  setItem:(k,v)=>{writes++;records.set(k,v)},
  removeItem:k=>{writes++;records.delete(k)}};
 assert.throws(()=>core.restore(storage,payload(bad),{confirmed:true,allowOlder:true}),
  /Invalid saved quest or home progress/);checks++;
 assert.equal(writes,0);checks++;
 assert.equal(records.get(core.SLOT_KEY),old);checks++;
 assert.equal(records.get(core.RECOVERY_KEY),'original recovery');checks++;
}
for(const good of [undefined,null,0,1,2,3,4,999]){
 assert.doesNotThrow(()=>core.parse(payload(good)));checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:slot(good)})).unreadable,false);checks++;
}
console.log('PASS '+checks+' First Hunt Cloud Save regression assertions');

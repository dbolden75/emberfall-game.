#!/usr/bin/env node
'use strict';
// The live normalizeHouseStorage() imports only four home IDs. An inventory
// stored in a future home's chest would be silently discarded after import.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const row=()=>({id:'slot1',updated:1000,name:'Keeper',class:'warrior',level:3,state:{
 player:{name:'Keeper',class:'warrior',level:3,xp:0,coins:5,inventory:[],hp:30,max:40,x:300,y:200,speed:3},
 mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[]}},townQuestState:{},
 houseStorage:{ashvale:{front_chest:[{id:'copper_ore',count:2}],side_chest:[]}}}});
const backup=(r)=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:r}});
const original=row(),stored=JSON.stringify({slot1:original});
let checks=0;
for(const id of ['bellwether','futurehome']){
 for(const chest of ['front_chest','side_chest']){
  const incoming=row(); incoming.state.houseStorage[id]={[chest]:[{id:'rare_sword',count:1}]};
  const payload=backup(incoming);
  assert.throws(()=>core.parse(payload),/home|chest|storage/i,`${id}/${chest} future inventory not silently lost`);checks++;
  assert.equal(core.readLocal(JSON.stringify({slot1:incoming})).unreadable,true);checks++;
  const data=new Map([[core.SLOT_KEY,stored],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'do-not-change']]);
  let writes=0;const disk={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,v)},removeItem:k=>{writes++;data.delete(k)}};
  assert.throws(()=>core.restore(disk,payload,{confirmed:true,allowOlder:true}),/home|chest|storage/i);checks++;
  assert.equal(writes,0);checks++;assert.equal(data.get(core.SLOT_KEY),stored);checks++;
  assert.equal(data.get(core.RECOVERY_KEY),'do-not-change');checks++;
 }
}
for(const storage of [
 undefined, {},
 {ashvale:{front_chest:[],side_chest:[]},sunmere:{front_chest:[{id:'copper_ore',count:1}]}},
 {brackenford:{front_chest:[{id:'copper_ore',count:1}]},front_chest:[{id:'copper_ore',count:1}]},
 {bellwether:{front_chest:[],side_chest:[]}},
 {unknownMetadata:{story:'legacy'}},
 {ashvale:{front_chest:[{id:'copper_ore',count:1}],decor:'safe'},unusedNote:'preserve'},
 ]){
 const incoming=row();incoming.state.houseStorage=storage;
 assert.doesNotThrow(()=>core.parse(backup(incoming)));checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:incoming})).unreadable,false);checks++;
}
console.log('PASS: '+checks+' forward-home-chest protection, no-write and historical-save assertions.');

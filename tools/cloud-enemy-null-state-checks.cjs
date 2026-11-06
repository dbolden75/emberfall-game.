#!/usr/bin/env node
'use strict';
// A JSON null is not an omitted legacy field: importing null enemy vitals or
// flags silently changes the enemy's death state, loot, or respawn deadline.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
function backup(enemy){
 return {format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',
  slots:{slot1:{id:'slot1',name:'Restore QA',class:'warrior',level:1,updated:100,
   state:{mapId:'ashvale',player:{name:'Restore QA',class:'warrior',level:1,
    coins:0,xp:0,hp:5,max:10,speed:3,x:10,y:10,inventory:[]},
    companions:[],townQuestState:{},mapStates:{ashvale:{enemies:[enemy]}}}}}};
}
const enemy={x:20,y:25,hp:4,maxHp:8,respawnAt:0,alive:true,lootClaimed:false};
for(const key of ['hp','maxHp','respawnAt','alive','lootClaimed']){
 const corrupt={...enemy,[key]:null},payload=JSON.stringify(backup(corrupt));
 assert.throws(()=>core.parse(payload),/enemy/i,`${key}:null must be refused`);
 assert.equal(core.readLocal(JSON.stringify(backup(corrupt).slots)).unreadable,true,
  `${key}:null local slot must be marked unreadable`);
 let writes=0;
 const data=new Map([[core.SLOT_KEY,JSON.stringify(backup(enemy).slots)],
                       [core.ACTIVE_SLOT_KEY,'slot1']]);
 const storage={getItem:k=>data.get(k)??null,
  setItem:(k,v)=>{writes++;data.set(k,String(v));},
  removeItem:k=>{writes++;data.delete(k);}};
 const original=data.get(core.SLOT_KEY);
 assert.throws(()=>core.restore(storage,payload,{confirmed:true,allowOlder:true}),/enemy/i);
 assert.equal(writes,0,'Rejected backup must write no save or recovery records');
 assert.equal(data.get(core.SLOT_KEY),original,'Preserve current hero and enemy data');
}
// Preserve explicit legitimate zero/false data, and old snapshots which truly
// omitted optional enemy fields (rather than explicitly writing null).
assert.doesNotThrow(()=>core.parse(JSON.stringify(backup(enemy))));
assert.doesNotThrow(()=>core.parse(JSON.stringify(backup({hp:0,maxHp:8,alive:false,lootClaimed:true,respawnAt:0}))));
for(const key of ['hp','maxHp','respawnAt','alive','lootClaimed']){
 const historical={...enemy};delete historical[key];
 assert.doesNotThrow(()=>core.parse(JSON.stringify(backup(historical))),
  `historical absence of ${key} must remain accepted`);
}
console.log('PASS: 5 corrupt enemy null fields refused atomically; zero/false and historical omitted fields preserved');

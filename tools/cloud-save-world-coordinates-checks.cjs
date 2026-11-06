#!/usr/bin/env node
'use strict';
// The packaged Android Cloud Save module must reject obviously impossible
// positions rather than silently teleporting heroes or losing monsters.
// The 10,000-pixel safety margin deliberately exceeds every current map.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const original={id:'slot1',updated:100,name:'Keeper',class:'warrior',level:8,state:{
  player:{name:'Keeper',class:'warrior',level:8,coins:99,xp:0,hp:10,max:20,speed:120,x:100,y:200,inventory:[]},
  mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[{x:100,y:200,spawnX:120,spawnY:210,hp:1,maxHp:8,alive:true,respawnAt:0}]}},townQuestState:{}}};
const backup={format:'thornhaven-save',schema:1,createdAt:101,activeSlot:'slot1',slots:{slot1:original}};
const payload=change=>{
 const next=JSON.parse(JSON.stringify(backup));
 change(next.slots.slot1.state);
 return JSON.stringify(next);
};
function mustReject(src,label){
 assert.throws(()=>core.parse(src),/character health|enemy positions/i,label);
 assert.equal(core.readLocal(JSON.stringify(JSON.parse(src).slots)).unreadable,true,label+' corrupted local slot');
}
for(const key of ['x','y']){
 for(const value of [-1e12,1e12])
  mustReject(payload(s=>{s.player[key]=value;}),'Hero '+key+'='+value);
}
for(const key of ['x','y','spawnX','spawnY']){
 for(const value of [-1e12,1e12])
  mustReject(payload(s=>{s.mapStates.ashvale.enemies[0][key]=value;}),'Enemy '+key+'='+value);
}
for(const key of ['x','y'])
 mustReject(payload(s=>{s.mapStates.ashvale.enemies[0][key]=null;}),'Explicit null enemy position '+key);
// Older game saves can legitimately omit optional fields, and the open-world
// map has negative offsets. Do not reject those or ordinary large positions.
for(const val of [-9999,9999]){
 assert.doesNotThrow(()=>core.parse(payload(s=>{s.player.x=val;s.player.y=val;})));
 assert.doesNotThrow(()=>core.parse(payload(s=>{const e=s.mapStates.ashvale.enemies[0];e.x=val;e.spawnY=val;})));
}
for(const key of ['x','y']){
 assert.doesNotThrow(()=>core.parse(payload(s=>{delete s.player[key]})));
}
for(const key of ['x','y','spawnX','spawnY']){
 assert.doesNotThrow(()=>core.parse(payload(s=>{delete s.mapStates.ashvale.enemies[0][key]})));
}
// Rejected imports must not mutate existing slots, active hero, or recovery.
const store=new Map([[core.SLOT_KEY,JSON.stringify({slot1:original})],[core.ACTIVE_SLOT_KEY,'slot1']]);
const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const keys=[core.SLOT_KEY,core.ACTIVE_SLOT_KEY,core.RECOVERY_KEY];
const before=keys.map(k=>storage.getItem(k));
assert.throws(()=>core.restore(storage,payload(s=>{s.mapStates.ashvale.enemies[0].x=1e12}),{confirmed:true,allowOlder:true}),/enemy positions/i);
assert.deepEqual(keys.map(k=>storage.getItem(k)),before,'Rejected import must preserve saves and recovery');
console.log('PASS: 14 invalid world coordinates rejected; valid/legacy snapshots and existing local saves preserved.');

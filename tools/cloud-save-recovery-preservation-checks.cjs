#!/usr/bin/env node
'use strict';
// A clean-install restore must not overwrite a useful, pre-existing recovery
// with empty/null local slots. Tests the same cloud-save-core shipped in the APK.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const slot=(name,updated)=>({id:'slot1',updated,name,class:'warrior',level:2,state:{
 player:{name,class:'warrior',level:2,coins:20,xp:8,inventory:[]},
 mapId:'ashvale',mapStates:{ashvale:{enemies:[]}},companions:[],townQuestState:{}}});
const previous=slot('Previously saved hero',100),incoming=slot('Imported hero',200);
const previousBackup=core.encode({slot1:previous},'slot1',110);
const earlierRecovery=JSON.stringify({format:'thornhaven-recovery',schema:1,createdAt:110,
 slots:JSON.stringify({slot1:previous}),activeSlot:'slot1'});
const incomingBackup=core.encode({slot1:incoming},'slot1',210);
const store=(entries=[])=>{
 const values=new Map(entries);
 return {values,getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key)};
};
for(const raw of [null,'{}']){
 const rows=[[core.RECOVERY_KEY,earlierRecovery]];
 if(raw!==null)rows.push([core.SLOT_KEY,raw]);
 const storage=store(rows);
 core.restore(storage,incomingBackup,{confirmed:true,expectedCurrent:raw});
 assert.equal(JSON.parse(storage.getItem(core.SLOT_KEY)).slot1.name,'Imported hero');
 assert.equal(core.recoveryText(storage),previousBackup,
  'Clean-install restore must not erase older recovery for '+String(raw));
}
{
 const storage=store();
 core.restore(storage,incomingBackup,{confirmed:true});
 assert.equal(storage.getItem(core.RECOVERY_KEY),null,
  'Empty install does not need a recovery record with no former characters');
}
{
 const raw=JSON.stringify({slot1:previous}),storage=store([[core.SLOT_KEY,raw],[core.RECOVERY_KEY,earlierRecovery]]);
 core.restore(storage,incomingBackup,{confirmed:true,allowOlder:true});
 assert.equal(core.parse(core.recoveryText(storage)).slots.slot1.name,'Previously saved hero',
  'Overwriting real local progress must still keep an undo copy');
}
{
 const raw='{"slot1":broken',storage=store([[core.SLOT_KEY,raw],[core.RECOVERY_KEY,earlierRecovery]]);
 assert.equal(core.readLocal(raw).unreadable,true);
 core.restore(storage,incomingBackup,{confirmed:true,allowOlder:true,expectedCurrent:raw});
 assert.equal(JSON.parse(storage.getItem(core.RECOVERY_KEY)).slots,raw,
  'Malformed local bytes must still be backed up exactly');
}
{
 const storage=store([[core.RECOVERY_KEY,earlierRecovery]]);
 storage.setItem=(key,value)=>{if(key===core.SLOT_KEY)throw Error('storage full');storage.values.set(key,String(value));};
 assert.throws(()=>core.restore(storage,incomingBackup,{confirmed:true}),/storage full/);
 assert.equal(storage.getItem(core.RECOVERY_KEY),earlierRecovery,
  'Failed clean-install import must retain older recovery');
 assert.equal(storage.getItem(core.SLOT_KEY),null);
}
console.log('PASS: recovery preserved across empty/null imports; real/corrupt slots backed up; interrupted imports safe');

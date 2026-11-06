#!/usr/bin/env node
'use strict';
// Explicit-null pet vitals/active flags cannot be losslessly restored by
// normalizePets(). Preserve older snapshots with omitted optional fields.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const row=pet=>({id:'slot1',updated:1000,name:'Companion Keeper',class:'warrior',level:3,state:{
 player:{name:'Companion Keeper',class:'warrior',level:3,xp:0,coins:4,inventory:[],hp:30,max:40,x:300,y:200,speed:3},
 mapId:'ashvale',companions:[pet],mapStates:{},townQuestState:{}}});
const backup=pet=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:row(pet)}});
const healthy={id:'dalen',petVersion:1,hp:10,max:20,active:true};
for(const key of ['hp','max','active']){
 const pet={...healthy,[key]:null},serialized=backup(pet);
 assert.throws(()=>core.parse(serialized),/companion|pet/i,`Explicit null ${key} must not mutate a pet on load`);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(pet)})).unreadable,true,`Unreadable local ${key}`);
 const previous=JSON.stringify({slot1:row(healthy)}),data=new Map([[core.SLOT_KEY,previous],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,String(v));},removeItem:k=>{writes++;data.delete(k)}};
 assert.throws(()=>core.restore(storage,serialized,{confirmed:true,allowOlder:true}),/companion|pet/i);
 assert.equal(writes,0,`Bad ${key} must not modify local saves or recovery`);
 assert.equal(data.get(core.SLOT_KEY),previous);
}
for(const pet of [healthy,{id:'dalen'}, {id:'dalen',petVersion:0,hp:0,max:0,active:false},
 {id:'dalen',petVersion:1,hp:10,max:20},
 {id:'ember_dragon',petVersion:1,hp:0,max:40,active:false}]){
 assert.doesNotThrow(()=>core.parse(backup(pet)),'Valid/historical pet must remain importable');
 assert.equal(core.readLocal(JSON.stringify({slot1:row(pet)})).unreadable,false);
}
console.log('PASS: explicit-null hp/max/active rejected with zero writes; five current/legacy pet snapshots accepted');

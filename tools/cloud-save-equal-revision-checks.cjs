#!/usr/bin/env node
'use strict';
// A millisecond timestamp collision cannot justify silently overwriting
// a different character. Explicit approval is still available and recovery
// must contain the original bytes.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const row=()=>({id:'slot1',updated:1234,name:'Hero',class:'warrior',level:5,state:{
 player:{name:'Hero',class:'warrior',level:5,coins:40,xp:10,hp:5,max:10,speed:3,x:300,y:200,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}}});
const original=row(),changed=row();
changed.state.player.coins=400;
const incoming=core.encode({slot1:changed},'slot1',9999);
const backing=new Map([[core.SLOT_KEY,JSON.stringify({slot1:original})],[core.ACTIVE_SLOT_KEY,'slot1']]);
let writes=0;
const storage={getItem:k=>backing.get(k)??null,
 setItem:(k,v)=>{writes++;backing.set(k,String(v));},
 removeItem:k=>{writes++;backing.delete(k);}};
assert.deepEqual(core.conflicts(core.parse(incoming),{slot1:original}),['slot1']);
assert.throws(()=>core.restore(storage,incoming,{confirmed:true}),/explicit approval/i);
assert.equal(writes,0,'conflicting backup must be refused before any storage mutation');
assert.equal(JSON.parse(backing.get(core.SLOT_KEY)).slot1.state.player.coins,40);
// Exact copies with equal timestamps remain eligible for ordinary restore.
const identical=core.encode({slot1:original},'slot1',9999);
assert.deepEqual(core.conflicts(core.parse(identical),{slot1:original}),[]);
assert.doesNotThrow(()=>core.restore(storage,identical,{confirmed:true}));
// A genuinely newer backup still restores without asking for older-save approval.
const newer=row();newer.updated=1235;newer.state.player.coins=500;
assert.deepEqual(core.conflicts(core.parse(core.encode({slot1:newer},'slot1')),{slot1:original}),[]);
assert.deepEqual(core.conflicts(core.parse(core.encode({slot1:original},'slot1')),{slot1:newer}),['slot1']);
// An approved overwrite preserves the prior character in its recovery copy.
backing.set(core.SLOT_KEY,JSON.stringify({slot1:original}));
assert.doesNotThrow(()=>core.restore(storage,incoming,{confirmed:true,allowOlder:true}));
assert.equal(JSON.parse(backing.get(core.SLOT_KEY)).slot1.state.player.coins,400);
assert.equal(JSON.parse(JSON.parse(backing.get(core.RECOVERY_KEY)).slots).slot1.state.player.coins,40);
console.log('PASS: timestamp collisions cannot silently overwrite divergent characters; recovery and ordinary imports work.');

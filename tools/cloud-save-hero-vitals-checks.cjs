#!/usr/bin/env node
'use strict';
// Package-level regression: imported hero vitals must not be silently normalized.
// This uses the same Cloud Save module that is shipped in the Android assets.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const state={player:{name:'ExistingHero',class:'warrior',level:4,coins:60,xp:3,x:2,y:3,max:50,hp:25,speed:120,inventory:[]},mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[]}},townQuestState:{}};
function payload(changes){
 const current=JSON.parse(JSON.stringify(state));Object.assign(current.player,changes);
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:123456,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:123455,state:current}}});
}
const valid=payload({});
assert.equal(core.parse(valid).slots.slot1.state.player.hp,25);
assert.equal(core.readLocal(JSON.stringify(JSON.parse(valid).slots)).unreadable,false);
// Before the fix, each corrupted value was accepted and applySavedGame() would
// coerce it into full health, default movement speed or town-arrival position.
for(const [key,value] of [['hp','NaN'],['hp',-3],['hp','0'],['max','Infinity'],['max',0],['speed',false],['x','Infinity'],['y','bad'],['hp',null],['max',null],['speed',null],['x',null],['y',null]]){
 const json=payload({[key]:value});
 assert.throws(()=>core.parse(json),/character health/i,`${key}=${JSON.stringify(value)} must not be imported`);
 assert.equal(core.readLocal(JSON.stringify(JSON.parse(json).slots)).unreadable,true,
  `Unsafe local ${key} value must be detected before replacement`);
}
// Prior-version saves can omit optional attributes; a dead hero can have 0 HP.
assert.doesNotThrow(()=>core.parse(payload({hp:0})),'A defeated hero may have zero HP');
for(const key of ['hp','max','speed','x','y']){
 const legacy=JSON.parse(payload({}));delete legacy.slots.slot1.state.player[key];
 assert.doesNotThrow(()=>core.parse(JSON.stringify(legacy)),`Historical missing ${key}`);
}
console.log('PASS: 13 invalid hero vital snapshots rejected during import and local review; historical/valid values preserved.');

#!/usr/bin/env node
'use strict';
// Exercise the actual generated HTML startup migration with mocked WebView
// localStorage. No device data or Android signing materials are touched.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const first=html.indexOf('const freshCharacterState=snapshotGameState();');
const last=html.indexOf('function snapshotGameState(){',first);
assert(first>=0&&last>first,'Cannot locate legacy single-character startup migration');
const startup=html.slice(first,last);
const legacy={player:{name:'OlderHero',class:'warrior',level:17,coins:412},
  mapId:'ashvale',townQuestState:{},companions:[],mapStates:{}};
const newer={slot2:{id:'slot2',updated:100,
  state:{player:{name:'CurrentHero',class:'mage',level:20},mapId:'sunmere'}}};
function boot({old=legacy,slots=null,failSlotWrite=false}={}){
 const memory=new Map();
 if(old)memory.set('emberfall_singleplayer_v1',JSON.stringify(old));
 if(slots)memory.set('emberfall_character_slots_v1',JSON.stringify(slots));
 let loaded;
 const storage={
  getItem:key=>memory.has(key)?memory.get(key):null,
  setItem:(key,val)=>{
   if(key==='emberfall_character_slots_v1'&&failSlotWrite)
    throw Object.assign(new Error('Full WebView storage'),{name:'QuotaExceededError'});
   memory.set(key,String(val));
  }
 };
 const ctx={
  SAVE_KEY:'emberfall_singleplayer_v1',SAVE_SLOTS_KEY:'emberfall_character_slots_v1',
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  SAVE_SLOT_IDS:['slot1','slot2','slot3','slot4'],
  saveSlots:{},activeSlotId:'slot1',localStorage:storage,
  console:{warn(){}},snapshotGameState:()=>({}),
  applySavedGame:save=>{loaded=save;}
 };
 vm.runInNewContext(startup,ctx,{timeout:1000});
 return {loaded,ctx,memory};
}
const quota=boot({failSlotWrite:true});
assert.equal(quota.loaded?.player?.name,'OlderHero','Quota failure must not hide legacy character');
assert.equal(quota.ctx.saveSlots.slot1.state.player.level,17,'Legacy progress stays in memory');
assert(!quota.memory.has('emberfall_character_slots_v1'),'Failed slot write must not be treated as persisted');
assert.equal(JSON.parse(quota.memory.get('emberfall_singleplayer_v1')).player.coins,412,'Original legacy save unchanged');
const regular=boot();
assert.equal(regular.loaded.player.level,17);
assert.equal(JSON.parse(regular.memory.get('emberfall_character_slots_v1')).slot1.state.player.coins,412);
const current=boot({slots:newer});
assert.equal(current.loaded.player.name,'CurrentHero','Existing authoritative slot wins');
assert.equal(JSON.parse(current.memory.get('emberfall_character_slots_v1')).slot2.state.player.name,'CurrentHero');
const empty=boot({old:null});
assert.equal(empty.loaded,null);
assert.equal(empty.memory.size,0);
console.log('PASS: legacy save loads through quota error, retained original bytes, regular migration, existing slots, empty first launch. Mocked startup only, not physical Android upgrade.');

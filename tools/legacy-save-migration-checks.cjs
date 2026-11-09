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
function boot({old=legacy,slots=null,rawSlots=undefined,confirmRecovery=false,failBackupWrite=false,failSlotWrite=false}={}){
 const memory=new Map();
 if(old)memory.set('emberfall_singleplayer_v1',JSON.stringify(old));
 if(slots)memory.set('emberfall_character_slots_v1',JSON.stringify(slots));
 if(rawSlots!==undefined)memory.set('emberfall_character_slots_v1',rawSlots);
 let loaded;
 const storage={
  getItem:key=>memory.has(key)?memory.get(key):null,
  setItem:(key,val)=>{
   if(key==='emberfall_corrupt_character_slots_backup_v1'&&failBackupWrite)
    throw Object.assign(new Error('No safe recovery backup space'),{name:'QuotaExceededError'});
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
  console:{warn(){}},window:{confirm:()=>confirmRecovery,alert(){}},classDefs:{warrior:{},mage:{}},snapshotGameState:()=>({}),
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
// A malformed slot store is not equivalent to a deliberately empty one.
// Keep damaged raw bytes; recover the old 1.0.57 mirror only after its exact
// byte-level backup is read back and the user explicitly approves recovery.
const broken=boot({rawSlots:'{broken'});
assert.equal(broken.loaded,null,'Declined recovery must not auto-load stale mirror');
assert.equal(broken.memory.get('emberfall_character_slots_v1'),'{broken','Damaged slot bytes must remain untouched');
assert.equal(broken.memory.get('emberfall_corrupt_character_slots_backup_v1'),'{broken','Retain byte-exact damaged slot backup');
const approved=boot({rawSlots:'{broken',confirmRecovery:true});
assert.equal(approved.loaded?.player?.name,'OlderHero','Consent recovers old hero');
assert.equal(approved.memory.get('emberfall_corrupt_character_slots_backup_v1'),'{broken','Original damaged bytes retained after consent');
assert.equal(JSON.parse(approved.memory.get('emberfall_character_slots_v1')).slot1.state.player.coins,412);
const backupFull=boot({rawSlots:'{broken',confirmRecovery:true,failBackupWrite:true});
assert.equal(backupFull.loaded,null,'No readback-verified backup means no destructive recovery');
assert.equal(backupFull.memory.get('emberfall_character_slots_v1'),'{broken');
const restoreFull=boot({rawSlots:'{broken',confirmRecovery:true,failSlotWrite:true});
assert.equal(restoreFull.loaded,null,'A rejected restoration write cannot claim character recovered');
assert.equal(restoreFull.memory.get('emberfall_character_slots_v1'),'{broken');
const intentionallyEmpty=boot({slots:{}});
assert.equal(intentionallyEmpty.loaded,null,'An intentionally empty slot store must not resurrect stale legacy hero');
const empty=boot({old:null});
assert.equal(empty.loaded,null);
assert.equal(empty.memory.size,0);
console.log('PASS: 1.0.57 legacy migration, quota resistance, valid slots, malformed-slot preservation, consent-only recovery, backup failure and valid empty-store safety. Mocked startup only, not physical Android upgrade.');

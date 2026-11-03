'use strict';
// Run after tools/restore-game-source.py: mocked WebView storage, not Android.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app','src','main','assets','index.html'),'utf8');
const first=source.indexOf('function saveGame(){');
const last=source.indexOf('\nfunction applyDanCompanionGear',first);
assert(first!==-1&&last>first,'saveGame() and its boundary must exist');
const fn=source.slice(first,last);
function attempt(failKey){
 const warnings=[],errors=[],writes=[];
 const initial={slot1:{id:'slot1',name:'Earlier',level:1,state:{player:{name:'Earlier',hp:20}}}};
 const storage={
  emberfall_singleplayer_v1:JSON.stringify(initial.slot1.state),
  emberfall_character_slots_v1:JSON.stringify(initial),
  emberfall_active_character_slot_v1:'slot1'
 };
 let warningShown=false;
 const ctx={
  titleMenuActive:false,hasStarted:true,switchingCharacter:false,
  player:{name:'Newer',class:'warrior',level:2},saveSlots:structuredClone(initial),activeSlotId:'slot1',
  SAVE_KEY:'emberfall_singleplayer_v1',
  SAVE_SLOTS_KEY:'emberfall_character_slots_v1',
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  snapshotGameState(){return {player:{name:'Newer',class:'warrior',level:2,hp:27}};},
  localStorage:{setItem(key,val){
   writes.push(key);
   if(key===failKey)throw Object.assign(new Error('QuotaExceededError'),{name:'QuotaExceededError'});
   storage[key]=String(val);
  }},
  console:{warn:(...m)=>warnings.push(m.join(' ')),error:(...m)=>errors.push(m.join(' '))},
  document:{
   getElementById(){return warningShown?{set textContent(v){}}:null;},
   createElement(){warningShown=true;return {setAttribute(){},style:{}};},
   body:{appendChild(){}}
  },
  Date
 };
 vm.createContext(ctx);
 vm.runInContext(fn,ctx);
 ctx.saveGame();
 return {storage,ctx,writes,warnings,errors,warningShown};
}
{
 const r=attempt(null);
 const slots=JSON.parse(r.storage.emberfall_character_slots_v1);
 assert.equal(slots.slot1.state.player.hp,27);
 assert.equal(JSON.parse(r.storage.emberfall_singleplayer_v1).player.hp,27);
 assert.deepEqual(r.writes,['emberfall_character_slots_v1','emberfall_singleplayer_v1','emberfall_active_character_slot_v1']);
 assert.equal(r.errors.length,0);
}
{
 const r=attempt('emberfall_singleplayer_v1');
 assert.equal(JSON.parse(r.storage.emberfall_character_slots_v1).slot1.state.player.hp,27,
  'authoritative save survives legacy-mirror quota');
 assert.equal(JSON.parse(r.storage.emberfall_singleplayer_v1).player.hp,20);
 assert.equal(r.warningShown,false,'do not falsely tell player the character save failed');
 assert.equal(r.warnings.length,1);
}
{
 const r=attempt('emberfall_character_slots_v1');
 assert.equal(JSON.parse(r.storage.emberfall_character_slots_v1).slot1.state.player.hp,20,
  'old slot remains when primary write fails');
 assert.equal(JSON.parse(r.storage.emberfall_singleplayer_v1).player.hp,20,
  'do not overwrite legacy recovery after primary failure');
 assert.equal(r.ctx.saveSlots.slot1.state.player.hp,20,
  'in-memory slots remain consistent with persisted data');
 assert.equal(r.warningShown,true,'warn player when authoritative save fails');
 assert.deepEqual(r.writes,['emberfall_character_slots_v1']);
}
{
 const r=attempt('emberfall_active_character_slot_v1');
 assert.equal(JSON.parse(r.storage.emberfall_character_slots_v1).slot1.state.player.hp,27);
 assert.equal(JSON.parse(r.storage.emberfall_singleplayer_v1).player.hp,27);
 assert.equal(r.warnings.length,1);
 assert.equal(r.warningShown,false);
}
console.log('PASS: primary save slot committed first; legacy mirror/pref failures do not destroy progress; primary failure preserves prior save and warns. Mocked storage only.');

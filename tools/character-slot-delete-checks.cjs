'use strict';
// Validate actual reconstructed WebView character-deletion JavaScript against
// isolated storage failures. No user saves, signing keys or devices accessed.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const start=html.indexOf('function deleteSaveSlot(id)');
const end=html.indexOf('function closeGameToSaveMenu()',start);
assert(start>=0&&end>start,'Actual generated HTML deletion function must exist');
const source=html.slice(start,end);

function scenario(mode='ok',requested='slot2'){
 const initial={slot1:{id:'slot1',name:'Ava',state:{coins:55}},slot2:{id:'slot2',name:'Lina',state:{coins:17}}};
 const disk=new Map([
  ['emberfall_character_slots_v1',JSON.stringify(initial)],
  ['emberfall_active_character_slot_v1','slot1'],
  ['emberfall_singleplayer_v1','legacy snapshot']
 ]);
 const alerts=[];let confirms=0,renders=0,reloads=0;
 const c={
  SAVE_SLOT_IDS:['slot1','slot2','slot3','slot4'],
  SAVE_SLOTS_KEY:'emberfall_character_slots_v1',
  SAVE_KEY:'emberfall_singleplayer_v1',
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  activeSlotId:'slot1',switchingCharacter:false,saveSlots:structuredClone(initial),
  confirmSaveBeforeSlotSwitch(){return mode!=='unsaved'},
  window:{confirm(){confirms++;return mode!=='cancel'},location:{reload(){reloads++}}},
  localStorage:{
   getItem(key){return disk.has(key)?disk.get(key):null},
   setItem(key,value){
    if(key==='emberfall_character_slots_v1'&&mode==='quota')throw new Error('QuotaExceededError');
    if(key==='emberfall_character_slots_v1'&&mode==='silent')return;
    disk.set(key,String(value));
   },
   removeItem(key){if(mode==='legacy-refusal')throw new Error('StorageError');disk.delete(key)}
  },
  console:{warn(){}},
  say(message){alerts.push(String(message))},
  renderSaveSlots(){renders++}
 };
 vm.createContext(c);vm.runInContext(source,c,{timeout:1000});
 const exec=()=>vm.runInContext('deleteSaveSlot('+JSON.stringify(requested)+')',c,{timeout:1000});
 return {c,disk,alerts,exec,counts:()=>({confirms,renders,reloads})};
}
function intact(r){
 assert.equal(r.c.saveSlots.slot2?.state?.coins,17,'Must retain in-memory hero');
 assert.equal(JSON.parse(r.disk.get('emberfall_character_slots_v1')).slot2?.state?.coins,17,'Must retain durable hero');
 assert.equal(r.disk.get('emberfall_active_character_slot_v1'),'slot1','Active slot must not change');
 assert.equal(r.counts().reloads,0);
}
{const r=scenario();r.exec();
 assert.equal(r.c.saveSlots.slot2,undefined);
 assert.equal(JSON.parse(r.disk.get('emberfall_character_slots_v1')).slot2,undefined);
 assert.equal(r.counts().renders,1);
 assert.equal(r.disk.get('emberfall_singleplayer_v1'),'legacy snapshot');
}
for(const mode of ['quota','silent']){
 const r=scenario(mode);
 assert.doesNotThrow(r.exec,mode+' must not crash');
 intact(r);assert.equal(r.counts().renders,0);
 assert(r.alerts.some(x=>x.includes('deletion could not be saved')),'Must warn after '+mode);
}
for(const mode of ['cancel','unsaved']){
 const r=scenario(mode);r.exec();intact(r);
 assert.equal(r.counts().renders,0);
 if(mode==='unsaved')assert(r.alerts.some(x=>x.includes('progress could not be saved')));
}
{const r=scenario('ok','slot1');r.exec();
 assert.equal(r.counts().confirms,0,'Cannot delete active character');
 assert.equal(r.counts().reloads,0);
 assert(r.alerts.some(x=>x.includes('Switch to another character')));
 assert.equal(r.c.saveSlots.slot1?.state?.coins,55);
}
for(const mode of ['ok','legacy-refusal']){
 const r=scenario(mode,'slot1');
 r.c.activeSlotId='slot2';r.disk.set('emberfall_active_character_slot_v1','slot2');
 r.exec();
 assert.equal(r.c.saveSlots.slot1,undefined);
 assert.equal(JSON.parse(r.disk.get('emberfall_character_slots_v1')).slot1,undefined);
 assert.equal(r.c.saveSlots.slot2.state.coins,17);
 assert.equal(r.counts().renders,1);
 assert.equal(r.disk.has('emberfall_singleplayer_v1'),mode==='legacy-refusal');
}
console.log('PASS: eight WebView character-deletion regressions including quota, silent rejection, active-slot guard and legacy fallback.');

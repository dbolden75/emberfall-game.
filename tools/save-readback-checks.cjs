#!/usr/bin/env node
'use strict';
// Execute the real generated saveGame() plus the late-loading durability guard.
// The storage mock emulates a WebView backend that may silently drop writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const s=html.indexOf('function saveGame(){'),e=html.indexOf('function applyDanCompanionGear(',s);
assert(s>=0&&e>s,'Generated saveGame must be present');
const actualSave=html.slice(s,e);
const client=fs.readFileSync(path.join(root,'app/src/main/assets/purchase-api.js'),'utf8');
const first='/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */',last='/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */';
const start=client.indexOf(first),end=client.indexOf(last);
assert(start>=0&&end>start,'Durability guard must be present in late-loaded purchase-api.js');
const guard=client.slice(start,end+last.length);
let count=0;
function scenario(mode='ok'){
 const disk=new Map(),state={player:{name:'Ava',class:'warrior',level:3,inventory:[{id:'iron_ore',count:2}]},mapId:'ashvale'};
 const elements=new Map();let behavior=mode;
 const doc={getElementById:id=>elements.get(id)||null,
   createElement:tag=>({tagName:tag,setAttribute(){},style:{},remove(){elements.delete(this.id)}}),
   body:{appendChild:el=>elements.set(el.id,el)}};
 const c={hasStarted:true,titleMenuActive:false,switchingCharacter:false,activeSlotId:'slot1',
   SAVE_SLOTS_KEY:'emberfall_character_slots_v1',SAVE_KEY:'emberfall_singleplayer_v1',
   ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
   saveSlots:{slot1:{id:'slot1',name:'Ava',state:structuredClone(state)}},player:state.player,
   snapshotGameState:()=>structuredClone(state),document:doc,Date,JSON,console:{error(){},warn(){}},
   localStorage:{getItem:key=>disk.has(key)?disk.get(key):null,
    setItem(key,value){if(key===c.SAVE_SLOTS_KEY&&behavior==='throw')throw Error('QuotaExceededError');
      if(key===c.SAVE_SLOTS_KEY&&behavior==='silent')return;
      disk.set(key,String(value));}}
 };
 vm.createContext(c);vm.runInContext(actualSave,c,{timeout:1000});
 // The baseline generated saveGame does not see silent refusal: prove red first.
 if(mode==='silent'){
  c.saveGame();assert.equal(disk.has(c.SAVE_SLOTS_KEY),false,'baseline reproduces dropped write');
  assert.equal(elements.has('saveFailureWarning'),false,'baseline misses silent failure');
 }
 vm.runInContext(guard,c,{timeout:1000});c.saveGame();
 return {c,disk,elements,setMode:v=>behavior=v};
}
for(const mode of ['ok','silent','throw']){
 const r=scenario(mode),warning=r.elements.get('saveFailureWarning');
 if(mode==='ok'){
  assert(!warning,'verified save must not display an error');
  assert.equal(JSON.parse(r.disk.get(r.c.SAVE_SLOTS_KEY)).slot1.state.player.inventory[0].count,2);
  assert.equal(r.disk.get(r.c.ACTIVE_SLOT_KEY),'slot1','historical slot preference must remain');
 }else{
  assert(warning,'failed write must display an on-screen warning: '+mode);
  assert.match(warning.textContent,/Keep the game open/);
  assert.equal(r.disk.has(r.c.SAVE_SLOTS_KEY),false,'rejected or dropped writes cannot be assumed durable');
  r.setMode('ok');r.c.saveGame();
  assert.equal(r.elements.has('saveFailureWarning'),false,'verified retry must clear warning');
  assert.equal(JSON.parse(r.disk.get(r.c.SAVE_SLOTS_KEY)).slot1.state.player.level,3);
 }
 count++;
}
const title=scenario('ok');title.c.titleMenuActive=true;const before=title.disk.size;title.c.saveGame();
assert.equal(title.disk.size,before,'title menu must not write character');count++;
console.log('PASS: '+count+' real-saveGame durability cases (normal, silent refusal, quota rejection, title menu), plus verified retry and unchanged storage keys.');

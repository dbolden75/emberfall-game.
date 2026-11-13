#!/usr/bin/env node
'use strict';
// Exercise the shipped save function and late WebView guard, not a synthetic replacement.
// This test never touches device storage or real Google Play purchases.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assets=path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const client=fs.readFileSync(path.join(assets,'purchase-api.js'),'utf8');
const a=html.indexOf('function saveGame(){');
const b=html.indexOf('function applyDanCompanionGear(',a);
const first=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const last=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(a!==-1&&b>a&&first!==-1&&last>first,'Expected real save function and guard');
const saveFn=html.slice(a,b);
const guard=client.slice(first,last+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const slotKey='emberfall_character_slots_v1',legacyKey='emberfall_singleplayer_v1';
const good={player:{name:'Ava',class:'warrior',level:5,inventory:[{id:'ore',count:2}]}};
let cases=0;
function trial(label,legacy,slot,shouldBlock){
 const data=new Map();
 if(legacy!==undefined)data.set(legacyKey,legacy);
 if(slot!==undefined)data.set(slotKey,slot);
 const elements=new Map();let deliveries=0;
 const doc={getElementById:id=>elements.get(id)||null,
  createElement:()=>({setAttribute(){},style:{},remove(){elements.delete(this.id)}}),
  body:{appendChild:el=>elements.set(el.id,el)}};
 const context={window:{},SAVE_SLOTS_KEY:slotKey,SAVE_KEY:legacyKey,
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  activeSlotId:'slot1',saveSlots:{},player:good.player,
  snapshotGameState:()=>structuredClone(good),document:doc,Date,JSON,
  console:{error(){},warn(){}},
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,
   setItem:(k,v)=>data.set(k,String(v))},
  purchaseCommit(){deliveries++}
 };
 vm.createContext(context);
 vm.runInContext(saveFn,context,{timeout:1000});
 vm.runInContext(guard,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),shouldBlock,`${label}: classification`);
 const originalLegacy=data.get(legacyKey),originalSlot=data.get(slotKey);
 context.saveGame();
 if(shouldBlock){
  assert.equal(data.get(legacyKey),originalLegacy,`${label}: legacy bytes preserved`);
  assert.equal(data.get(slotKey),originalSlot,`${label}: no new authority over damaged save`);
  assert.throws(()=>context.purchaseCommit(good),/Damaged character slots/,`${label}: paid delivery blocked`);
  assert.equal(deliveries,0,`${label}: no paid delivery`);
  assert.match(elements.get('saveFailureWarning').textContent,/Restore a verified backup/);
 }else{
  assert.equal(JSON.parse(data.get(slotKey)).slot1.state.player.name,'Ava',`${label}: valid save persists`);
  context.purchaseCommit(good);
  assert.equal(deliveries,1,`${label}: verified purchase can proceed`);
 }
 cases++;
}
trial('broken legacy JSON','{broken',undefined,true);
trial('legacy null','null',undefined,true);
trial('legacy without player','{}',undefined,true);
trial('legacy unknown class',JSON.stringify({player:{name:'Ava',class:'archer'}}),undefined,true);
trial('legacy invalid stack',JSON.stringify({player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:-1}]}}),undefined,true);
trial('new install',undefined,undefined,false);
trial('healthy legacy-only',JSON.stringify(good),undefined,false);
trial('healthy slot authoritative, stale malformed legacy','{broken',JSON.stringify({slot1:{state:good}}),false);
console.log(`PASS ${cases}/${cases}: legacy-only corruption blocks overwrites and checkout; fresh, valid legacy and authoritative slots remain functional (mocked WebView)`);

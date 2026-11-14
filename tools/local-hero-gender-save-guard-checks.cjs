#!/usr/bin/env node
'use strict';
// Run against production purchase-api.js (or THORNHAVEN_CLIENT pointing to
// an extracted signed APK). Mocked WebView/localStorage, not physical Play QA.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const begin=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const end=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(begin>=0&&end>begin,'production local-save durability guard present');
const guard=source.slice(begin,end+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const SLOT='emberfall_character_slots_v1',LEGACY='emberfall_singleplayer_v1';
const copy=thing=>structuredClone(thing);
const healthy={player:{name:'Ava',class:'warrior',gender:'female',level:5,xp:12,coins:40,
 inventory:[],hp:25,max:50,speed:120,x:480,y:500},mapId:'ashvale'};
const cases=[
 ['female',s=>s.player.gender='female',false],
 ['male',s=>s.player.gender='male',false],
 ['omitted legacy gender',s=>{delete s.player.gender},false],
 ['null legacy gender',s=>s.player.gender=null,false],
 ['unsupported future gender',s=>s.player.gender='nonbinary',true],
 ['uppercase gender',s=>s.player.gender='FEMALE',true],
 ['empty gender',s=>s.player.gender='',true],
 ['wrong-type false',s=>s.player.gender=false,true],
 ['wrong-type number',s=>s.player.gender=0,true],
 ['wrong-type object',s=>s.player.gender={type:'female'},true],
 ['wrong-type list',s=>s.player.gender=['female'],true],
];
let checks=0,blocked=0,allowed=0;
function runtime(stored,live,legacy){
 const initial=legacy?{[LEGACY]:JSON.stringify(stored)}:{[SLOT]:JSON.stringify({slot1:{state:stored}})};
 const data=new Map(Object.entries(initial)),els=new Map();let saves=0,deliveries=0;
 const document={getElementById:id=>els.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){els.delete(this.id)}}),
  body:{appendChild:node=>els.set(node.id,node)}};
 const ctx={window:{},document,JSON,Date,
  SAVE_SLOTS_KEY:SLOT,SAVE_KEY:LEGACY,activeSlotId:'slot1',hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  snapshotGameState:()=>copy(live),saveGame(){saves++;data.set(SLOT,JSON.stringify({slot1:{state:copy(live)}}));},
  purchaseCommit(next){deliveries++;data.set(SLOT,JSON.stringify({slot1:{state:next}}));},
  localStorage:{getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value))},
  console:{error(){},warn(){}},maps:{ashvale:{}},itemDefs:{},gearRequirements:()=>true,gearUpgradeCap:()=>3};
 vm.createContext(ctx);vm.runInContext(guard,ctx,{timeout:2000});
 return {ctx,data,initial,get saves(){return saves},get deliveries(){return deliveries}};
}
for(const [label,mutate,unsafe] of cases)for(const legacy of [false,true]){
 const stored=copy(healthy);mutate(stored);
 const t=runtime(stored,healthy,legacy);
 assert.equal(t.ctx.window.ThornhavenDamagedSlots(),unsafe,label+' classification legacy='+legacy);checks++;
 t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' ordinary save legacy='+legacy);checks++;
 if(unsafe){
  for(const [key,raw] of Object.entries(t.initial))assert.equal(t.data.get(key),raw,label+' original bytes unchanged');
  assert.throws(()=>t.ctx.purchaseCommit(healthy),/Damaged character slots/,label+' purchase refused');
  assert.equal(t.deliveries,0);blocked++;
 }else{t.ctx.purchaseCommit(healthy);assert.equal(t.deliveries,1);allowed++}
 checks++;
}
for(const [label,mutate,unsafe] of cases){
 const live=copy(healthy);mutate(live);
 const t=runtime(healthy,live,false);
 t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' invalid runtime snapshot');checks++;
 if(unsafe){
  assert.equal(t.data.get(SLOT),t.initial[SLOT],label+' original save unchanged');
  assert.throws(()=>t.ctx.purchaseCommit(live),/Invalid purchase delivery state/,label+' receipt refused');
  assert.equal(t.deliveries,0);
 }else{t.ctx.purchaseCommit(live);assert.equal(t.deliveries,1)}
 checks++;
}
console.log('PASS '+checks+'/'+checks+': '+blocked+' damaged stored states blocked, '+allowed+
 ' valid/legacy stored states permitted; '+cases.length+' runtime save and purchase checks (mocked WebView)');

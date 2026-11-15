#!/usr/bin/env node
'use strict';
// Deterministic mocked-WebView test of production save guard: no native device or Play transaction.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const begin=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const end=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(begin>=0&&end>begin,'real production durability guard exists');
const guard=source.slice(begin,end+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const healthy={player:{name:'Traveler',class:'warrior',gender:'male',hp:25,max:50,x:480,y:500,speed:120,
 xp:5,level:4,coins:20,inventory:[],weapon:null,armor:null,shield:null,
 earrings:null,necklace:null,legs:null,boots:null},mapId:'ashvale',defeated:0,
 done:false,hasSigil:false,hasFourfoldKey:false};
const clone=o=>structuredClone(o);
function scenario(stored,live,legacy){
 const initial=legacy?{[L]:JSON.stringify(stored)}:{[S]:JSON.stringify({slot1:{state:stored}})};
 const data=new Map(Object.entries(initial)),els=new Map();let saves=0,deliveries=0;
 const document={getElementById:id=>els.get(id)||null,
 createElement:()=>({style:{},setAttribute(){},remove(){els.delete(this.id)}}),
 body:{appendChild:node=>els.set(node.id,node)}};
 const ctx={window:{},document,JSON,Date,SAVE_SLOTS_KEY:S,SAVE_KEY:L,activeSlotId:'slot1',
 hasStarted:true,titleMenuActive:false,switchingCharacter:false,
 snapshotGameState:()=>clone(live),saveGame(){saves++;data.set(S,JSON.stringify({slot1:{state:clone(live)}}))},
 purchaseCommit(next){deliveries++;data.set(S,JSON.stringify({slot1:{state:clone(next)}}))},
 localStorage:{getItem:key=>data.has(key)?data.get(key):null,setItem:(k,v)=>data.set(k,String(v))},
 console:{error(){},warn(){}},maps:{ashvale:{}},itemDefs:{},gearRequirements:()=>true,gearUpgradeCap:()=>3};
 vm.createContext(ctx);vm.runInContext(guard,ctx,{timeout:1000});
 return {ctx,data,initial,get saves(){return saves},get deliveries(){return deliveries}};
}
const cases=[
 ['intact historical state',()=>{},false],
 ['omitted legacy milestones',s=>{delete s.done;delete s.defeated;delete s.hasSigil},false],
 ['known future-tolerant town quest object',s=>s.townQuestState={quest:{rank:7}},false],
 ['known map status',s=>s.mapStates={ashvale:{}},false],
 ['future story ledger',s=>s.storyLedgerV2={chapter:4,choices:['a']},true],
 ['future currency',s=>s.gemWalletV2=1000,true],
 ['future null metadata',s=>s.futureSeasonState=null,true],
 ['future empty metadata',s=>s.factionReputationV2={},true],
 ['future quest flag',s=>s.foundFifthShrine=true,true]
];
let checks=0;
for(const [label,change,unsafe] of cases){
 for(const legacy of [false,true]){
  const stored=clone(healthy);change(stored);
  const t=scenario(stored,healthy,legacy);
  assert.equal(t.ctx.window.ThornhavenDamagedSlots(),unsafe,label+' stored classification');checks++;
  t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' stored save');checks++;
  if(unsafe){
   for(const [k,raw] of Object.entries(t.initial))assert.equal(t.data.get(k),raw,label+' original stored bytes unchanged');
   assert.throws(()=>t.ctx.purchaseCommit(healthy),/Damaged character slots/,label+' paid receipt refusal');
   assert.equal(t.deliveries,0);
  }else{t.ctx.purchaseCommit(healthy);assert.equal(t.deliveries,1)}
  checks++;
 }
 const live=clone(healthy);change(live);const t=scenario(healthy,live,false);
 t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' live snapshot save');checks++;
 if(unsafe){
  assert.equal(t.data.get(S),t.initial[S],label+' last healthy stored bytes preserved');
  assert.throws(()=>t.ctx.purchaseCommit(live),/Invalid purchase delivery state/,label+' unsafe receipt refused');
  assert.equal(t.deliveries,0);
 }else{t.ctx.purchaseCommit(live);assert.equal(t.deliveries,1)}
 checks++;
}
console.log('PASS '+checks+'/'+checks+': unknown top-level fields protected in stored slots, legacy saves, snapshots and simulated receipts');

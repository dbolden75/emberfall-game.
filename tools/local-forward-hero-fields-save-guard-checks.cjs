#!/usr/bin/env node
'use strict';
// A mocked WebView test against production purchase-api.js, not a device test.
// An older client must not erase newer character fields on save/receipt commit.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const begin=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const end=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(begin>=0&&end>begin,'real production durability guard exists');
const guard=source.slice(begin,end+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const healthy={player:{name:'Traveler',class:'warrior',gender:'male',hp:25,max:50,x:480,y:500,speed:120,
 xp:5,level:4,coins:20,inventory:[],weapon:null,armor:null,shield:null,
 earrings:null,necklace:null,legs:null,boots:null},mapId:'ashvale'};
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
 ['intact modern hero',()=>{},false],
 ['legacy hero no gender',s=>{delete s.player.gender},false],
 ['legacy hero no new equipment',s=>{for(const k of ['earrings','necklace','legs','boots'])delete s.player[k]},false],
 ['future companion registry',s=>s.player.companionRosterV2=[{id:'future'}],true],
 ['future quest ledger',s=>s.player.questLedgerV2={faction:'marsh',progress:5},true],
 ['future reputation numeric',s=>s.player.reputationV2=15,true],
 ['future unique flag',s=>s.player.storyFlagV2=true,true],
 ['future null metadata',s=>s.player.newFieldV2=null,true]
];
let checks=0;
for(const [label,change,unsafe] of cases){
 for(const legacy of [false,true]){
  const stored=clone(healthy);change(stored);
  const t=scenario(stored,healthy,legacy);
  assert.equal(t.ctx.window.ThornhavenDamagedSlots(),unsafe,label+' stored classification');checks++;
  t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' stored save');checks++;
  if(unsafe){
   for(const [k,raw] of Object.entries(t.initial))assert.equal(t.data.get(k),raw,label+' bytes kept');
   assert.throws(()=>t.ctx.purchaseCommit(healthy),/Damaged character slots/,label+' paid receipt refusal');
   assert.equal(t.deliveries,0);
  }else{t.ctx.purchaseCommit(healthy);assert.equal(t.deliveries,1)}
  checks++;
 }
 const live=clone(healthy);change(live);const t=scenario(healthy,live,false);
 t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' live save');checks++;
 if(unsafe){
  assert.equal(t.data.get(S),t.initial[S],label+' last healthy save preserved');
  assert.throws(()=>t.ctx.purchaseCommit(live),/Invalid purchase delivery state/,label+' unsafe receipt refused');
  assert.equal(t.deliveries,0);
 }else{t.ctx.purchaseCommit(live);assert.equal(t.deliveries,1)}
 checks++;
}
console.log('PASS '+checks+'/'+checks+': future hero fields protected in slots, legacy saves, live snapshots and Play receipt commits (mocked WebView)');

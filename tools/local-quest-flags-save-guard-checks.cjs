#!/usr/bin/env node
'use strict';
// Production save guard under a mocked WebView. Does not test actual Android devices or Play Billing.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const start=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const end=source.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(start>=0&&end>start,'real production save guard present');
const guard=source.slice(start,end+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const healthy={player:{name:'Ava',class:'warrior',gender:'female',hp:25,max:50,speed:120,x:480,y:500,
 level:5,xp:12,coins:40,inventory:[]},mapId:'ashvale',defeated:4,done:false,hasSigil:false,
 hasFourfoldKey:false,huntRewarded:false,shrineRewarded:false,deepQuestDone:false,houseBought:false};
const clone=o=>structuredClone(o);
function scenario(stored,live,legacy=false){
 const initial=legacy?{[L]:JSON.stringify(stored)}:{[S]:JSON.stringify({slot1:{state:stored}})};
 const data=new Map(Object.entries(initial)),nodes=new Map();let saves=0,paid=0;
 const document={getElementById:id=>nodes.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){nodes.delete(this.id)}}),
  body:{appendChild:n=>nodes.set(n.id,n)}};
 const ctx={window:{},document,JSON,Date,SAVE_SLOTS_KEY:S,SAVE_KEY:L,
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,activeSlotId:'slot1',
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))},
  snapshotGameState:()=>clone(live),saveGame(){saves++;data.set(S,JSON.stringify({slot1:{state:clone(live)}}));},
  purchaseCommit(next){paid++;data.set(S,JSON.stringify({slot1:{state:clone(next)}}));},
  maps:{ashvale:{}},itemDefs:{},gearRequirements:()=>true,gearUpgradeCap:()=>5,
  console:{error(){},warn(){}}};
 vm.createContext(ctx);vm.runInContext(guard,ctx,{timeout:1000});
 return {ctx,data,initial,get saves(){return saves},get paid(){return paid}};
}
const flags=['done','hasSigil','hasFourfoldKey','huntRewarded','shrineRewarded','deepQuestDone','houseBought'];
const cases=[];
for(const key of flags){
 cases.push([key+' string false',s=>s[key]='false',true]);
 cases.push([key+' object',s=>s[key]={value:false},true]);
 cases.push([key+' null',s=>s[key]=null,true]);
 cases.push([key+' true',s=>s[key]=true,false]);
 cases.push([key+' omitted legacy',s=>{delete s[key]},false]);
}
for(const [label,value,unsafe] of [
 ['defeated string', '10',true],['defeated negative',-1,true],['defeated huge',Number.MAX_SAFE_INTEGER+1,true],
 ['defeated decimal',2.5,true],['defeated null',null,true],['defeated healthy',4,false],['defeated omitted',undefined,false]]){
 cases.push([label,s=>{if(value===undefined)delete s.defeated;else s.defeated=value},unsafe]);
}
let scenarios=0;
for(const [label,mutate,unsafe] of cases){
 for(const legacy of [false,true]){
  const stored=clone(healthy);mutate(stored);const t=scenario(stored,healthy,legacy);
  assert.equal(t.ctx.window.ThornhavenDamagedSlots(),unsafe,label+' persisted legacy='+legacy);
  t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' save legacy='+legacy);
  if(unsafe){
   for(const [k,raw] of Object.entries(t.initial))assert.equal(t.data.get(k),raw,label+' preserves bytes');
   assert.throws(()=>t.ctx.purchaseCommit(healthy),/Damaged character slots/,label+' paid delivery blocked');
   assert.equal(t.paid,0);
  }else{t.ctx.purchaseCommit(healthy);assert.equal(t.paid,1);}
  scenarios++;
 }
 const live=clone(healthy);mutate(live);const t=scenario(healthy,live);
 t.ctx.saveGame();assert.equal(t.saves,unsafe?0:1,label+' live save');
 if(unsafe){
  assert.equal(t.data.get(S),t.initial[S],label+' safe previous bytes');
  assert.throws(()=>t.ctx.purchaseCommit(live),/Invalid purchase delivery state/,label+' paid delivery blocked');
  assert.equal(t.paid,0);
 }else{t.ctx.purchaseCommit(live);assert.equal(t.paid,1);}
 scenarios++;
}
console.log('PASS '+scenarios+'/'+scenarios+' scenarios: quest flag and defeated-count guard validates stored/legacy/live saves and Play receipt commits (mocked WebView)');

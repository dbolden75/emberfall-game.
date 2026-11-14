#!/usr/bin/env node
'use strict';
// Regress future-region metadata loss using the production purchase-api guard.
// Mocked WebView localStorage; not a physical-device or live Play test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const cases=[
 ['current region state',()=>{},false],
 ['known enemy hit points',s=>{s.mapStates.ashvale.enemies[0].hp=3;},false],
 ['future enemy altitude metadata',s=>{s.mapStates.ashvale.enemies[0].spawnAltitude=105;},true],
 ['future enemy metadata',s=>{s.mapStates.ashvale.enemies[0].futureLoot='relic';},true],
 ['future rune object',s=>{s.mapStates.ashvale.runes[0]={on:true,step:2};},true],
 ['future trap object',s=>{s.mapStates.ashvale.traps[0]={armed:false,phase:3};},true],
 ['future gathering node object',s=>{s.mapStates.ashvale.gatherNodes[0]={readyAt:100,quality:'rare'};},true],
 ['future per-region metadata',s=>{s.mapStates.ashvale.futureQuest={complete:true};},true],
 ['old save omits optional region state',s=>{delete s.mapStates;},false],
];
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const base={player:{name:'QA',class:'warrior'},mapId:'ashvale',mapStates:{ashvale:{enemies:[{x:100,y:200,spawnX:100,spawnY:200,hp:8,maxHp:10,alive:true,lootClaimed:false,respawnAt:0}],runes:[true],traps:[false],gatherNodes:[12],runeProgress:0}}};
let checks=0,blocked=0,permitted=0;
for(const [label,mutate,unsafe] of cases)for(const legacy of [false,true]){
 const state=structuredClone(base);mutate(state);
 const initial=legacy?{[L]:JSON.stringify(state)}:{[S]:JSON.stringify({slot1:{state}})};
 const store={...initial},elements=new Map();let saves=0,deliveries=0;
 const document={getElementById:id=>elements.get(id)||{textContent:'',remove(){}},querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),body:{appendChild(el){elements.set(el.id,el)}}};
 const context={window:{},document,console:{error(){},warn(){}},PREMIUM_PRODUCTS:[],premiumProduct:()=>null,renderPremiumShop(){},
  saveGame(){saves++;store[S]=JSON.stringify({slot1:{state:structuredClone(base)}})},snapshotGameState:()=>structuredClone(base),purchaseCommit(){deliveries++},
  localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>store[k]=String(v)},
  SAVE_SLOTS_KEY:S,SAVE_KEY:L,activeSlotId:'slot1',hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  maps:{ashvale:{enemies:[{}],runes:[{}],traps:[{}],gatherNodes:[{}],runeSequence:[]}},itemDefs:{},gearRequirements:()=>true};
 vm.createContext(context);vm.runInContext(source,context,{timeout:1500,filename:'purchase-api.js'});
 assert.equal(context.window.ThornhavenDamagedSlots(),unsafe,label+': classification; legacy='+legacy);checks++;
 context.saveGame();assert.equal(saves,unsafe?0:1,label+': ordinary save; legacy='+legacy);checks++;
 if(unsafe){assert.deepEqual(store,initial,label+': original bytes unchanged; legacy='+legacy);checks++;
  assert.throws(()=>context.purchaseCommit(base),/Damaged character slots/,label+': purchase gate; legacy='+legacy);checks++;
  assert.equal(deliveries,0,label+': delivery refused; legacy='+legacy);checks++;blocked++;
 }else{context.purchaseCommit(base);assert.equal(deliveries,1,label+': healthy delivery; legacy='+legacy);checks++;permitted++;}
}
console.log('PASS '+checks+'/'+checks+': '+blocked+' future/unsafe saves blocked, '+permitted+' historical/current saves permitted.');

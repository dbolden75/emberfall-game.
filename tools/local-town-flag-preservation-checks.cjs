#!/usr/bin/env node
'use strict';
// Protect future relic/home ownership flags from an older-client save or paid
// delivery. Uses mocked WebView storage, not a physical Android device.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const S='emberfall_character_slots_v1', L='emberfall_singleplayer_v1';
const hero={name:'Ava',class:'warrior',level:5,xp:9,coins:55,inventory:[],hp:20,max:30,speed:120,x:480,y:500};
const base={player:hero,mapId:'ashvale',companions:[],townRelicState:{ashvale:true,brackenford:false,stonewatch:false,sunmere:true},ownedHomes:{ashvale:true,brackenford:false,stonewatch:false,sunmere:true}};
let assertions=0;
function trial(label, mutate, shouldBlock, {legacy=false}={}){
 const state=structuredClone(base);mutate(state);
 const initial=legacy?{[L]:JSON.stringify(state)}:{[S]:JSON.stringify({slot1:{state}})};
 const data={...initial};let saves=0,deliveries=0;
 const elements=new Map();
 const document={getElementById:id=>elements.get(id)||({textContent:'',remove(){}}),querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),body:{appendChild(el){elements.set(el.id,el)}}};
 const context={console:{error(){},warn(){}},window:{},document,PREMIUM_PRODUCTS:[],premiumProduct:()=>null,renderPremiumShop:()=>{},hasStarted:true,titleMenuActive:false,switchingCharacter:false,danTesting:()=>false,
  saveGame(){saves++;data[S]=JSON.stringify({slot1:{state:base}})},snapshotGameState:()=>structuredClone(base),purchaseCommit(){deliveries++},
  localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>data[k]=String(v)},SAVE_SLOTS_KEY:S,SAVE_KEY:L,activeSlotId:'slot1',
  maps:{ashvale:{}},itemDefs:{},gearRequirements:()=>true};
 vm.createContext(context);vm.runInContext(source,context,{filename:'purchase-api.js',timeout:1500});
 assert.equal(context.window.ThornhavenDamagedSlots(),shouldBlock,label+': detected');assertions++;
 context.saveGame();assert.equal(saves,shouldBlock?0:1,label+': save');assertions++;
 if(shouldBlock){assert.deepEqual(data,initial,label+': old bytes protected');assertions++;assert.throws(()=>context.purchaseCommit(base),/Damaged character slots/,label+': purchase blocked');assertions++;assert.equal(deliveries,0,label+': no delivery');assertions++;}
 else{context.purchaseCommit(base);assert.equal(deliveries,1,label+': healthy purchase');assertions++;}
}
trial('future town relic region',s=>s.townRelicState.frontier_outpost=true,true);
trial('future owned home region',s=>s.ownedHomes.frontier_outpost=true,true);
trial('future owned home region in legacy slot',s=>s.ownedHomes.frontier_outpost=true,true,{legacy:true});
trial('future town relic region in legacy slot',s=>s.townRelicState.frontier_outpost=true,true,{legacy:true});
trial('malformed relic boolean string',s=>s.townRelicState.ashvale='false',true);
trial('malformed house ownership string',s=>s.ownedHomes.sunmere='false',true);
trial('malformed relic boolean null',s=>s.townRelicState.ashvale=null,true);
trial('malformed house ownership null',s=>s.ownedHomes.sunmere=null,true);
trial('malformed relic flags array',s=>s.townRelicState=[],true);
trial('malformed home flags number',s=>s.ownedHomes=5,true);
trial('legitimate four region flags',()=>{},false);
trial('historical missing relic flags',s=>delete s.townRelicState,false);
trial('historical missing owned home flags',s=>delete s.ownedHomes,false);
trial('historical missing both',s=>{delete s.townRelicState;delete s.ownedHomes},false);
trial('valid false and true mix',s=>{s.townRelicState={ashvale:false};s.ownedHomes={stonewatch:true}},false);
trial('valid empty region records',s=>{s.townRelicState={};s.ownedHomes={}},false);
console.log(`PASS ${assertions}/${assertions}: town relic and owned house save/purchase preservation (mocked storage)`);

#!/usr/bin/env node
'use strict';
// Mocked WebView storage, exercising the actual purchase-api.js save and
// purchase gates. This is not a physical device or live Play checkout test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||'app/src/main/assets/purchase-api.js','utf8');
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const hero={name:'Ava',class:'warrior',level:5,xp:9,coins:55,inventory:[],hp:20,max:30,speed:120,x:480,y:500};
const base={player:hero,mapId:'ashvale',houseStorage:{brackenford:{front_chest:[{id:'potion',count:2}],side_chest:[]},ashvale:{front_chest:[],side_chest:[]}},gatheringSkills:{mining:{xp:120,level:3},woodcutting:{xp:0,level:1},fishing:{xp:10,level:1}}};
let assertions=0,blocked=0,healthy=0;
function trial(label,mutate,shouldBlock,{legacy=false}={}){
 const state=structuredClone(base);mutate(state);
 const initial=legacy?{[L]:JSON.stringify(state)}:{[S]:JSON.stringify({slot1:{state}})};
 const data={...initial};let saves=0,deliveries=0;
 const elements=new Map();
 const document={getElementById:id=>elements.get(id)||({textContent:'',remove(){}}),querySelectorAll:()=>[],querySelector:()=>null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),body:{appendChild(el){elements.set(el.id,el)}}};
 const ctx={console:{error(){},warn(){}},window:{},document,PREMIUM_PRODUCTS:[],premiumProduct:()=>null,renderPremiumShop:()=>{},
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,danTesting:()=>false,
  saveGame(){saves++;data[S]=JSON.stringify({slot1:{state:base}})},snapshotGameState:()=>structuredClone(base),purchaseCommit(){deliveries++},
  localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>data[k]=String(v)},
  SAVE_SLOTS_KEY:S,SAVE_KEY:L,activeSlotId:'slot1',maps:{ashvale:{}},itemDefs:{},gearRequirements:()=>true};
 vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'purchase-api.js',timeout:1500});
 assert.equal(ctx.window.ThornhavenDamagedSlots(),shouldBlock,label+': classification');assertions++;
 ctx.saveGame();assert.equal(saves,shouldBlock?0:1,label+': ordinary save gate');assertions++;
 if(shouldBlock){
  blocked++;
  assert.deepEqual(data,initial,label+': original stored bytes preserved');assertions++;
  assert.throws(()=>ctx.purchaseCommit(base),/Damaged character slots/,label+': purchase blocked');assertions++;
  assert.equal(deliveries,0,label+': no delivery');assertions++;
 }else{
  healthy++;
  ctx.purchaseCommit(base);assert.equal(deliveries,1,label+': valid purchase delivery');assertions++;
 }
}
trial('future home ID',s=>s.houseStorage.mistport={front_chest:[{id:'relic',count:1}]},true);
trial('future home ID in legacy save',s=>s.houseStorage.mistport={front_chest:[]},true,{legacy:true});
trial('future nested chest',s=>s.houseStorage.ashvale.basement_chest=[{id:'artifact',count:1}],true);
trial('future nested chest in legacy save',s=>s.houseStorage.ashvale.basement_chest=[],true,{legacy:true});
trial('future root chest',s=>s.houseStorage.vault_chest=[{id:'artifact',count:1}],true);
trial('present malformed chest',s=>s.houseStorage.ashvale.front_chest='items',true);
trial('conflicting old and new brackenford chest',s=>s.houseStorage.front_chest=[{id:'artifact',count:1}],true);
trial('conflicting old and new brackenford side chest',s=>s.houseStorage.side_chest=[{id:'artifact',count:1}],true);
trial('future gathering skill',s=>s.gatheringSkills.alchemy={xp:1,level:1},true);
trial('future gathering skill legacy save',s=>s.gatheringSkills.sailing={xp:50,level:2},true,{legacy:true});
trial('future skill metadata',s=>s.gatheringSkills.mining.prestige=2,true);
trial('future skill metadata in legacy save',s=>s.gatheringSkills.fishing.specialization='river',true,{legacy:true});
trial('skill XP string',s=>s.gatheringSkills.mining.xp='120',true);
trial('skill XP negative',s=>s.gatheringSkills.woodcutting.xp=-1,true);
trial('skill level out of range',s=>s.gatheringSkills.mining.level=11,true);
trial('skill level invalid',s=>s.gatheringSkills.mining.level='3',true);
trial('healthy current game save',()=>{},false);
trial('healthy current game legacy save',()=>{},false,{legacy:true});
trial('old save without house storage',s=>delete s.houseStorage,false);
trial('old save without gathering skills',s=>delete s.gatheringSkills,false);
trial('old save with empty both',s=>{s.houseStorage={};s.gatheringSkills={}},false);
trial('old save with only gathering skill XP',s=>s.gatheringSkills={mining:{xp:0}},false);
trial('old save with skill row missing XP',s=>s.gatheringSkills={mining:{}},false);
trial('old root chest',s=>{s.houseStorage={front_chest:[{id:'potion',count:1}],side_chest:[]}},false);
trial('root and nested matching chest',s=>s.houseStorage.front_chest=structuredClone(s.houseStorage.brackenford.front_chest),false);
trial('root and nested matching side chest',s=>s.houseStorage.side_chest=[],false);
trial('current known home with partial chest list',s=>s.houseStorage={sunmere:{side_chest:[]}},false);
console.log('PASS '+assertions+'/'+assertions+': '+blocked+' blocked and '+healthy+' permitted mocked save/purchase scenarios');

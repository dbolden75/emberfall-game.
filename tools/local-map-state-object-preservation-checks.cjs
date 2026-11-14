#!/usr/bin/env node
'use strict';
// A newer game may add rune steps, chest states and treasure data to a
// known region. Older clients must not erase them when saving or delivering
// purchased items. This exercises mocked WebView storage, not live purchases.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const hero={name:'Ava',class:'warrior',level:5,xp:3,coins:40,inventory:[],hp:20,max:30,speed:120,x:480,y:500};
const maps={
 ashvale:{enemies:[],runes:[{}],runeSequence:[0],traps:[],gatherNodes:[],chest:{open:false},treasure:{opened:false}},
 sunmere:{enemies:[],runes:[],runeSequence:[],traps:[],gatherNodes:[],chest:null,treasure:null}
};
const base={player:hero,mapId:'ashvale',mapStates:{
 ashvale:{runes:[false],runeProgress:0,chest:{open:false},treasure:{opened:false}},
 sunmere:{runeProgress:0,chest:null,treasure:null}
},companions:[]};
let assertions=0;
function trial(label,mutate,damaged,{legacy=false}={}){
 const saved=structuredClone(base);mutate(saved);
 const initial=legacy?{[L]:JSON.stringify(saved)}:{[S]:JSON.stringify({slot1:{state:saved}})};
 const data={...initial};let saves=0,delivers=0;
 const elems=new Map();
 const document={getElementById:id=>elems.get(id)||({textContent:'',remove(){}}),querySelectorAll:()=>[],querySelector:()=>null,
  createElement:()=>({style:{},setAttribute(){},remove(){elems.delete(this.id)}}),body:{appendChild(el){elems.set(el.id,el)}}};
 const ctx={console:{error(){},warn(){}},window:{},document,PREMIUM_PRODUCTS:[],premiumProduct:()=>null,
  renderPremiumShop:()=>{},hasStarted:true,titleMenuActive:false,switchingCharacter:false,danTesting:()=>false,
  saveGame(){saves++;data[S]=JSON.stringify({slot1:{state:base}})},
  snapshotGameState:()=>structuredClone(base),purchaseCommit(){delivers++},
  localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>data[k]=String(v)},
  SAVE_SLOTS_KEY:S,SAVE_KEY:L,activeSlotId:'slot1',maps,itemDefs:{},gearRequirements:()=>true};
 vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'purchase-api.js',timeout:1000});
 assert.equal(ctx.window.ThornhavenDamagedSlots(),damaged,label+': classification');assertions++;
 ctx.saveGame();
 assert.equal(saves,damaged?0:1,label+': ordinary save gate');assertions++;
 if(damaged){
  assert.deepEqual(data,initial,label+': original bytes preserved');assertions++;
  assert.throws(()=>ctx.purchaseCommit(base),/Damaged character slots/,label+': purchase delivery blocked');assertions++;
  assert.equal(delivers,0,label+': no purchase commit');assertions++;
 }else{
  ctx.purchaseCommit(base);assert.equal(delivers,1,label+': valid purchase delivery');assertions++;
 }
}
trial('future rune sequence progress',s=>s.mapStates.ashvale.runeProgress=2,true);
trial('non-integer rune progress',s=>s.mapStates.ashvale.runeProgress=.5,true);
trial('non-numeric rune progress',s=>s.mapStates.ashvale.runeProgress='1',true);
trial('null rune progress',s=>s.mapStates.ashvale.runeProgress=null,true);
trial('false-string chest open',s=>s.mapStates.ashvale.chest.open='false',true);
trial('malformed chest flag',s=>s.mapStates.ashvale.chest.open=null,true);
trial('malformed treasure flag',s=>s.mapStates.ashvale.treasure.opened={},true);
trial('future chest field',s=>s.mapStates.ashvale.chest={open:false,lootTier:4},true);
trial('future treasure field',s=>s.mapStates.ashvale.treasure={opened:false,rareDrop:1},true);
trial('future chest in old map',s=>s.mapStates.sunmere.chest={open:true},true);
trial('future treasure in old map',s=>s.mapStates.sunmere.treasure={opened:true},true);
trial('future rune in legacy save',s=>s.mapStates.ashvale.runeProgress=2,true,{legacy:true});
trial('valid current world state',()=>{},false);
trial('valid in-range rune progress',s=>s.mapStates.ashvale.runeProgress=1,false);
trial('old state without these fields',s=>{delete s.mapStates.ashvale.runeProgress;delete s.mapStates.ashvale.chest;delete s.mapStates.ashvale.treasure},false);
trial('historical state without map states',s=>{delete s.mapStates},false);
trial('old nullable chest and treasure',s=>{s.mapStates.ashvale.chest=null;s.mapStates.ashvale.treasure=null},false);
console.log('PASS '+assertions+'/'+assertions+': rune/chest/treasure save and purchase durability (mocked WebView storage)');

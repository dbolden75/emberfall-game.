#!/usr/bin/env node
'use strict';
// A newer game may add enemies, puzzle runes, traps or resource nodes to a
// known region. An older build must preserve the extra saved entries instead
// of silently truncating them during ordinary saves or paid delivery.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const hero={name:'Ava',class:'warrior',level:5,xp:3,coins:40,inventory:[],hp:20,max:30,speed:120,x:480,y:500};
const row={enemies:[{x:1,y:2,alive:true}],runes:[true],traps:[false],gatherNodes:[0]};
const base={player:hero,mapId:'ashvale',mapStates:{ashvale:row},companions:[]};
const maps={ashvale:{enemies:[{catalogSummoned:false}],runes:[{}],traps:[{}],gatherNodes:[{}]}};
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
trial('future enemy record',s=>s.mapStates.ashvale.enemies.push({x:99,y:99}),true);
trial('future puzzle rune',s=>s.mapStates.ashvale.runes.push(true),true);
trial('future trap',s=>s.mapStates.ashvale.traps.push(false),true);
trial('future gathering node',s=>s.mapStates.ashvale.gatherNodes.push(100),true);
trial('malformed enemy list',s=>s.mapStates.ashvale.enemies=null,true);
trial('malformed rune list',s=>s.mapStates.ashvale.runes='missing',true);
trial('malformed gathering list',s=>s.mapStates.ashvale.gatherNodes=2,true);
trial('malformed region record',s=>s.mapStates.ashvale=42,true);
trial('future enemy in legacy save',s=>s.mapStates.ashvale.enemies.push({x:99}),true,{legacy:true});
trial('valid saved map state',()=>{},false);
trial('historical map state subset',s=>{s.mapStates.ashvale={enemies:[]}},false);
trial('historical save without map states',s=>{delete s.mapStates},false);
console.log('PASS '+assertions+'/'+assertions+': map-state array integrity across saves and purchase (mocked WebView storage)');

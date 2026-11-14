#!/usr/bin/env node
'use strict';
// Active-map save regression using real purchase-api.js and mocked WebView storage.
// Newer saved map IDs must never be overwritten by an older game build.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const source=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(dir,'purchase-api.js'),'utf8');
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const hero={name:'Ava',class:'warrior',level:5,xp:3,coins:40,inventory:[],hp:20,max:30,speed:120,x:480,y:500};
const base={player:hero,mapId:'ashvale',mapStates:{ashvale:{enemies:[]}},companions:[]};
let assertions=0;
function trial(label,mutate,damaged,{legacy=false,missing=false}={}){
 const saved=structuredClone(base);mutate(saved);
 const initial=missing?{}:legacy?{[L]:JSON.stringify(saved)}:{[S]:JSON.stringify({slot1:{state:saved}})};
 const data={...initial},elements=new Map();let saves=0,delivers=0;
 const document={getElementById:id=>elements.get(id)||({textContent:'',remove(){}}),querySelectorAll:()=>[],querySelector:()=>null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),body:{appendChild(el){elements.set(el.id,el)}}};
 const context={console:{error(){},warn(){}},window:{},document,PREMIUM_PRODUCTS:[],premiumProduct:()=>null,
  renderPremiumShop:()=>{},hasStarted:true,titleMenuActive:false,switchingCharacter:false,danTesting:()=>false,
  saveGame(){saves++;data[S]=JSON.stringify({slot1:{state:base}})},
  snapshotGameState:()=>structuredClone(base),purchaseCommit(){delivers++},
  localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>data[k]=String(v)},
  SAVE_SLOTS_KEY:S,SAVE_KEY:L,activeSlotId:'slot1',maps:{ashvale:{},stonewatch:{}}};
 vm.createContext(context);vm.runInContext(source,context,{filename:'purchase-api.js',timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),damaged,label+': classification');assertions++;
 context.saveGame();
 assert.equal(saves,damaged?0:1,label+': save commit allowed only if safe');assertions++;
 if(damaged){
  assert.deepEqual(data,initial,label+': original bytes preserved');assertions++;
  assert.throws(()=>context.purchaseCommit(base),/Damaged character slots/,label+': payment not delivered');assertions++;
  assert.equal(delivers,0,label+': no purchase commit');assertions++;
 }else{
  context.purchaseCommit(base);
  assert.equal(delivers,1,label+': valid purchase delivery');assertions++;
 }
}
trial('unknown future active map',s=>{s.mapId='northern_expansion'},true);
trial('unknown future active map in legacy save',s=>{s.mapId='northern_expansion'},true,{legacy:true});
trial('explicit null mapId',s=>{s.mapId=null},true);
trial('numeric mapId',s=>{s.mapId=9},true);
trial('prototype property named mapId',s=>{s.mapId='constructor'},true);
trial('valid mapId',()=>{},false);
trial('valid other mapId',s=>{s.mapId='stonewatch'},false);
trial('historical absent mapId',s=>{delete s.mapId},false);
trial('fresh install',()=>{},false,{missing:true});
console.log('PASS '+assertions+'/'+assertions+': active map ID does not get erased by local save or Play purchase (mocked storage)');

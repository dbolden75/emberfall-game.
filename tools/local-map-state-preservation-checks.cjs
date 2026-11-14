#!/usr/bin/env node
'use strict';
// Real game saveGame() and late-loaded guard, simulated WebView storage only.
// A newer world map's region must not disappear from old-client saved slots.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const client=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(dir,'purchase-api.js'),'utf8');
const a=html.indexOf('function saveGame(){'),b=html.indexOf('function applyDanCompanionGear(',a);
const x=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const y=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */',x);
assert(a>=0&&b>a&&x>=0&&y>x,'packaged routines must be available');
const gameSave=html.slice(a,b);
const guard=client.slice(x,y+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const base={player:{name:'Ava',class:'warrior',level:5,xp:3,coins:40,inventory:[],hp:20,max:30,speed:120,x:480,y:500},
 mapId:'ashvale',mapStates:{ashvale:{enemies:[]}},companions:[]};
let tests=0;
function check(label,change,blocked,{legacy=false,fresh=false}={}){
 const oldState=structuredClone(base);change(oldState);
 // This is what an older game would snapshot: only known maps, not future region progress.
 const state=structuredClone(base);
 const data=new Map(fresh?[]:legacy?[[L,JSON.stringify(oldState)]]:[[S,JSON.stringify({slot1:{state:oldState}})]]);
 const before=new Map(data),elements=new Map();let deliveries=0;
 const document={getElementById:id=>elements.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),
  body:{appendChild:el=>elements.set(el.id,el)}};
 const context={window:{},document,JSON,Date,SAVE_SLOTS_KEY:S,SAVE_KEY:L,
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,activeSlotId:'slot1',saveSlots:{},
  player:base.player,snapshotGameState:()=>structuredClone(state),maps:{ashvale:{},stonewatch:{}},
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))},
  console:{error(){},warn(){}},purchaseCommit(){deliveries++;}};
 vm.createContext(context);vm.runInContext(gameSave,context,{timeout:1500});
 vm.runInContext(guard,context,{timeout:1500});
 assert.equal(context.window.ThornhavenDamagedSlots(),blocked,label+': classification');tests++;
 context.saveGame();
 if(blocked){
  for(const [key,value] of before)assert.equal(data.get(key),value,label+': original bytes');
  assert.throws(()=>context.purchaseCommit({player:state.player}),/Damaged character slots/,label+': no paid delivery');
  assert.equal(deliveries,0,label+': payment delivery not committed');
 }else{
  assert.equal(JSON.parse(data.get(S))?.slot1?.state?.player?.name,'Ava',label+': save allowed');
  context.purchaseCommit({player:state.player});assert.equal(deliveries,1,label+': delivery allowed');
 }
 tests++;
}
check('unknown future region',s=>s.mapStates.future_island={enemies:[{hp:12}]},true);
check('unknown future region in legacy-only save',s=>s.mapStates.future_island={enemies:[{hp:12}]},true,{legacy:true});
check('prototype property named as region',s=>Object.defineProperty(s.mapStates,'constructor',{value:{chest:{open:true}},enumerable:true}),true);
check('null map states',s=>s.mapStates=null,true);
check('array map states',s=>s.mapStates=[],true);
check('known region',s=>s.mapStates.stonewatch={chest:{open:true}},false);
check('historical missing map state',s=>delete s.mapStates,false);
check('historical empty map state',s=>s.mapStates={},false);
check('fresh installation',()=>{},false,{fresh:true});
console.log('PASS '+tests+'/'+tests+': future regional progress protected; historical saves remain writable (mock WebView)');

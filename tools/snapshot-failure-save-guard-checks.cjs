#!/usr/bin/env node
'use strict';
// A transient snapshot error must never bypass validation.
// Real generated game saveGame() and live purchase-api guard, mocked localStorage only.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const client=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const a=html.indexOf('function saveGame(){'),b=html.indexOf('function applyDanCompanionGear(',a);
const first=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const last=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(a>=0&&b>a&&first>=0&&last>first);
const source=html.slice(a,b)+'\n'+client.slice(first,last+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const valid={player:{name:'Ava',class:'warrior',level:7,xp:90,coins:140,hp:30,max:55,speed:120,x:500,y:400,inventory:[{id:'iron_ore',count:2}]},mapId:'ashvale'};
const invalid=structuredClone(valid);invalid.player.coins=null;
let cases=0;
function trial(label,{legacy=false,initial=true,failures=1}={}){
 const old=initial?(legacy?{[L]:JSON.stringify(valid)}:{[S]:JSON.stringify({slot1:{state:valid}})}):{};
 const disk=new Map(Object.entries(old)),elements=new Map();
 let snapshots=0,healthy=false;
 const document={getElementById:id=>elements.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),
  body:{appendChild:element=>elements.set(element.id,element)}};
 const c={window:{},document,Date,JSON,console:{error(){},warn(){}},
  SAVE_SLOTS_KEY:S,SAVE_KEY:L,ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  activeSlotId:'slot1',saveSlots:initial?{slot1:{state:structuredClone(valid)}}:{},player:structuredClone(valid.player),
  snapshotGameState(){snapshots++;if(snapshots<=failures)throw Error('Snapshot temporarily unavailable');return structuredClone(healthy?valid:invalid);},
  localStorage:{getItem:key=>disk.has(key)?disk.get(key):null,setItem:(key,value)=>disk.set(key,String(value))}};
 vm.createContext(c);vm.runInContext(source,c,{timeout:1000});
 c.saveGame();
 assert.deepEqual(Object.fromEntries(disk),old,label+': original save keys and bytes intact');
 assert.equal(snapshots,1,label+': no unvalidated snapshot retry');
 assert.match(elements.get('saveFailureWarning')?.textContent||'',/snapshot could not be verified/i,label+': visible warning');
 healthy=true;c.saveGame();
 if(failures===1){
  assert.equal(JSON.parse(disk.get(S)).slot1.state.player.coins,140,label+': verified retry succeeds');
  assert.equal(elements.has('saveFailureWarning'),false,label+': warning cleared');
 }else assert.deepEqual(Object.fromEntries(disk),old,label+': repeated failure protects bytes');
 cases++;
}
trial('active character transient failure');
trial('legacy-only transient failure',{legacy:true});
trial('new installation transient failure',{initial:false});
trial('repeated snapshot failure',{failures:2});
console.log('PASS '+cases+'/'+cases+': unsafe fallback blocked and healthy retries verified (mocked WebView)');

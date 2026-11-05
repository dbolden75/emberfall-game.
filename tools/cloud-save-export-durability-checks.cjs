#!/usr/bin/env node
'use strict';
// Run the production save method and Cloud Save export preflight against a
// WebView storage backend that may silently refuse or throw on writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const from=html.indexOf('function saveGame(){'),to=html.indexOf('function applyDanCompanionGear(',from);
assert(from>=0&&to>from,'Generated character save routine must exist');
const code=fs.readFileSync(path.join(root,'app/src/main/assets/cloud-save.js'),'utf8');
const a=code.indexOf('/* THORNHAVEN_CLOUD_EXPORT_DURABILITY_START */'),b=code.indexOf('/* THORNHAVEN_CLOUD_EXPORT_DURABILITY_END */');
assert(a>=0&&b>a,'Cloud export preflight must exist');
function scenario(){
 let behavior='ok';
 const disk=new Map(),dom=new Map();
 const hero={name:'Ava',class:'warrior',level:3,coins:5,inventory:[{id:'iron_ore',count:2}]};
 const state={player:hero,mapId:'ashvale',mapStates:{},companions:[],townQuestState:{}};
 const c={hasStarted:true,titleMenuActive:false,switchingCharacter:false,activeSlotId:'slot1',saveSlots:{},player:hero,
   Date,JSON,SAVE_SLOTS_KEY:'emberfall_character_slots_v1',SAVE_KEY:'emberfall_singleplayer_v1',
   ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
   snapshotGameState:()=>structuredClone(state),
   document:{getElementById:id=>dom.get(id)||null,
     createElement:()=>({style:{},setAttribute(){}}),body:{appendChild:el=>dom.set(el.id,el)}},
   console:{error(){},warn(){}},
   localStorage:{getItem:k=>disk.has(k)?disk.get(k):null,
     setItem(k,v){if(k===c.SAVE_SLOTS_KEY&&behavior==='silent')return;
       if(k===c.SAVE_SLOTS_KEY&&behavior==='throw')throw Error('QuotaExceededError');
       disk.set(k,String(v));}},
   core:{SLOT_KEY:'emberfall_character_slots_v1',IDS:['slot1','slot2','slot3','slot4'],
     encode:slots=>JSON.stringify(slots)}};
 vm.createContext(c);vm.runInContext(html.slice(from,to)+'\n'+code.slice(a,b),c,{timeout:1000});
 return {c,hero,disk,dom,setMode:v=>behavior=v};
}
{
 const x=scenario();x.c.saveGame();x.c.titleMenuActive=true;
 assert.equal(JSON.parse(x.c.verifiedBackupText()).slot1.state.player.inventory[0].count,2);
}
{
 const x=scenario();x.c.saveGame();x.hero.inventory[0].count=9;x.setMode('silent');x.c.saveGame();
 x.c.titleMenuActive=true;
 assert.equal(JSON.parse(x.disk.get(x.c.SAVE_SLOTS_KEY)).slot1.state.player.inventory[0].count,2);
 assert.equal(x.c.saveSlots.slot1.state.player.inventory[0].count,9);
 assert.throws(()=>x.c.verifiedBackupText(),/not safely stored/);
 x.c.titleMenuActive=false;x.setMode('ok');x.c.saveGame();x.c.titleMenuActive=true;
 assert.equal(JSON.parse(x.c.verifiedBackupText()).slot1.state.player.inventory[0].count,9);
}
{
 const x=scenario();x.c.saveGame();x.hero.inventory[0].count=15;
 x.setMode('throw');x.c.saveGame();x.c.titleMenuActive=true;
 assert(x.dom.has('saveFailureWarning'));
 assert.throws(()=>x.c.verifiedBackupText(),/not safely stored/);
}
{
 // Loading an older slot can normalize its in-memory object by reference,
 // without any failed disk write. A title-menu backup must save this valid
 // current state instead of falsely refusing a safe export.
 const x=scenario();x.c.saveGame();x.c.titleMenuActive=true;
 x.hero.inventory[0].count=17;
 assert.equal(JSON.parse(x.disk.get(x.c.SAVE_SLOTS_KEY)).slot1.state.player.inventory[0].count,2);
 const text=x.c.verifiedBackupText();
 assert.equal(JSON.parse(text).slot1.state.player.inventory[0].count,17);
 assert.equal(JSON.parse(x.disk.get(x.c.SAVE_SLOTS_KEY)).slot1.state.player.inventory[0].count,17);
 assert.equal(x.c.titleMenuActive,true,'title state must survive verified save');
}
{
 const x=scenario();x.c.saveGame();x.c.titleMenuActive=true;x.c.switchingCharacter=true;
 assert.throws(()=>x.c.verifiedBackupText(),/Character selection is still changing/);
 assert.equal(x.c.titleMenuActive,true);
}
console.log('PASS: normal Cloud Save export; silent write refusal; quota failure; verified retry; cold-start title normalization; character-switch safety.');

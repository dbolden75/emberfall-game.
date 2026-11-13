#!/usr/bin/env node
'use strict';
// Regression on the real WebView save routine and durability guard; mocked
// localStorage only, not a physical device or licensed Google Play purchase.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const api=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const a=html.indexOf('function saveGame(){'),b=html.indexOf('function applyDanCompanionGear(',a);
const first=api.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */'),last=api.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(a>=0&&b>a&&first>=0&&last>first,'Real saveGame() and durable-save guard must exist');
const code=html.slice(a,b)+'\n'+api.slice(first,last+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const healthy={player:{name:'Ava',class:'warrior',level:5,xp:12,coins:40,inventory:[{id:'ore',count:2}],hp:25,max:50,speed:120,x:480,y:500},
 houseStorage:{ashvale:{front_chest:[{id:'ore',count:3}],side_chest:[]}},gatheringSkills:{mining:{xp:40,level:2}},
 gearUpgradeLevels:{iron_blade:2},townQuestState:{},mapId:'ashvale'};
const clone=value=>structuredClone(value);
let cases=0;
function trial(label,{modifyLive=()=>{},modifyPurchase=()=>{},badSave=false,badPurchase=false,legacy=false,firstInstall=false}={}){
 const persisted=clone(healthy),live=clone(healthy),incoming=clone(healthy);
 modifyLive(live);modifyPurchase(incoming);
 const initial=legacy?{[L]:JSON.stringify(persisted)}:firstInstall?{}:{[S]:JSON.stringify({slot1:{state:persisted}})};
 const data=new Map(Object.entries(initial)),elements=new Map();let deliveries=0;
 const document={getElementById:id=>elements.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),
  body:{appendChild:e=>elements.set(e.id,e)}};
 const context={window:{},document,JSON,Date,SAVE_SLOTS_KEY:S,SAVE_KEY:L,
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  activeSlotId:'slot1',saveSlots:{},player:clone(healthy.player),
  snapshotGameState:()=>JSON.parse(JSON.stringify(live)),
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))},
  console:{error(){},warn(){}},purchaseCommit(next){deliveries++;data.set(S,JSON.stringify({slot1:{state:next}}));}};
 vm.createContext(context);vm.runInContext(code,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),false,label+': initially healthy');
 context.saveGame();
 if(badSave){
  for(const [key,value] of Object.entries(initial))assert.equal(data.get(key),value,label+': preserved '+key);
  if(firstInstall)assert.equal(data.get(S),undefined,label+': no invalid first save');
  assert.match(elements.get('saveFailureWarning')?.textContent||'',/Invalid current character/i,label+': visible warning');
 }else assert.equal(JSON.parse(data.get(S)).slot1.state.player.name,'Ava',label+': healthy save');
 // Reset storage to independently verify purchaseCommit cannot accept an unsafe
 // next state even when the currently persisted character is healthy.
 data.clear();for(const [key,value] of Object.entries(initial))data.set(key,value);
 if(badPurchase){
  assert.throws(()=>context.purchaseCommit(incoming),/Invalid purchase delivery state/,label+': paid delivery rejected');
  for(const [key,value] of Object.entries(initial))assert.equal(data.get(key),value,label+': preserved after checkout');
  assert.equal(deliveries,0,label+': purchase not acknowledged');
 }else{context.purchaseCommit(incoming);assert.equal(deliveries,1,label+': valid delivery');}
 cases++;
}
trial('healthy runtime and delivery');
trial('live NaN coins become JSON null',{modifyLive:s=>s.player.coins=NaN,modifyPurchase:s=>s.player.coins=NaN,badSave:true,badPurchase:true});
trial('invalid live HP and purchase speed',{modifyLive:s=>s.player.hp=null,modifyPurchase:s=>s.player.speed='fast',badSave:true,badPurchase:true});
trial('bad forge rank',{modifyLive:s=>s.gearUpgradeLevels.iron_blade=9,modifyPurchase:s=>s.gearUpgradeLevels.iron_blade=9,badSave:true,badPurchase:true});
trial('invalid house chest',{modifyLive:s=>s.houseStorage.ashvale.front_chest=null,modifyPurchase:s=>s.houseStorage.ashvale.front_chest=null,badSave:true,badPurchase:true});
trial('invalid inventory count',{modifyLive:s=>s.player.inventory[0].count=-4,modifyPurchase:s=>s.player.inventory[0].count=-4,badSave:true,badPurchase:true});
trial('invalid gathering XP',{modifyLive:s=>s.gatheringSkills.mining.xp='broken',modifyPurchase:s=>s.gatheringSkills.mining.xp='broken',badSave:true,badPurchase:true});
trial('healthy legacy-only save',{legacy:true});
trial('legacy-only invalid runtime XP',{legacy:true,modifyLive:s=>s.player.xp='corrupt',modifyPurchase:s=>s.player.xp='corrupt',badSave:true,badPurchase:true});
trial('first-install invalid new hero',{firstInstall:true,modifyLive:s=>s.player.class='unknown',modifyPurchase:s=>s.player.class='unknown',badSave:true,badPurchase:true});
console.log('PASS '+cases+'/'+cases+': unsafe in-memory saves and purchase commits rejected; previous save bytes preserved (mocked WebView)');

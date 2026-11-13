#!/usr/bin/env node
'use strict';
// Live game saveGame() plus shipped save guard, with mocked WebView storage.
// Regression for both normal saves and receipt-acknowledgement purchase commits.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const client=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const start=html.indexOf('function saveGame(){'),end=html.indexOf('function applyDanCompanionGear(',start);
const first=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const last=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(start>=0&&end>start&&first>=0&&last>first,'Expected real game save routine and guard');
const source=html.slice(start,end)+'\n'+client.slice(first,last+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const pet={id:'dalen',petVersion:1,hp:50,max:60,x:50,y:60,active:true,weapon:null};
const hero={name:'Tester',class:'warrior',level:7,xp:90,coins:140,hp:40,max:50,speed:100,x:5,y:6,inventory:[]};
const make=pets=>({player:structuredClone(hero),companions:structuredClone(pets),gatheringSkills:{},gearUpgradeLevels:{},houseStorage:{},townQuestState:{},mapId:'ashvale'});
const trials=[
 ['unknown pet ID',[{id:'future_dragon',petVersion:1}],true],
 ['duplicate owned pet',[pet,{...pet}],true],
 ['unsupported migration version',[{...pet,petVersion:'1'}],true],
 ['explicit null pet health',[{...pet,hp:null}],true],
 ['impossible pet location',[{...pet,x:20000}],true],
 ['corrupt equipped gear',[{...pet,weapon:{id:'iron'}}],true],
 ['corrupt combat timer',[{...pet,cool:'never'}],true],
 ['prototype item property',[{...pet,boots:'constructor'}],true],
 ['healthy owned pet',[pet],false],
 ['valid legacy pet equipment',[{id:'sylvi',petVersion:0,boots:'iron_boots'}],false],
 ['legacy pet equipped removed item',[{id:'sylvi',petVersion:0,weapon:'retired_quest_blade'}],true],
 ['legacy pet with omitted version equipped removed item',[{id:'sylvi',boots:'retired_quest_boots'}],true],
 ['legacy pet equipped known item',[{id:'sylvi',petVersion:0,weapon:'short_sword'}],false],
 ['legacy empty equipment sentinel',[{id:'sylvi',petVersion:0,weapon:''}],false],
 ['empty companion roster',[],false]
];
let cases=0;
function check(label,{stored,live,block,legacy=false,purchase=false}){
 const slot={slot1:{id:'slot1',name:hero.name,class:hero.class,level:hero.level,state:stored}};
 const initial=legacy?{[L]:JSON.stringify(stored)}:{[S]:JSON.stringify(slot),[L]:JSON.stringify(stored)};
 const disk=new Map(Object.entries(initial)),elements=new Map();let deliveries=0;
 const document={getElementById:id=>elements.get(id)||null,createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),body:{appendChild:e=>elements.set(e.id,e)}};
 const c={window:{},document,JSON,Date,SAVE_SLOTS_KEY:S,SAVE_KEY:L,ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  activeSlotId:'slot1',saveSlots:legacy?{}:slot,player:structuredClone(live.player),hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  itemDefs:{iron_boots:{slot:'boots'},short_sword:{slot:'weapon'}},
  snapshotGameState:()=>structuredClone(live),console:{warn(){},error(){}},
  localStorage:{getItem:key=>disk.has(key)?disk.get(key):null,setItem:(key,v)=>disk.set(key,String(v))},
  purchaseCommit(next){deliveries++;disk.set(S,JSON.stringify({slot1:{state:next}}));}};
 vm.createContext(c);vm.runInContext(source,c,{timeout:3000});
 if(purchase){
  let failed=false;try{c.purchaseCommit(live)}catch(_){failed=true}
  assert.equal(failed,block,label+': purchase guard');
  assert.equal(deliveries,block?0:1,label+': purchase delivery calls');
 }else c.saveGame();
 if(block){
  assert.deepEqual(Object.fromEntries(disk),initial,label+': original saved bytes preserved');
  assert.match(elements.get('saveFailureWarning')?.textContent||'',/blocked|protected/i,label+': visible warning');
 }else assert(disk.has(S),label+': valid save committed');
 cases++;
}
for(const [label,pets,malformed] of trials){
 const original=make(pets),normalized=make(malformed?[]:pets);
 for(const purchase of [false,true])check(label+(purchase?' purchase':' save'),{stored:original,live:normalized,block:malformed,purchase});
}
for(const purchase of [false,true])check('invalid live pet data'+(purchase?' purchase':' save'),{
 stored:make([pet]),live:make([{id:'future_dragon'}]),block:true,purchase});
for(const purchase of [false,true])check('valid legacy-only save'+(purchase?' purchase':' save'),{
 stored:make([pet]),live:make([pet]),block:false,legacy:true,purchase});
console.log('Companion local-save protection: '+cases+'/'+cases+' mocked WebView scenarios passed');

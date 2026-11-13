#!/usr/bin/env node
'use strict';
// Regression tests for persisted XP, level and coins. No device
// or paid checkout is used; simulated localStorage makes corruption observable.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const client=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const saveStart=html.indexOf('function saveGame(){');
const saveEnd=html.indexOf('function applyDanCompanionGear(',saveStart);
const guardStart=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const guardEnd=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(saveStart>=0&&saveEnd>saveStart&&guardStart>=0&&guardEnd>guardStart);
const saveFunction=html.slice(saveStart,saveEnd);
const guard=client.slice(guardStart,guardEnd+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const SLOT_KEY='emberfall_character_slots_v1',LEGACY_KEY='emberfall_singleplayer_v1';
const healthy={name:'Ava',class:'warrior',level:5,xp:12,coins:48,inventory:[{id:'ore',count:2}],
 hp:25,max:50,speed:120,x:480,y:500};
let cases=0;
function run(label,change,blocked,legacy=false){
 const corrupted=structuredClone(healthy);change(corrupted);
 const incoming={player:corrupted,mapId:'ashvale'};
 const data=new Map(legacy?[[LEGACY_KEY,JSON.stringify(incoming)]]:
  [[SLOT_KEY,JSON.stringify({slot1:{state:incoming}})]]);
 const before=Object.fromEntries(data);
 const elements=new Map();let deliveries=0;
 const document={getElementById:id=>elements.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),
  body:{appendChild:node=>elements.set(node.id,node)}};
 const context={window:{},document,JSON,Date,
  SAVE_SLOTS_KEY:SLOT_KEY,SAVE_KEY:LEGACY_KEY,ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  activeSlotId:'slot1',saveSlots:{},player:healthy,
  snapshotGameState:()=>structuredClone({player:healthy,mapId:'ashvale'}),
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))},
  console:{error(){},warn(){}},purchaseCommit(){deliveries++;}};
 vm.createContext(context);
 vm.runInContext(saveFunction,context,{timeout:1000});
 vm.runInContext(guard,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),blocked,`${label}: corrupt status`);
 context.saveGame();
 if(blocked){
  for(const [key,value] of Object.entries(before))assert.equal(data.get(key),value,`${label}: original ${key} bytes`);
  if(legacy)assert.equal(data.has(SLOT_KEY),false,`${label}: no new authoritative slot`);
  assert.throws(()=>context.purchaseCommit(),/Damaged character slots/,`${label}: paid receipt protected`);
  assert.equal(deliveries,0);
  assert.match(elements.get('saveFailureWarning').textContent,/Restore a verified backup/);
 }else{
  assert.equal(JSON.parse(data.get(SLOT_KEY)).slot1.state.player.name,'Ava',`${label}: normal save`);
  context.purchaseCommit();assert.equal(deliveries,1);
 }
 cases++;
}
const invalid=[
 ['level string',p=>p.level='5'],['level null',p=>p.level=null],
 ['level zero',p=>p.level=0],['level negative',p=>p.level=-1],
 ['level fractional',p=>p.level=3.5],['level unsafe integer',p=>p.level=Number.MAX_SAFE_INTEGER+1],
 ['xp string',p=>p.xp='12'],['xp null',p=>p.xp=null],['xp negative',p=>p.xp=-12],
 ['xp nonfinite',p=>p.xp=Infinity],['coins string',p=>p.coins='48'],
 ['coins null',p=>p.coins=null],['coins negative',p=>p.coins=-1],
 ['coins unsafe magnitude',p=>p.coins=1e100]
];
for(const [name,mutate] of invalid){run('slot '+name,mutate,true);run('legacy '+name,mutate,true,true);}
run('healthy unchanged',()=>{},false);
run('historical missing progress',p=>{delete p.level;delete p.xp;delete p.coins},false);
run('zero XP coins valid',p=>{p.xp=0;p.coins=0},false);
run('fractional XP valid',p=>p.xp=.5,false);
run('fractional coins valid',p=>p.coins=.5,false);
run('zero HP valid',p=>p.hp=0,false);
run('historical omitted vitals',p=>{for(const k of ['hp','max','speed','x','y'])delete p[k]},false);
run('valid negative world offset',p=>p.x=-9999,false);
console.log(`PASS ${cases}/${cases}: corrupt saved progression preserves local and legacy bytes, blocks paid delivery; valid and historical cases save (mocked WebView)`);

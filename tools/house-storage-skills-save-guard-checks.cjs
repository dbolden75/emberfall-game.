#!/usr/bin/env node
'use strict';
// Actual WebView saveGame() plus durability guard; simulated storage, no device or Play checkout.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=process.env.THORNHAVEN_ASSETS||path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const client=fs.readFileSync(process.env.THORNHAVEN_CLIENT||path.join(assets,'purchase-api.js'),'utf8');
const a=html.indexOf('function saveGame(){'),b=html.indexOf('function applyDanCompanionGear(',a);
const first=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const last=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(a>=0&&b>a&&first>=0&&last>first);
const saveFn=html.slice(a,b);
const guard=client.slice(first,last+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1';
const healthy={player:{name:'Ava',class:'warrior',level:5,xp:12,coins:40,inventory:[{id:'ore',count:2}],hp:25,max:50,speed:120,x:480,y:500},
 houseStorage:{ashvale:{front_chest:[{id:'ore',count:3}],side_chest:[]},brackenford:{front_chest:[],side_chest:[]}},
 gatheringSkills:{mining:{xp:40,level:1},woodcutting:{xp:50,level:2},fishing:{xp:0,level:1}},mapId:'ashvale'};
let cases=0;
function trial(label,change,blocked,legacy=false){
 const state=structuredClone(healthy);change(state);
 const data=new Map(legacy?[[L,JSON.stringify(state)]]:[[S,JSON.stringify({slot1:{state}})]]);
 const before=Object.fromEntries(data),elements=new Map();let deliveries=0;
 const document={getElementById:id=>elements.get(id)||null,
  createElement:()=>({style:{},setAttribute(){},remove(){elements.delete(this.id)}}),
  body:{appendChild:el=>elements.set(el.id,el)}};
 const context={window:{},document,JSON,Date,SAVE_SLOTS_KEY:S,SAVE_KEY:L,
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  activeSlotId:'slot1',saveSlots:{},player:healthy.player,snapshotGameState:()=>structuredClone(healthy),
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))},
  console:{error(){},warn(){}},purchaseCommit(){deliveries++;}};
 vm.createContext(context);
 vm.runInContext(saveFn,context,{timeout:1000});
 vm.runInContext(guard,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),blocked,label+': classification');
 context.saveGame();
 if(blocked){
  for(const [key,value] of Object.entries(before))assert.equal(data.get(key),value,label+': preserve '+key);
  assert.throws(()=>context.purchaseCommit(),/Damaged character slots/,label+': block paid delivery');
  assert.equal(deliveries,0);
  assert.match(elements.get('saveFailureWarning')?.textContent||'',/Restore a verified backup/);
 }else{
  assert.equal(JSON.parse(data.get(S))?.slot1?.state?.player?.name,'Ava',label+': healthy save');
  context.purchaseCommit();assert.equal(deliveries,1);
 }
 cases++;
}
const broken=[
 ['entire storage null',s=>s.houseStorage=null],
 ['storage text',s=>s.houseStorage='lost'],
 ['storage array',s=>s.houseStorage=[]],
 ['home null',s=>s.houseStorage.ashvale=null],
 ['home array',s=>s.houseStorage.ashvale=[]],
 ['front chest null',s=>s.houseStorage.ashvale.front_chest=null],
 ['side chest numeric',s=>s.houseStorage.ashvale.side_chest=42],
 ['chest stack text count',s=>s.houseStorage.ashvale.front_chest[0].count='3'],
 ['chest stack negative count',s=>s.houseStorage.ashvale.front_chest[0].count=-1],
 ['chest stack blank id',s=>s.houseStorage.ashvale.front_chest[0].id=''],
 ['chest duplicate item',s=>s.houseStorage.ashvale.front_chest.push({id:'ore',count:3})],
 ['old legacy chest null',s=>s.houseStorage.front_chest=null],
 ['old legacy chest invalid stack',s=>s.houseStorage.side_chest=[{id:'ore',count:0}]],
 ['all skills null',s=>s.gatheringSkills=null],
 ['skill row null',s=>s.gatheringSkills.mining=null],
 ['skill row array',s=>s.gatheringSkills.woodcutting=[]],
 ['mining XP text',s=>s.gatheringSkills.mining.xp='40'],
 ['mining XP negative',s=>s.gatheringSkills.mining.xp=-20],
 ['fishing XP null',s=>s.gatheringSkills.fishing.xp=null],
 ['woodcutting XP fractional',s=>s.gatheringSkills.woodcutting.xp=51.5],
 ['woodcutting XP unsafe',s=>s.gatheringSkills.woodcutting.xp=Number.MAX_SAFE_INTEGER+1]
];
for(const [name,mutate] of broken){trial('slot '+name,mutate,true);trial('legacy '+name,mutate,true,true);}
trial('healthy unchanged',()=>{},false);
trial('historical fields omitted',s=>{delete s.houseStorage;delete s.gatheringSkills},false);
trial('historical empty storage and skills',s=>{s.houseStorage={};s.gatheringSkills={}},false);
trial('historical missing XP',s=>{s.gatheringSkills.mining={level:1}},false);
trial('legacy Brackenford chest',s=>{s.houseStorage={front_chest:[{id:'ore',count:1}]}},false);
trial('zero XP valid',s=>{s.gatheringSkills.fishing.xp=0},false);
console.log('PASS '+cases+'/'+cases+': malformed chests and gathering XP protected; older saves remain valid (mocked WebView)');

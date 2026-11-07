#!/usr/bin/env node
'use strict';
// Reproduce actual shop failure on malformed Cloud Save _townStock, and ensure
// rejected imports cannot replace a player's existing character or recovery.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const live=game.match(/^function townStock\(town\)\{[^\n]+/m);
assert(live,'The current game must define townStock()');
const broken={ashvale:{remaining:900,items:null}};
assert.throws(()=>vm.runInNewContext(
 'let townQuestState={_townStock:'+JSON.stringify(broken)+'};'+
 'const shopDefs={};function townBarterDefs(){return {ashvale:{resource:"iron_ore",gear:"short_sword"}}};'+
 'function shopTown(){return null};function townStockCap(){return 20};'+
 live[0]+';townStock("ashvale")',{Number,Object,Set}),
 /Cannot read properties of null/,
 'Pre-fix game shop crashes while accessing a null stock inventory');
function row(stock){return {id:'slot1',name:'Traveler',class:'warrior',level:3,updated:100,state:{
 player:{name:'Traveler',class:'warrior',level:3,coins:12,xp:5,hp:20,max:20,x:400,y:400,speed:180,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[]}},
 townQuestState:stock===undefined?{}:{_townStock:stock}
}};}
const payload=stock=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:row(stock)}});
const original=JSON.stringify({slot1:row(undefined)});
let assertions=1;
const malformed=[
 {ashvale:{remaining:900,items:null}},
 {ashvale:{remaining:900}},
 {ashvale:{remaining:900,items:[]}},
 {ashvale:'purchased'},
 {ashvale:[]},
 {ashvale:{remaining:'Infinity',items:{iron_ore:0}}},
 {ashvale:{remaining:1e308,items:{iron_ore:0}}},
 {ashvale:{remaining:-1,items:{iron_ore:0}}},
 {ashvale:{remaining:null,items:{iron_ore:0}}},
 {ashvale:{items:{iron_ore:0}}},
 {ashvale:{remaining:600,items:{iron_ore:'5'}}},
 {ashvale:{remaining:600,items:{iron_ore:-1}}},
 {ashvale:{remaining:600,items:{iron_ore:null}}}
];
for(const stock of malformed){
 assert.throws(()=>core.parse(payload(stock)),/Invalid saved town quest progress/);assertions++;
 assert.equal(core.readLocal(JSON.stringify({slot1:row(stock)})).unreadable,true);assertions++;
 const stored=new Map([[core.SLOT_KEY,original],[core.RECOVERY_KEY,'existing recovery']]);let writes=0;
 const storage={getItem:key=>stored.get(key)??null,
  setItem:(key,val)=>{writes++;stored.set(key,val)},
  removeItem:key=>{writes++;stored.delete(key)}};
 assert.throws(()=>core.restore(storage,payload(stock),{confirmed:true,allowOlder:true}),
  /Invalid saved town quest progress/);assertions++;
 assert.equal(writes,0,'Reject bad backups before any write');assertions++;
 assert.equal(stored.get(core.SLOT_KEY),original);assertions++;
 assert.equal(stored.get(core.RECOVERY_KEY),'existing recovery');assertions++;
}
for(const stock of [undefined,{}, {ashvale:null}, {ashvale:{remaining:900,items:{}}},
 {ashvale:{remaining:899.25,items:{iron_ore:20,potion_25:0}}},
 {brackenford:{remaining:0,items:{wood_log:12}}},
 {future_town:{remaining:'new rules',items:{future_item:'ignored by old game'}}}]){
 assert.doesNotThrow(()=>core.parse(payload(stock)));assertions++;
 assert.equal(core.readLocal(JSON.stringify({slot1:row(stock)})).unreadable,false);assertions++;
}
console.log('PASS '+assertions+' town shop inventory/restore assertions');

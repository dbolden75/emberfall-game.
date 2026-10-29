'use strict';
// Reject lossy character backups before replacing existing quest progress.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
// Both real quest and Slayer Hall handlers do this increment.
assert.match(game,/st\.kills=Math\.min\(q\.target,st\.kills\+1\)/);
assert.match(game,/h\.kills=Math\.min\(h\.target,h\.kills\+1\)/);
assert.equal(Math.min(6,'4'+1),6,'Reproduce: string progress immediately completes a six-kill quest');
assert.equal(Math.min(6,4+1),5,'Correct numeric progress takes another kill');
function row(quests){return {id:'slot1',updated:100,state:{
  player:{name:'Slayer',class:'warrior',level:4,coins:15,inventory:[]},
  mapId:'ashvale',companions:[],mapStates:{},townQuestState:quests
}};}
function backup(quests){return JSON.stringify({format:'thornhaven-save',schema:1,
  createdAt:100,activeSlot:'slot1',slots:{slot1:row(quests)}});}
const bad=[
 {ashvale_patrol:{accepted:true,kills:'4',claimed:false}},
 {ashvale_patrol:{accepted:true,kills:true}},
 {ashvale_patrol:{kills:-1}},
 {ashvale_patrol:{kills:1.5}},
 {ashvale_patrol:{kills:['4']}},
 {_slayers:{hunts:{road_beast:{accepted:true,target:6,kills:'4'}}}},
 {_campPatrol:{accepted:true,kills:'2'}},
 {recruit_eryn:{accepted:true,kills:'1'}}
];
for(const quest of bad){
 assert.throws(()=>core.parse(backup(quest)),/Invalid saved town quest progress/,
   'Reject malformed quest progress '+JSON.stringify(quest));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(quest)})).unreadable,true,
   'Flag malformed existing character before replacing it');
}
const valid=[{}, {ashvale_patrol:{accepted:true,kills:0,claimed:false}},
 {ashvale_patrol:{accepted:true,kills:4,claimed:false}},
 {ashvale_patrol:{accepted:true,kills:null}},
 {_slayers:{hunts:{road_beast:{accepted:true,target:6,kills:5}}}},
 {_campPatrol:{accepted:false,kills:0}},
 {recruit_eryn:{accepted:true,kills:1}}];
for(const quest of valid)assert.doesNotThrow(()=>core.parse(backup(quest)),
 'Preserve numeric and historical quest snapshots '+JSON.stringify(quest));
const existing=JSON.stringify({slot1:row({ashvale_patrol:{accepted:true,kills:3}})});
const store={items:new Map([[core.SLOT_KEY,existing]]),
 getItem(k){return this.items.has(k)?this.items.get(k):null;},
 setItem(k,v){this.items.set(k,String(v));},
 removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(store,backup({ashvale_patrol:{kills:'4'}}),
 {confirmed:true,allowOlder:true}),/Invalid saved town quest progress/);
assert.equal(store.getItem(core.SLOT_KEY),existing,'Must not overwrite existing character');
assert.equal(store.getItem(core.RECOVERY_KEY),null,'Must not overwrite recovery');
console.log('PASS: quest/slayer/camp kill counters validated; older saves accepted.');

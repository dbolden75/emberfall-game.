'use strict';
// Preserve Hearthstead settlement supplies, building levels and one-time
// task claims when importing an older/partly damaged Android Cloud Save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
// Read the real game function rather than simulating the production loader.
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const match=game.match(/function settlementState\(\)\{.*?return s;\s*\}/s);
assert(match,'Live settlement loader must remain testable');
const live=state=>vm.runInNewContext(
 'const settlementBuildings={hall:1,mill:1,quarry:1,garden:1,forge:1,lodge:1};'+
 'let townQuestState={_settlement:'+JSON.stringify(state)+'};'+match[0]+';settlementState()',
 {Date,Math,Number,Array,Object});
assert.equal(live({stock:{wood:'Infinity'}}).stock.wood,80,
 'Reproduce: restored string Infinity grants a full storehouse');
assert.equal(live({founded:'false'}).founded,true,
 'Reproduce: restored string false incorrectly founds Hearthstead');
assert.equal(live({levels:{hall:'3'}}).levels.hall,3,
 'Reproduce: restored text upgrades Hearth Hall without materials');
assert.equal(live({gathers:{stone:'Infinity'}}).gathers.stone,Infinity,
 'Reproduce: restored text incorrectly completes the mine-node task');
function row(quests){return {id:'slot1',updated:100,state:{
 player:{name:'Settlement tester',class:'warrior',level:4,coins:40,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:quests
}};}
function backup(quests){return JSON.stringify({format:'thornhaven-save',schema:1,
 createdAt:100,activeSlot:'slot1',slots:{slot1:row(quests)}});}
const valid={founded:true,stock:{wood:18,stone:12,food:6},
 pending:{wood:3.125,stone:0,food:0.5},
 levels:{hall:1,mill:0,quarry:0,garden:0,forge:0,lodge:0},
 gathers:{wood:3,stone:2,food:0},claimed:{hearth:true,stone:false},
 kills:7,lastTick:1793290000000};
const bad=[
 'damaged',[],{founded:'false'},{kills:'8'},{kills:-1},
 {lastTick:'1793290000000'},{lastTick:-10},
 {stock:'invalid'},{stock:[]},{stock:{wood:'Infinity'}},
 {stock:{food:'bad'}},{stock:{stone:-1}},
 {pending:{wood:'4.5'}},{pending:{food:'Infinity'}},
 {levels:{hall:'3'}},{levels:{hall:4}},{levels:{forge:-1}},
 {claimed:'damaged'},{claimed:{hearth:'false'}},{claimed:{roads:1}},
 {gathers:{stone:'Infinity'}},{gathers:{wood:1.5}},
 {gathers:{food:-1}}
];
for(const entry of bad){const quests={_settlement:entry};
 assert.throws(()=>core.parse(backup(quests)),/Invalid saved town quest progress/,
  'Reject corrupted settlement progress '+JSON.stringify(entry));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(quests)})).unreadable,true,
  'Flag corrupted local settlement progress before replacing character');
}
const accepted=[null,{},valid,{founded:false,stock:{wood:0},claimed:{hearth:false}},
 {stock:{wood:3.75},pending:{stone:1.25}},{levels:{hall:0,lodge:3}},
 {gathers:{wood:12},kills:8,lastTick:0},
 // Unknown forward-compatible metadata is not interpreted by old loaders.
 {futureExtension:{field:'ok'},stock:{wood:2,new_resource:'next_release'}}];
for(const entry of accepted)assert.doesNotThrow(()=>core.parse(backup({_settlement:entry})),
 'Keep valid and historical settlement snapshots '+JSON.stringify(entry));
const current=JSON.stringify({slot1:row({_settlement:valid})});
const storage={items:new Map([[core.SLOT_KEY,current]]),
 getItem(k){return this.items.has(k)?this.items.get(k):null;},
 setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(storage,backup({_settlement:{stock:{wood:'Infinity'}}}),
 {confirmed:true,allowOlder:true}),/Invalid saved town quest progress/);
assert.equal(storage.getItem(core.SLOT_KEY),current,
 'Rejected backup must not overwrite current player progress');
assert.equal(storage.getItem(core.RECOVERY_KEY),null,
 'Rejected backup must preserve previous recovery record');
console.log('PASS: 23 settlement corruption cases rejected; valid and legacy saves preserved.');

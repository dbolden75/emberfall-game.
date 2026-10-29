'use strict';
const assert = require('node:assert/strict');
const core = require('../app/src/main/assets/cloud-save-core.js');
function character(houseStorage){return {
 id:'slot1',name:'Chest owner',class:'warrior',level:3,updated:100,
 state:{player:{name:'Chest owner',class:'warrior',level:3,coins:25,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{},houseStorage}
};}
function backup(houseStorage){return JSON.stringify({
 format:'thornhaven-save',schema:1,createdAt:500,activeSlot:'slot1',
 slots:{slot1:character(houseStorage)}
});}
const iron=[{id:'iron',count:2}],gold=[{id:'gold',count:4}];
// The game reads modern town chests and then *overwrites* them with legacy
// root-level chests. If both values disagree, restore must not silently lose
// the Brackenford items from one of these storage formats.
for(const chest of ['front_chest','side_chest']){
 const duplicate={brackenford:{[chest]:iron},[chest]:iron};
 assert(core.parse(backup(duplicate)),'Equal legacy/modern copies remain compatible');
 const conflict={brackenford:{[chest]:iron},[chest]:gold};
 const raw=JSON.stringify({slot1:character(conflict)});
 assert.throws(()=>core.parse(backup(conflict)),/Invalid house chest contents/,
  `Conflicting ${chest} must be detected before lossy import`);
 assert.equal(core.readLocal(raw).unreadable,true,
  'Conflicting stored local chest requires explicit replacement warning');
 const original=JSON.stringify({slot1:character({ashvale:{front_chest:iron}})});
 const storage={value:original,getItem(k){return k===core.SLOT_KEY?this.value:null;},setItem(k,v){if(k===core.SLOT_KEY)this.value=v;},removeItem(){}};
 assert.throws(()=>core.restore(storage,backup(conflict),{confirmed:true,allowOlder:true,expectedCurrent:original}),
  /Invalid house chest contents/);
 assert.equal(storage.value,original,'Rejected backup must preserve current characters');
}
for(const historical of [
 {front_chest:iron},
 {side_chest:gold},
 {brackenford:{front_chest:iron}},
 {brackenford:{side_chest:gold}},
 {brackenford:{front_chest:iron,side_chest:gold},front_chest:iron,side_chest:gold},
 {brackenford:{front_chest:null},front_chest:iron},
 {}
]){
 assert(core.parse(backup(historical)), 'Historical nonconflicting chests still import');
 assert.equal(core.readLocal(JSON.stringify({slot1:character(historical)})).unreadable,false);
}
console.log('PASS: conflicting modern/legacy Brackenford chests rejected before silent overwrite; historical and equal duplicates preserved.');

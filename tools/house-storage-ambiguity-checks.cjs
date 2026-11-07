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
// Restoring newer backups with additional home chests previously succeeded
// but normalizeHouseStorage() ignored the new containers, losing their gear
// on the very next local save. Reject loss before touching existing characters.
for(const futureStorage of [
 {ashvale:{attic_chest:iron}},
 {stonewatch:{vault:{items:gold}}},
 {future_town:{tower_stash:iron}},
 {future_town:{vault:{items:gold}}}
]){
 const bad=backup(futureStorage);
 assert.throws(()=>core.parse(bad),/Invalid house chest contents/);
 assert.equal(core.readLocal(JSON.stringify({slot1:character(futureStorage)})).unreadable,true);
 const current=JSON.stringify({slot1:character({ashvale:{front_chest:iron}})});
 const values=new Map([[core.SLOT_KEY,current],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:k=>values.get(k)??null,
  setItem(k,v){writes++;values.set(k,String(v));},
  removeItem(k){writes++;values.delete(k);}};
 assert.throws(()=>core.restore(storage,bad,{confirmed:true,allowOlder:true,expectedCurrent:current}),
  /Invalid house chest contents/);
 assert.equal(writes,0,'Unrecognized stored items must fail before storage writes');
 assert.equal(values.get(core.SLOT_KEY),current);
 assert.equal(values.get(core.ACTIVE_SLOT_KEY),'slot1');
 assert.equal(values.get(core.RECOVERY_KEY),undefined);
}
// Preserve older/future backups with harmless metadata and empty unrecognized
// chest containers, as well as historical known home chests.
for(const metadata of [
 {ashvale:{attic_chest:[]}},
 {ashvale:{decorations:[1,2],front_chest:iron}},
 {future_town:{tower_stash:[],regionLabel:'new area'}}
]){
 assert.doesNotThrow(()=>core.parse(backup(metadata)));
 assert.equal(core.readLocal(JSON.stringify({slot1:character(metadata)})).unreadable,false);
}

console.log('PASS: conflicting legacy/modern chests and unrecognized future item containers rejected before save changes; harmless metadata preserved.');

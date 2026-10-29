'use strict';
// Cloud Save must not silently import untyped Slayer Hall rewards and ledger entries.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert.match(game,/st\.marks\+=h\.marks/);
assert.match(game,/player\.coins\+=h\.coins/);
assert.match(game,/h\.completed=\(h\.completed\|\|0\)\+1/);
assert.equal('4'+2,'42','Reproduction: string Slayer Marks concatenate instead of adding');
assert.equal(4+2,6,'Valid Slayer Marks add numerically');
function row(quests){return {id:'slot1',updated:100,state:{
 player:{name:'Slayer',class:'warrior',level:4,coins:15,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:quests
}};}
function backup(quests){return JSON.stringify({format:'thornhaven-save',schema:1,
 createdAt:100,activeSlot:'slot1',slots:{slot1:row(quests)}});}
const hunt={accepted:true,kills:2,target:8,marks:2,coins:30,xp:25,completed:0};
const ledger={joined:true,marks:4,completed:3,rankRewards:['Tracker'],hunts:{ash_slimes:hunt}};
const bad=[
 {...ledger,marks:'4'},
 {...ledger,completed:'3'},
 {...ledger,joined:'false'},
 {...ledger,rankRewards:'Tracker'},
 {...ledger,rankRewards:{Tracker:true}},
 {...ledger,hunts:'invalid'},
 {...ledger,hunts:{ash_slimes:{...hunt,marks:'2'}}},
 {...ledger,hunts:{ash_slimes:{...hunt,coins:'30'}}},
 {...ledger,hunts:{ash_slimes:{...hunt,xp:'25'}}},
 {...ledger,hunts:{ash_slimes:{...hunt,completed:'4'}}},
 {...ledger,hunts:{ash_slimes:{...hunt,target:'8'}}},
 {...ledger,hunts:{ash_slimes:{...hunt,target:0}}},
 {...ledger,hunts:{ash_slimes:{...hunt,kills:'2'}}}
];
for(const s of bad){const quests={_slayers:s};
 assert.throws(()=>core.parse(backup(quests)),/Invalid saved town quest progress/,
   'Reject corrupt Slayer ledger '+JSON.stringify(s));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(quests)})).unreadable,true,
   'Reject corrupt existing character during restore conflict review');
}
for(const s of [ledger, {...ledger,marks:0,completed:0,rankRewards:[]},
 {hunts:{ash_slimes:{accepted:true,kills:3,target:8,marks:2,coins:30,xp:25}}},
 {hunts:{}}, {}, null]){
 assert.doesNotThrow(()=>core.parse(backup({_slayers:s})),
  'Keep historical/partial Slayer snapshot '+JSON.stringify(s));
}
const current=JSON.stringify({slot1:row({_slayers:ledger})});
const storage={items:new Map([[core.SLOT_KEY,current]]),getItem(k){return this.items.has(k)?this.items.get(k):null;},setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(storage,backup({_slayers:{...ledger,marks:'4'}}),{confirmed:true,allowOlder:true}),/Invalid saved town quest progress/);
assert.equal(storage.getItem(core.SLOT_KEY),current,'A rejected backup must preserve the current character byte-for-byte');
assert.equal(storage.getItem(core.RECOVERY_KEY),null,'A rejected backup must preserve recovery state');
console.log('PASS: corrupt Slayer Hall marks, rewards, hunts rejected; historical saves accepted.');

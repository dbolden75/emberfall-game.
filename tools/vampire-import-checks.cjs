'use strict';
// Restore must not silently grant vampire powers, skip clues or corrupt hunt progress.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert.match(game,/s\.hunts=Math\.min\(6,\(s\.hunts\|\|0\)\+1\)/);
assert.match(game,/s\.turned\?1:/);
assert.equal('4'+1,'41','Reproduction: saved string hunts concatenates');
assert.equal(4+1,5);
function row(quests){return {id:'slot1',updated:100,state:{
 player:{name:'Night Walker',class:'rogue',level:4,coins:25,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:quests
}};}
function backup(quests){return JSON.stringify({format:'thornhaven-save',schema:1,
 createdAt:100,activeSlot:'slot1',slots:{slot1:row(quests)}});
}
const original={accepted:true,complete:false,choice:'hunt',hunts:4,clues:['whisperwood','redfen','mosslight'],
 cureClues:[],turned:false,cured:false,sanctuary:false,clock:300,hunger:0};
const variants=[
 {...original,hunts:'4'}, {...original,hunts:-1}, {...original,hunts:1.5},
 {...original,turned:'false'}, {...original,accepted:'false'},
 {...original,complete:'false'}, {...original,cured:'false'},
 {...original,sanctuary:'false'}, {...original,choice:'invalid'},
 {...original,clues:'whisperwood'}, {...original,clues:['whisperwood','whisperwood','redfen']},
 {...original,clues:['whisperwood','redfen','made_up']},
 {...original,cureClues:['mosslight','mosslight']},
 {...original,cureClues:['mosslight','invalid']},
 {...original,clock:'300'}, {...original,clock:-1},
 {...original,hunger:'20'}, {...original,hunger:150}
];
for(const v of variants){
 const data=backup({_vampire:v});
 assert.throws(()=>core.parse(data),/Invalid saved town quest progress/,
  'Reject corrupt vampire data '+JSON.stringify(v));
 assert.equal(core.readLocal(JSON.stringify({slot1:row({_vampire:v})})).unreadable,true,
  'Treat corrupted local night-visitor state as unreadable');
}
const accepted=[
 original,{...original,choice:'ally',hunts:0,complete:true,turned:true,hunger:40,clues:['redfen','mosslight','whisperwood'],cureClues:['mosslight','sunmere']},
 {...original,choice:null,clues:[],clock:0}, {},null
];
for(const v of accepted)assert.doesNotThrow(()=>core.parse(backup({_vampire:v})),
 'Preserve valid/legacy vampire data '+JSON.stringify(v));
const old=JSON.stringify({slot1:row({_vampire:original})});
const storage={items:new Map([[core.SLOT_KEY,old]]),getItem(k){return this.items.has(k)?this.items.get(k):null;},setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(storage,backup({_vampire:{...original,hunts:'4'}}),{confirmed:true,allowOlder:true}),/Invalid saved town quest progress/);
assert.equal(storage.getItem(core.SLOT_KEY),old,'Rejected backup cannot overwrite existing characters');
assert.equal(storage.getItem(core.RECOVERY_KEY),null,'Rejected backup cannot replace recovery data');
console.log('PASS: vampire quest save flags, hunt count, clues and timers validated; legacy saves retained.');

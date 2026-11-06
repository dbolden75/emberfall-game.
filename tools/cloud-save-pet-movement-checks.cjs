#!/usr/bin/env node
'use strict';
// A Cloud Save restore must not import malformed pet movement/cooldown values
// into the unnormalized companion object used by the combat and follow AI.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const row=pet=>({id:'slot1',updated:1000,name:'Companion Keeper',class:'warrior',level:3,state:{
 player:{name:'Companion Keeper',class:'warrior',level:3,xp:0,coins:4,inventory:[],hp:30,max:40,x:300,y:200,speed:3},
 mapId:'ashvale',companions:[pet],mapStates:{},townQuestState:{}}});
const backup=pet=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:row(pet)}});
const healthy={id:'dalen',petVersion:1,hp:10,max:20,active:true,x:300,y:200,faceX:1,faceY:0,cool:0,skillCool:0,attack:0};
const invalid={
 'string x':{x:'off-map'},'string y':{y:'200'},'offworld x':{x:100000000},'offworld y':{y:-100000000},
 'text faceX':{faceX:'north'},'text faceY':{faceY:'south'},
 'text cooldown':{cool:'never'},'negative cooldown':{cool:-100},
 'text skill cooldown':{skillCool:'slow'},'negative skill cooldown':{skillCool:-3},
 'text attack':{attack:'heavy'},'negative attack':{attack:-2},
 'text cast timer':{castTime:'forever'},'negative cast timer':{castTime:-1}
};
for(const [label,fields] of Object.entries(invalid)){
 const pet={...healthy,...fields},serialized=backup(pet);
 assert.throws(()=>core.parse(serialized),/companion|pet|movement/i,'Reject '+label);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(pet)})).unreadable,true,label);
 const previous=JSON.stringify({slot1:row(healthy)});
 const saved=new Map([[core.SLOT_KEY,previous],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:key=>saved.get(key)??null,
  setItem:(key,value)=>{writes++;saved.set(key,String(value));},
  removeItem:key=>{writes++;saved.delete(key);}};
 assert.throws(()=>core.restore(storage,serialized,{confirmed:true,allowOlder:true}),/companion|pet|movement/i);
 assert.equal(writes,0,'Rejected companion cannot touch local or recovery keys');
 assert.equal(saved.get(core.SLOT_KEY),previous,'Existing character remains intact');
}
for(const pet of [healthy,{id:'dalen'},
 {...healthy,x:0,y:0,faceX:0,faceY:0,attack:0,cool:0,skillCool:0},
 {...healthy,x:-1000,y:9999,faceX:-1,faceY:1}]){
 assert.doesNotThrow(()=>core.parse(backup(pet)),'Valid or historical pet must remain importable');
}
console.log('PASS: 14 corrupt pet movement/timer states rejected with zero writes; 4 valid/legacy pets accepted.');

#!/usr/bin/env node
'use strict';
// Imported human companions must not be stranded by impossible coordinates or
// broken attack/cooldown timers; failed imports must not overwrite local saves.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const hero={name:'Companion Keeper',class:'warrior',level:8,xp:18,coins:44,inventory:[],hp:30,max:40,x:300,y:200,speed:3};
const human={id:'dalen',name:'Dalen',class:'warrior',human:true,level:8,hp:20,max:30,active:true,x:300,y:200,faceX:1,faceY:0,cool:0,skillCool:0,attack:0,castTime:0};
const row=c=>({id:'slot1',updated:1000,name:hero.name,class:hero.class,level:hero.level,state:{
 player:hero,mapId:'ashvale',companions:[],mapStates:{},townQuestState:{_humanParty:{active:'dalen',roster:{dalen:c}}}}});
const backup=c=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:row(c)}});
const bad={
 'text x':{x:'far away'},'text y':{y:'200'},'extreme x':{x:1e9},'extreme y':{y:-1e9},
 'text facing x':{faceX:'north'},'invalid facing x':{faceX:4},'text facing y':{faceY:'south'},'invalid facing y':{faceY:-3},
 'text cooldown':{cool:'never'},'negative cooldown':{cool:-99},'text skill cooldown':{skillCool:'forever'},'negative skill cooldown':{skillCool:-5},
 'text attack timer':{attack:'slow'},'negative attack timer':{attack:-2},
 'text casting timer':{castTime:'infinite'},'negative casting timer':{castTime:-1}
};
for(const [label,fields] of Object.entries(bad)){
 const damaged={...human,...fields};
 assert.throws(()=>core.parse(backup(damaged)),/human|companion|quest/i,'Reject '+label);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(damaged)})).unreadable,true,'Untrusted local row: '+label);
 const previous=JSON.stringify({slot1:row(human)});
 const current=new Map([[core.SLOT_KEY,previous],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:k=>current.get(k)??null,
  setItem:(k,v)=>{writes++;current.set(k,String(v));},
  removeItem:k=>{writes++;current.delete(k);}};
 assert.throws(()=>core.restore(storage,backup(damaged),{confirmed:true,allowOlder:true}),/human|companion|quest/i,'Refuse '+label);
 assert.equal(writes,0,'Invalid companion must not write any save or recovery data: '+label);
 assert.equal(current.get(core.SLOT_KEY),previous,'Existing saved hero unchanged: '+label);
}
for(const c of [human,{id:'dalen',hp:10,max:20}, {...human,x:-1000,y:9999,faceX:-1,faceY:1},
 {...human,x:null,y:null,faceX:null,faceY:null,cool:null,skillCool:null},
 {...human,cool:0.5,skillCool:3,attack:0.32,castTime:0.45}]){
 assert.doesNotThrow(()=>core.parse(backup(c)),'Historical/valid human companion must remain importable');
}
console.log('PASS: 16 invalid human movement/combat snapshots rejected with zero writes; 5 valid/legacy snapshots accepted.');

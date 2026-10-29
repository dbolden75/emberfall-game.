'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const start=html.indexOf('function normalizePets(){');
assert(start>=0,'Use live game pet normalizer');
let depth=0,end=-1;
for(let k=html.indexOf('{',start);k<html.length;k++){
 if(html[k]==='{')depth++;
 else if(html[k]==='}'&&--depth===0){end=k+1;break;}
}
assert(end>start,'Extract full live normalizer');
const normalize=html.slice(start,end);
function backup(pet){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:1,state:{player:{name:'Test',class:'warrior',level:5,coins:1,inventory:[]},mapId:'ashvale',companions:[pet],mapStates:{},townQuestState:{}}}}});}
function gameState(pet){
 const ctx={companions:[pet],petDefs:{dalen:{hp:68,name:'Cinder',class:'warrior'}},petLevel:()=>5,petMaxHealth:()=>96,GEAR_SLOTS:[]};
 vm.runInNewContext(normalize+';normalizePets();',ctx);
 return ctx.companions[0];
}
// A corrupted false-like value is truthy to the game's normalizer.
assert.equal(gameState({id:'dalen',petVersion:1,hp:30,max:68,active:'false'}).active,true,'Reproduce silent inactive->active mutation in game');
for(const active of ['false','true','0','',0,1,[],{}]){
 const pet={id:'dalen',petVersion:1,hp:30,max:68,active};
 assert.throws(()=>core.parse(backup(pet)),/Invalid saved companion data/,'Reject malformed active flag '+JSON.stringify(active));
 assert.equal(core.readLocal(JSON.stringify({slot1:JSON.parse(backup(pet)).slots.slot1})).unreadable,true,'Reject unsafe local row');
}
for(const active of [true,false,null,undefined]){
 const pet={id:'dalen',petVersion:1,hp:30,max:68};
 if(active!==undefined)pet.active=active;
 assert.doesNotThrow(()=>core.parse(backup(pet)),'Preserve boolean / optional historical active');
}
assert.equal(gameState({id:'dalen',petVersion:1,hp:30,max:68,active:false}).active,false);
assert.equal(gameState({id:'dalen',petVersion:1,hp:30,max:68,active:true}).active,true);
console.log('PASS: corrupted active flags rejected before live game normalization; valid/historical pets compatible.');

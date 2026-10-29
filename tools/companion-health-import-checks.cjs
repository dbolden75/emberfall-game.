'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const start=html.indexOf('function normalizePets(){');
assert(start>=0,'The game normalization function must be available');
let depth=0,end=-1;
for(let k=html.indexOf('{',start);k<html.length;k++){
 if(html[k]==='{')depth++;
 else if(html[k]==='}'&&--depth===0){end=k+1;break;}
}
assert(end>start,'Extract complete live pet normalization function');
const normalize=html.slice(start,end);
function backup(pet){
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:1,state:{player:{name:'Test',class:'warrior',level:5,coins:1,inventory:[]},mapId:'ashvale',companions:[pet],mapStates:{},townQuestState:{}}}}});
}
function loadedHealth(pet){
 const c={companions:[pet],petDefs:{dalen:{hp:68,name:'Cinder',class:'warrior'}},petLevel:()=>5,petMaxHealth:()=>96,GEAR_SLOTS:[]};
 vm.runInNewContext(normalize+';normalizePets();',c);
 return c.companions[0];
}
for(const pet of [
 {id:'dalen',petVersion:1,hp:'corrupt',max:68,active:true},
 {id:'dalen',petVersion:1,hp:'',max:68,active:true},
 {id:'dalen',petVersion:1,hp:-1,max:68,active:true},
 {id:'dalen',petVersion:1,hp:33,max:'corrupt',active:true},
 {id:'dalen',petVersion:1,hp:20,max:-2,active:true}
]){
 assert.throws(()=>core.parse(backup(pet)),/Invalid saved companion data/);
 assert.equal(core.readLocal(JSON.stringify({slot1:JSON.parse(backup(pet)).slots.slot1})).unreadable,true);
}
const healthy={id:'dalen',petVersion:1,hp:32,max:68,active:true};
assert(core.parse(backup(healthy)),'Normal pet remains compatible');
const restored=loadedHealth(healthy);
assert(restored.hp>0&&restored.active,'Valid health is preserved by live game normalization');
assert(core.parse(backup({id:'dalen',petVersion:1,hp:0,max:68,active:false})),'Dead pets remain valid');
assert(core.parse(backup({id:'dalen'})),'Historical pets without optional health fields remain compatible');
console.log('PASS: invalid pet health is rejected before game normalization can silently kill pets.');

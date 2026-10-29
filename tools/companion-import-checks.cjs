'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../app/src/main/assets/cloud-save-core.js');
const ui=fs.readFileSync('app/src/main/assets/cloud-save.js','utf8');
function row(){return {id:'slot1',updated:100,state:{player:{name:'Companion test',class:'warrior',level:2,coins:100,inventory:[]},mapId:'ashvale',companions:[{id:'dalen',petVersion:1,hp:42,active:true}],mapStates:{},townQuestState:{}}};}
function backup(r){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:r}});}
assert(core.parse(backup(row())),'Valid historical pet snapshot must remain accepted');
const empty=row();empty.state.companions=[];
assert(core.parse(backup(empty)),'Empty pet collection must remain supported');
for(const [label,pets] of [
 ['null pet',[null]],['primitive pet',['dalen']],['array pet',[['dalen']]],
 ['missing pet id',[{hp:42}]],['empty pet id',[{id:''}]],
 ['duplicate pet id',[{id:'dalen',hp:42},{id:'dalen',hp:12}]]
]){
 const r=row();r.state.companions=pets;
 assert.throws(()=>core.parse(backup(r)),/Invalid saved companion data/,label);
 assert.equal(core.readLocal(JSON.stringify({slot1:r})).unreadable,true,label);
}
assert.match(ui,/Object\\.prototype\\.hasOwnProperty\\.call\\(petDefs,\\s*companion\\.id\\)/,
 'Backup review must reject pets that are absent from the installed game');
console.log('PASS: Cloud Save refuses malformed, duplicate and unrecognized pet imports; existing pet records still load.');

'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const liveHuman=html.match(/function humanParty\(\)\{[^\n]*\}/)?.[0];
const liveActive=html.match(/function humanCompanion\(\)\{[^\n]*\}/)?.[0];
assert(liveHuman&&liveActive,'Real game human companion code is present');
function backup(party,haveParty=true){
 const townQuestState={};if(haveParty)townQuestState._humanParty=party;
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:1,state:{player:{name:'Test',class:'warrior',level:8,coins:100,xp:50,inventory:[]},mapId:'wayfarers_camp',companions:[],mapStates:{},townQuestState}}}});
}
function companion(humanState){
 const ctx={townQuestState:{_humanParty:humanState}};
 vm.runInNewContext(liveHuman+'\n'+liveActive+'\nhumanCompanion()',ctx);
}
const malformed=[
 'not a party',[],{active:'dalen'},
 {active:'dalen',roster:[]},
 {active:'dalen',roster:{}},
 {active:'__proto__',roster:{}},
 {active:'dalen',roster:{dalen:'invalid'}},
 {active:'dalen',roster:{dalen:{id:'sylvi',hp:20,max:40}}},
 {active:'dalen',roster:{dalen:{id:'dalen',hp:'20',max:40}}},
 {active:'dalen',roster:{dalen:{id:'dalen',hp:80,max:40}}},
 {active:'dalen',roster:{dalen:{id:'dalen',hp:20,max:40,active:'false'}}},
 {active:'dalen',roster:{dalen:{id:'dalen',hp:20,max:40,x:'far'}}},
];
// The real game crashes when its active companion roster is not an object.
assert.throws(()=>companion('not a party'),/Cannot read properties of undefined/);
for(const party of malformed){
 const text=backup(party);
 assert.throws(()=>core.parse(text),/Invalid saved town quest progress/,JSON.stringify(party));
 const slots=JSON.stringify(JSON.parse(text).slots);
 assert.equal(core.readLocal(slots).unreadable,true,'Unsafe local row must be flagged');
}
// Reject corrupt imports atomically, retaining any pre-existing character.
const existing=JSON.stringify(JSON.parse(backup(undefined,false)).slots), storageMap=new Map([[core.SLOT_KEY,existing],[core.ACTIVE_SLOT_KEY,'slot1']]);
const storage={getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
assert.throws(()=>core.restore(storage,backup(malformed[0]),{confirmed:true,allowOlder:true,expectedCurrent:existing}),/Invalid saved town quest progress/);
assert.equal(storage.getItem(core.SLOT_KEY),existing,'Corrupt backup cannot overwrite good saves');
const human={id:'dalen',name:'Dalen',class:'warrior',human:true,level:8,max:75,hp:40,active:true,x:100,y:200,faceX:0,faceY:1,cool:0,skillCool:0};
for(const party of [undefined,null,{active:null,roster:{}},{active:'dalen',roster:{dalen:human}},{active:null,roster:{dalen:{...human,hp:0,active:false}}}])
 assert.doesNotThrow(()=>core.parse(backup(party,party!==undefined)),'Historical, valid and resting human parties remain portable');
assert.doesNotThrow(()=>core.parse(backup(null,false)),'Historical backups without human parties remain valid');
console.log('PASS: corrupt human companion rosters, active slots, health and coordinates rejected before save import; valid and historical states accepted.');

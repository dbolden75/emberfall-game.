#!/usr/bin/env node
'use strict';
// Reproduce a character selector that advertises a different hero or level
// than the saved player. Warn before replacing this damaged local record,
// preserve byte-exact recovery, and keep old saves with missing headers valid.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const state={player:{name:'ActualHero',class:'warrior',level:8,coins:50,xp:17,
 inventory:[{id:'copper_ore',count:3}],weapon:'short_sword'},
 mapId:'ashvale',mapStates:{},townQuestState:{},companions:[]};
const slot=()=>({id:'slot1',name:'ActualHero',class:'warrior',level:8,updated:100,state:structuredClone(state)});
const slots=()=>({slot1:slot()});
const incoming=core.encode(slots(),'slot1',321);
let rejected=0,accepted=0;
for(const [field,value] of [
 ['name','Impostor'],['class','mage'],['level',50],['level','8']
]){
 const damaged=slots();damaged.slot1[field]=value;
 const raw=JSON.stringify(damaged);
 assert.equal(core.readLocal(raw).unreadable,true,field+' mismatch must be marked unreadable');
 const store=new Map([[core.SLOT_KEY,raw],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:k=>store.get(k)??null,
  setItem:(k,v)=>{writes++;store.set(k,v)},removeItem:k=>{writes++;store.delete(k)}};
 assert.throws(()=>core.restore(storage,incoming,{confirmed:true,expectedCurrent:raw}),/unreadable/,
  'Import must request additional consent to replace mismatched '+field+' local character');
 assert.equal(writes,0,'No recovery/slot/selection write before consent for '+field);
 assert.equal(store.get(core.SLOT_KEY),raw,'Do not modify local character');
 core.restore(storage,incoming,{confirmed:true,allowOlder:true,expectedCurrent:raw});
 assert.equal(JSON.parse(store.get(core.RECOVERY_KEY)).slots,raw,
  'After additional consent, preserve byte-exact damaged local save in recovery');
 rejected++;
}
const omitted=slots();for(const key of ['name','class','level'])delete omitted.slot1[key];
assert.equal(core.readLocal(JSON.stringify(omitted)).unreadable,false,
 'Historical rows without selector heading metadata must remain readable');accepted++;
assert.equal(core.readLocal(JSON.stringify(slots())).unreadable,false,
 'Ordinary save must remain readable');accepted++;
console.log('PASS: '+rejected+' damaged slot headings require extra consent and byte-exact recovery; '+accepted+' valid/historical local rows accepted');

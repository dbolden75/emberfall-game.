#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const make=(changes={})=>({format:'thornhaven-save',schema:1,createdAt:1234,activeSlot:'slot1',slots:{slot1:{
 id:'slot1',name:'Hero',class:'warrior',level:2,updated:1234,state:{
 player:{name:'Hero',class:'warrior',level:2,coins:10,inventory:[]},
 mapId:'ashvale',mapStates:{},companions:[],townQuestState:changes
}}}});
function store(previous){
 const data=new Map([[core.SLOT_KEY,previous],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'old-copy']]),writes=[];
 return {writes,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{writes.push(k);data.set(k,String(v));},removeItem:k=>{writes.push(k);data.delete(k);}};
}
const valid=[{}, {_earnedTitle:null}, {_earnedTitle:'earned_trailblazer'},
 {_earnedTitle:'earned_reachkeeper',_equippedPaid:{aura:'emberfall_aura_embers',trail:'emberfall_trail_stars',title:'emberfall_title_champion'}},
 {_equippedPaid:{aura:null,extra:null}}];
for(const q of valid){
 const backup=make(q),str=JSON.stringify(backup);
 assert.deepEqual(core.parse(str).slots.slot1.state.townQuestState,q);
 assert.equal(core.readLocal(JSON.stringify(backup.slots)).unreadable,false);
}
const bad=[{_earnedTitle:'future_title'}, {_earnedTitle:42}, {_equippedPaid:'aura'},
 {_equippedPaid:[]}, {_equippedPaid:{aura:'future_aura'}}, {_equippedPaid:{aura:'emberfall_trail_embers'}},
 {_equippedPaid:{futureSlot:'future_hat'}}, {_equippedPaid:{title:42}}];
for(const q of bad){
 const backup=make(q),str=JSON.stringify(backup),old=JSON.stringify(make({_earnedTitle:'earned_trailblazer'}).slots),storage=store(old);
 assert.throws(()=>core.parse(str),/premium|appearance|town quest/i,`Must refuse lossy appearance ${JSON.stringify(q)}`);
 assert.equal(core.readLocal(JSON.stringify(backup.slots)).unreadable,true);
 assert.throws(()=>core.restore(storage,str,{confirmed:true,allowOlder:true}),/premium|appearance|town quest/i);
 assert.deepEqual(storage.writes,[],`Invalid premium appearance must not overwrite progress ${JSON.stringify(q)}`);
 assert.equal(storage.getItem(core.SLOT_KEY),old);
 assert.equal(storage.getItem(core.RECOVERY_KEY),'old-copy');
}
console.log(`PASS: ${valid.length} historical/valid premium appearances preserved; ${bad.length} lossy selections rejected with no writes`);

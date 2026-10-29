'use strict';
// Regression: false-like text in quest flags must not be accepted before game load.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const baseState=()=>({
 player:{name:'QuestTester',class:'warrior',level:3,coins:50,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{
  ashvale_patrol:{accepted:false,kills:0,claimed:false},
  _slayers:{joined:false,completed:2,hunts:{redfen:{accepted:true,completed:1,kills:0}}},
  briar_hollow:{accepted:false,claimed:false,rescued:false},
  _settlement:{claimed:{hearth:true,lumber:false},gathers:{stone:2}},
 }});
const row=(s)=>({id:'slot1',updated:42,state:s});
const backup=(s)=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:42,activeSlot:'slot1',slots:{slot1:row(s)}});
const ok=s=>assert.doesNotThrow(()=>core.parse(backup(s)));
const bad=s=>assert.throws(()=>core.parse(backup(s)),/quest/i);
ok(baseState());
let s=baseState();s.townQuestState.ashvale_patrol.accepted='false';bad(s);
s=baseState();s.townQuestState.ashvale_patrol.claimed='false';bad(s);
s=baseState();s.townQuestState._slayers.hunts.redfen.accepted='false';bad(s);
s=baseState();s.townQuestState.briar_hollow.rescued='false';bad(s);
s=baseState();s.townQuestState.ashvale_patrol.accepted=null;delete s.townQuestState.ashvale_patrol.claimed;ok(s);
s=baseState();s.townQuestState._slayers.completed=2;s.townQuestState._slayers.hunts.redfen.completed=1;ok(s);
// Malformed saved slot is not silently interpreted as readable local progress.
s=baseState();s.townQuestState.ashvale_patrol.claimed='false';
assert.equal(core.readLocal(JSON.stringify({slot1:row(s)})).unreadable,true);
// Rejected imports must leave existing player progress untouched.
const store={
 values:new Map([[core.SLOT_KEY,JSON.stringify({slot1:row(baseState())})]]),
 getItem(k){return this.values.has(k)?this.values.get(k):null},
 setItem(k,v){this.values.set(k,String(v))},
 removeItem(k){this.values.delete(k)},
};
const before=store.getItem(core.SLOT_KEY);
assert.throws(()=>core.restore(store,backup(s),{confirmed:true,allowOlder:true}),/quest/i);
assert.equal(store.getItem(core.SLOT_KEY),before);
assert.equal(store.getItem(core.RECOVERY_KEY),null);
console.log('PASS: town quest acceptance, claim and rescue flags are validated before restore; legacy counts remain valid.');

// Verify rollback and recovery behavior when browser storage partially fails.
// Tests the exact Cloud Save runtime core; no device/emulator claim.
'use strict';
const assert = require('node:assert/strict');
const core = require(process.env.THORNHAVEN_CORE_PATH || '../app/src/main/assets/cloud-save-core.js');
function state(name){return {player:{name,class:'warrior',level:9,coins:20,xp:15,inventory:[]},mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}};}
function backup(name,updated){return core.encode({slot1:{id:'slot1',updated,state:state(name)},slot2:{id:'slot2',updated,state:state(name+' second')}},'slot1',1000);}
const prior=JSON.parse(backup('Existing',100));
const incoming=backup('Imported',200);
const initial={
 [core.SLOT_KEY]:JSON.stringify(prior.slots),
 [core.ACTIVE_SLOT_KEY]:'slot2',
 [core.RECOVERY_KEY]:'older saved recovery'
};
function store(mode){
 const m=new Map(Object.entries(initial));
 let writes=0;
 return {
  getItem(k){return m.has(k)?m.get(k):null;},
  setItem(k,v){
   ++writes;
   if(mode==='recovery-silent'&&k===core.RECOVERY_KEY&&writes===1)return;
   if(mode==='active-silent'&&k===core.ACTIVE_SLOT_KEY&&writes===2)return;
   if(mode==='slots-silent'&&k===core.SLOT_KEY&&writes===3)return;
   if(mode==='recovery-after-write'&&k===core.RECOVERY_KEY&&writes===1){m.set(k,String(v));throw Error('recovery write interrupted');}
   if(mode==='active-after-write'&&k===core.ACTIVE_SLOT_KEY&&writes===2){m.set(k,String(v));throw Error('active write interrupted');}
   if(mode==='slots-after-write'&&k===core.SLOT_KEY&&writes===3){m.set(k,String(v));throw Error('slot write interrupted');}
   if(mode==='rollback-fails'&&k===core.SLOT_KEY&&writes===3){m.set(k,String(v));throw Error('slot commit interrupted');}
   if(mode==='rollback-fails'&&k===core.SLOT_KEY&&writes>3)throw Error('rollback unavailable');
   m.set(k,String(v));
  },
  removeItem(k){m.delete(k)},
  snapshot(){return Object.fromEntries(m)},
  get writeCount(){return writes}
 };
}
let n=0;
function check(name,fn){fn();n++;console.log('PASS '+name);}
for(const mode of ['recovery-silent','active-silent','slots-silent','recovery-after-write','active-after-write','slots-after-write']){
 check(mode+' failure does not alter any saved byte',()=>{
  const s=store(mode);assert.throws(()=>core.restore(s,incoming,{confirmed:true}));
  assert.deepEqual(s.snapshot(),initial);
 });
}
check('unrecoverable rollback keeps old slots in verified recovery copy',()=>{
 const s=store('rollback-fails');
 assert.throws(()=>core.restore(s,incoming,{confirmed:true}),/preserved recovery copy/);
 assert.deepEqual(JSON.parse(s.getItem(core.RECOVERY_KEY)).slots,initial[core.SLOT_KEY]);
 assert.deepEqual(JSON.parse(core.recoveryText(s)).slots,prior.slots);
});
check('successful import keeps pre-import save retrievable',()=>{
 const s=store('normal');core.restore(s,incoming,{confirmed:true});
 assert.deepEqual(JSON.parse(s.getItem(core.SLOT_KEY)),JSON.parse(incoming).slots);
 assert.deepEqual(JSON.parse(core.recoveryText(s)).slots,prior.slots);
});
check('stale save review does not overwrite newer local progress',()=>{
 const s=store('normal');const expected=s.getItem(core.SLOT_KEY);
 s.setItem(core.SLOT_KEY,JSON.stringify(JSON.parse(backup('Newer local',300)).slots));
 const before=s.snapshot();
 assert.throws(()=>core.restore(s,incoming,{confirmed:true,expectedCurrent:expected}),/Local progress changed/);
 assert.deepEqual(s.snapshot(),before);
});
console.log('PASS: '+n+' Cloud Save failure-atomicity checks');

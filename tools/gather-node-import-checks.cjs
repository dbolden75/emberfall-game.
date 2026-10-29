'use strict';
// A malformed backup must not permanently lock mining, fishing or chopping.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const liveLoader='if(saved&&Array.isArray(saved.gatherNodes))saved.gatherNodes.forEach((readyAt,i)=>{if(maps[id].gatherNodes&&maps[id].gatherNodes[i])maps[id].gatherNodes[i].readyAt=Math.max(0,Number(readyAt)||0)});';
assert(game.includes(liveLoader),'Update regression if live gathering-state loader changes');
const live={saved:{gatherNodes:['Infinity']},maps:{ashvale:{gatherNodes:[{readyAt:0}]}},id:'ashvale'};
vm.runInNewContext(liveLoader,live);
assert.equal(live.maps.ashvale.gatherNodes[0].readyAt,Infinity,'Reproduce endless gathering cooldown from a string in a backup');
assert.equal(live.maps.ashvale.gatherNodes[0].readyAt>Date.now(),true,'Gathering remains unavailable');
function row(state){return {id:'slot1',updated:100,state:{player:{name:'Gatherer',class:'warrior',level:2,coins:15,inventory:[]},mapId:'ashvale',companions:[],mapStates:{ashvale:state},townQuestState:{}}};}
function backup(state){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:row(state)}});}
for(const invalid of [['Infinity'],['NaN'],['0'],['2030-01-01'],[-1],[null],[true],[{}],{readyAt:1},'bad']){
  const text=backup({gatherNodes:invalid});
  assert.throws(()=>core.parse(text),/Invalid saved enemy positions/,`Reject lossy gathering cooldown ${JSON.stringify(invalid)}`);
  assert.equal(core.readLocal(JSON.stringify({slot1:row({gatherNodes:invalid})})).unreadable,true,
    'Require explicit consent before overwriting malformed current gathering progress');
}
for(const valid of [undefined,null,[],[0],[123],[Date.now()+30000],[0,123,Date.now()+30000]]){
  const state=valid===undefined?{}:{gatherNodes:valid};
  assert.doesNotThrow(()=>core.parse(backup(state)),`Preserve valid/legacy gather state ${JSON.stringify(valid)}`);
}
const current=JSON.stringify({slot1:row({gatherNodes:[0]})});
const storage={items:new Map([[core.SLOT_KEY,current]]),getItem(k){return this.items.has(k)?this.items.get(k):null;},setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(storage,backup({gatherNodes:['Infinity']}),{confirmed:true,allowOlder:true}),/Invalid saved enemy positions/);
assert.equal(storage.getItem(core.SLOT_KEY),current,'Failed import must not alter saved character');
assert.equal(storage.getItem(core.RECOVERY_KEY),null,'Failed parse must not alter recovery data');
console.log('PASS: malformed gathering cooldowns rejected; old saves and existing progress preserved.');

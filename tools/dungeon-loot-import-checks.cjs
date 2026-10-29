'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
function backup(mapState){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:1,state:{player:{name:'QA',class:'warrior',level:5,coins:1,inventory:[]},mapId:'ashvale',companions:[],mapStates:{mosslight:mapState},townQuestState:{}}}}});}
const gameStatement='if(saved&&saved.chest&&maps[id].chest)maps[id].chest.open=!!saved.chest.open;';
assert(html.includes(gameStatement),'Live game chest-restore behavior changed: update test');
const ctx={saved:{chest:{open:'false'}},maps:{mosslight:{chest:{open:false}}},id:'mosslight'};
vm.runInNewContext(gameStatement,ctx);
assert.equal(ctx.maps.mosslight.chest.open,true,'Reproduce corrupted false string becoming an opened chest (loot lost)');
for(const field of ['chest','treasure']){
 const key=field==='chest'?'open':'opened';
 for(const flag of ['false','true',0,1,[],{},'']){
  const state={[field]:{[key]:flag}};
  assert.throws(()=>core.parse(backup(state)),/Invalid saved enemy positions/,`Reject lossy ${field} ${JSON.stringify(flag)}`);
  assert.equal(core.readLocal(JSON.stringify({slot1:JSON.parse(backup(state)).slots.slot1})).unreadable,true,`Reject lossy local ${field}`);
 }
 for(const shape of ['true',[],1]){
  assert.throws(()=>core.parse(backup({[field]:shape})),/Invalid saved enemy positions/,`Reject invalid ${field} shape ${JSON.stringify(shape)}`);
 }
 for(const flag of [true,false,null,undefined]){
  const state={[field]:flag===undefined?{}:{[key]:flag}};
  assert.doesNotThrow(()=>core.parse(backup(state)),`Historical ${field} ${flag}`);
 }
 assert.doesNotThrow(()=>core.parse(backup({[field]:null})));
 assert.doesNotThrow(()=>core.parse(backup({})));
}
console.log('PASS: dungeon-loot chest/treasure flags validated before restore, historical formats compatible.');

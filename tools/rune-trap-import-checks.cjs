'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
function backup(mapState){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:1,state:{player:{name:'QA',class:'warrior',level:5,coins:1,inventory:[]},mapId:'mosslight',companions:[],mapStates:{mosslight:mapState},townQuestState:{}}}}});}
const runeStatement='maps[id].runes[i].on=!!on';
const trapStatement='maps[id].traps[i].armed=!!armed';
assert(html.includes(runeStatement)&&html.includes(trapStatement),'Live game rune/trap loader changed: review test');
for(const [field,prop,stmt] of [['runes','on',runeStatement],['traps','armed',trapStatement]]){
 const ctx={on:'false',armed:'false',maps:{mosslight:{runes:[{on:false}],traps:[{armed:false}]}},id:'mosslight',i:0};
 vm.runInNewContext(stmt,ctx);
 assert.equal(ctx.maps.mosslight[field][0][prop],true,'Reproduce string false being wrongly restored as true');
 for(const bad of ['false','true',0,1,[],{},'']){
  const state={[field]:[bad]};
  assert.throws(()=>core.parse(backup(state)),/Invalid saved enemy positions/,`Import: reject ${field} ${JSON.stringify(bad)}`);
  assert.equal(core.readLocal(JSON.stringify({slot1:JSON.parse(backup(state)).slots.slot1})).unreadable,true,`Local: reject ${field} ${JSON.stringify(bad)}`);
 }
 for(const bad of ['false',{},1]){
  assert.throws(()=>core.parse(backup({[field]:bad})),/Invalid saved enemy positions/,`Reject non-array ${field} ${JSON.stringify(bad)}`);
 }
 for(const valid of [[false,true],[],null,undefined]){
  const state=valid===undefined?{}:{[field]:valid};
  assert.doesNotThrow(()=>core.parse(backup(state)),`Allow historical ${field} ${JSON.stringify(valid)}`);
  assert.equal(core.readLocal(JSON.stringify({slot1:JSON.parse(backup(state)).slots.slot1})).unreadable,false);
 }
}
console.log('PASS: rune and trap progress flags validated before Cloud Save import/local restore; historical snapshots supported.');

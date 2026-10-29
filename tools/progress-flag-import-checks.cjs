'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const flags=['done','hasSigil','hasFourfoldKey','huntRewarded','shrineRewarded','deepQuestDone','houseBought'];
const homes=['ashvale','brackenford','stonewatch','sunmere'];
function payload(state={}){
 return {format:'thornhaven-save',schema:1,createdAt:1,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:1,state:{player:{name:'QA',class:'warrior',level:5,coins:1,inventory:[]},mapId:'ashvale',companions:[],mapStates:{},townQuestState:{},...state}}}};
}
function check(state,expected,description){
 const backup=payload(state),value=JSON.stringify(backup);
 if(expected){
  assert.doesNotThrow(()=>core.parse(value),description);
  assert.equal(core.readLocal(JSON.stringify(backup.slots)).unreadable,false,description);
 }else{
  assert.throws(()=>core.parse(value),/Invalid saved quest or home progress/,description);
  assert.equal(core.readLocal(JSON.stringify(backup.slots)).unreadable,true,description);
 }
}
// Real game loader turns the nonempty string 'false' into true.
for(const [flag,statement] of [['hasSigil','hasSigil=!!save.hasSigil'],['done','done=!!save.done'],['deepQuestDone','deepQuestDone=!!save.deepQuestDone']]){
 assert(html.includes(statement),'Loader changed for '+flag+'; review regression');
 const ctx={save:{[flag]:'false'},[flag]:false};
 vm.runInNewContext(statement,ctx);
 assert.equal(ctx[flag],true,'Reproduced false-string coercion for '+flag);
}
for(const field of flags){
 for(const bad of ['false','true','',{},[],2,-1])check({[field]:bad},false,'reject '+field+'='+JSON.stringify(bad));
 for(const good of [true,false,null,undefined])check(good===undefined?{}:{[field]:good},true,'allow '+field+'='+String(good));
}
for(const group of ['townRelicState','ownedHomes']){
 for(const bad of ['false',true,[],1])check({[group]:bad},false,'reject '+group+' shape');
 for(const home of homes){
  for(const bad of ['false','true',0,1,[],{}])check({[group]:{[home]:bad}},false,'reject '+group+'.'+home+'='+JSON.stringify(bad));
  for(const good of [false,true,null,undefined])check({[group]:good===undefined?{}:{[home]:good}},true,'allow '+group+'.'+home+'='+String(good));
 }
 for(const good of [null,undefined,{}])check(good===undefined?{}:{[group]:good},true,'allow '+group+'='+String(good));
}
console.log('PASS: quest milestones and home ownership cannot flip during Cloud Save import; historical flags compatible.');

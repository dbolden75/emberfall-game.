#!/usr/bin/env node
'use strict';
// The live settlement has four defense upgrades in addition to six civilian
// buildings. Reject malformed restored defense levels before any save writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const keys=['palisade','gate','tower','barracks'];
for(const key of keys)assert.match(game,new RegExp('\\n\\s*'+key+':\\{name:'),
  key+' must exist in the current packaged settlement');
const loader=game.match(/function settlementState\(\)\{.*?return s;\s*\}/s);
assert(loader,'Use the live settlement normalization function');
const live=state=>vm.runInNewContext(
 'const settlementBuildings={palisade:1,gate:1,tower:1,barracks:1,hall:1,mill:1,quarry:1,garden:1,forge:1,lodge:1};'+
 'let townQuestState={_settlement:'+JSON.stringify(state)+'};'+loader[0]+';settlementState()',
 {Date,Math,Number,Object,Array});
assert.equal(live({levels:{palisade:'Infinity'}}).levels.palisade,3,
 'Reproduce: bad text upgrades the palisade without materials');
assert.equal(live({levels:{tower:1e308}}).levels.tower,3,
 'Reproduce: impossible numeric tower level is clamped to maximum');

function row(s){return {id:'slot1',name:'Guardian',class:'warrior',level:3,updated:100,state:{
 player:{name:'Guardian',class:'warrior',level:3,coins:1,xp:10,hp:30,max:50,x:400,y:400,speed:190,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[]}},
 townQuestState:{_settlement:s}
}};}
const backup=s=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:row(s)}});
const raw=JSON.stringify({slot1:row({levels:{palisade:1,tower:1}})});
let checks=2;
for(const key of keys)for(const value of ['Infinity','3',-1,4,1e308,null]){
 const s={levels:{[key]:value}},payload=backup(s);
 if(value===null){
  assert.doesNotThrow(()=>core.parse(payload),'Historical missing/null fields are supported');checks++;
  continue;
 }
 assert.throws(()=>core.parse(payload),/Invalid saved town quest progress/,key+' must not grant or discard an upgrade');checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:row(s)})).unreadable,true);checks++;
 const data=new Map([[core.SLOT_KEY,raw],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'previous backup']]);
 let writes=0;
 const storage={getItem:k=>data.get(k)??null,
  setItem:(k,v)=>{writes++;data.set(k,v)},removeItem:k=>{writes++;data.delete(k)}};
 assert.throws(()=>core.restore(storage,payload,{confirmed:true,allowOlder:true}),
  /Invalid saved town quest progress/);checks++;
 assert.equal(writes,0,'Rejected import must do zero storage writes');checks++;
 assert.equal(data.get(core.SLOT_KEY),raw);checks++;
 assert.equal(data.get(core.RECOVERY_KEY),'previous backup');checks++;
}
for(const levels of [undefined,{}, {palisade:0,gate:1,tower:2,barracks:3},
 {hall:1,mill:1,quarry:0,garden:3,forge:2,lodge:1},
 {future_level:'metadata not used by old loader'},{tower:null}]){
 const s=levels===undefined?{}:{levels};
 assert.doesNotThrow(()=>core.parse(backup(s)),JSON.stringify(levels));checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:row(s)})).unreadable,false);checks++;
}
console.log('PASS: '+checks+' defense upgrade, compatibility and no-write recovery assertions');

#!/usr/bin/env node
'use strict';
// Cloud Save must never silently replace an equipped hero item with an empty
// slot. applySavedGame() assigns these fields directly; the live normalizer
// drops invalid strings and non-string gear values as if the slot were empty.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const base={
 player:{name:'Hero',class:'warrior',level:4,coins:60,xp:10,hp:50,max:50,speed:120,
  x:300,y:200,inventory:[],weapon:'short_sword',armor:null,shield:null,
  earrings:null,necklace:null,legs:null,boots:null},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}
};
const slots=change=>({slot1:{id:'slot1',updated:1234,name:'Hero',class:'warrior',
 level:4,state:{...structuredClone(base),player:{...base.player,...change}}}});
const backup=change=>JSON.stringify({format:'thornhaven-save',schema:1,
 createdAt:1234,activeSlot:'slot1',slots:slots(change)});
let checked=0;
for(const slot of ['weapon','armor','shield','earrings','necklace','legs','boots']){
 for(const invalid of [{id:'short_sword'},['short_sword'],17,true,'']){
  const text=backup({[slot]:invalid});
  assert.throws(()=>core.parse(text),/gear|equipment/i,`${slot}=${JSON.stringify(invalid)}`);
  assert.equal(core.readLocal(JSON.stringify(slots({[slot]:invalid}))).unreadable,true);
  const original=JSON.stringify(slots({})),values=new Map([[core.SLOT_KEY,original]]);
  let writes=0;
  const storage={getItem:k=>values.get(k)??null,
   setItem:(k,v)=>{writes++;values.set(k,v)},
   removeItem:k=>{writes++;values.delete(k)}};
  assert.throws(()=>core.restore(storage,text,{confirmed:true,allowOlder:true}),/gear|equipment/i);
  assert.equal(writes,0,'unsafe backup must not overwrite existing data');
  assert.equal(values.get(core.SLOT_KEY),original,'existing gear remains byte-exact');
  checked++;
 }
}
for(const gear of [{weapon:null},{weapon:'short_sword'},{armor:undefined},{}]){
 assert.doesNotThrow(()=>core.parse(backup(gear)));
 assert.equal(core.readLocal(JSON.stringify(slots(gear))).unreadable,false);
}
for(const slot of ['weapon','armor','shield','earrings','necklace','legs','boots']){
 const record=JSON.parse(backup({}));delete record.slots.slot1.state.player[slot];
 assert.doesNotThrow(()=>core.parse(JSON.stringify(record)));
}
console.log(`PASS: ${checked} corrupt hero-gear imports rejected without save writes; valid and historical slots preserved.`);

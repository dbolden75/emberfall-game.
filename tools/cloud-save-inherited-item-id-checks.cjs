#!/usr/bin/env node
'use strict';
// The live bag/equipment code indexes ordinary itemDefs objects by saved item ID.
// Object.prototype property names can resolve to inherited functions/objects,
// masquerading as items. A Cloud Save must not overwrite readable characters
// with this corrupt bag, chest, hero gear or old pet gear.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const base={player:{name:'Hero',class:'warrior',level:4,coins:42,xp:7,
 hp:55,max:55,speed:120,x:260,y:220,inventory:[{id:'short_sword',count:1}],weapon:'short_sword'},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}};
const rows=state=>({slot1:{id:'slot1',updated:1234,name:'Hero',class:'warrior',level:4,state}});
const make=state=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1234,
 activeSlot:'slot1',slots:rows(state)});
const reserved=['__proto__','constructor','prototype','toString','hasOwnProperty','valueOf','isPrototypeOf'];
let rejected=0,accepted=0;
for(const id of reserved){
 for(const [label,update] of [
  ['bag',s=>{s.player.inventory=[{id,count:1}]}],
  ['town chest',s=>{s.houseStorage={ashvale:{front_chest:[{id,count:1}]}}}],
  ['legacy chest',s=>{s.houseStorage={front_chest:[{id,count:1}]}}],
  ['hero weapon',s=>{s.player.weapon=id}],
  ['legacy pet weapon',s=>{s.companions=[{id:'dalen',petVersion:0,weapon:id}]}],
 ]){
  const state=structuredClone(base);update(state);
  const text=make(state);
  assert.throws(()=>core.parse(text),/inventory|chest|gear|companion|equipment|item/i,`${label}: ${id}`);
  assert.equal(core.readLocal(JSON.stringify(rows(state))).unreadable,true,`${label}: ${id} local`);
  const original=JSON.stringify(rows(structuredClone(base))),values=new Map([[core.SLOT_KEY,original]]);
  let writes=0;
  const storage={getItem:k=>values.get(k)??null,
   setItem:(k,v)=>{writes++;values.set(k,v)},removeItem:k=>{writes++;values.delete(k)}};
  assert.throws(()=>core.restore(storage,text,{confirmed:true,allowOlder:true}),/inventory|chest|gear|companion|equipment|item/i);
  assert.equal(writes,0,`${label}: ${id} should fail before writing`);
  assert.equal(values.get(core.SLOT_KEY),original,`${label}: ${id} must keep current character`);
  rejected++;
 }
}
for(const [label,update] of [
 ['normal bag',s=>{s.player.inventory=[{id:'short_sword',count:2},{id:'copper_ore',count:3}]}],
 ['future item identifier',s=>{s.player.inventory=[{id:'new_gear_from_future',count:1}]}],
 ['normal gear',s=>{s.player.weapon='short_sword'}],
 ['legacy pet empty weapon',s=>{s.companions=[{id:'dalen',petVersion:0,weapon:''}]}],
 ['legacy pet equipped weapon',s=>{s.companions=[{id:'dalen',petVersion:0,weapon:'short_sword'}]}],
 ['empty bag and chests',s=>{s.player.inventory=[];s.houseStorage={ashvale:{front_chest:[],side_chest:[]}}}],
 ]){
  const state=structuredClone(base);update(state);
  assert.doesNotThrow(()=>core.parse(make(state)),label);
  assert.equal(core.readLocal(JSON.stringify(rows(state))).unreadable,false,label);
  accepted++;
}
console.log(`PASS: ${rejected} inherited item-id corruption cases rejected before writes; ${accepted} valid/historical cases accepted`);

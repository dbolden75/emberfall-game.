#!/usr/bin/env node
'use strict';
// Regressions for corrupted duplicate bag/chest stacks in Cloud Saves.
// bagCount() finds the first stack; removeItem() removes all stacks of the
// same ID once that first stack is depleted. Such imports silently lose gear.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const item=id=>({id,count:1});
const base={player:{name:'Hero',class:'warrior',level:4,coins:42,xp:7,
 hp:55,max:55,speed:120,x:260,y:220,inventory:[item('short_sword')]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}};
const rows=s=>({slot1:{id:'slot1',updated:1234,name:'Hero',class:'warrior',level:4,state:s}});
const make=s=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1234,
 activeSlot:'slot1',slots:rows(s)});
let rejected=0,accepted=0;
function reject(state,label){
 const backup=make(state),local=JSON.stringify(rows(structuredClone(base)));
 assert.throws(()=>core.parse(backup),/duplicate|inventory|stack|chest|item/i,label);
 assert.equal(core.readLocal(JSON.stringify(rows(state))).unreadable,true,label+' local');
 const values=new Map([[core.SLOT_KEY,local]]);let writes=0;
 const storage={getItem:k=>values.get(k)??null,
  setItem:(k,v)=>{writes++;values.set(k,v)},
  removeItem:k=>{writes++;values.delete(k)}};
 assert.throws(()=>core.restore(storage,backup,{confirmed:true,allowOlder:true}),
  /duplicate|inventory|stack|chest|item/i,label+' restore');
 assert.equal(writes,0,label+' must not write');
 assert.equal(values.get(core.SLOT_KEY),local,label+' must retain original saves');
 rejected++;
}
for(const id of ['short_sword','potion_25','ancient_alloy']){
 for(const [label,change] of [
  ['hero inventory',s=>{s.player.inventory=[item(id),item(id)]}],
  ['town front chest',s=>{s.houseStorage={ashvale:{front_chest:[item(id),item(id)]}}}],
  ['town side chest',s=>{s.houseStorage={sunmere:{side_chest:[item(id),item(id)]}}}],
  ['legacy front chest',s=>{s.houseStorage={front_chest:[item(id),item(id)]}}],
  ['legacy side chest',s=>{s.houseStorage={side_chest:[item(id),item(id)]}}],
 ]){const s=structuredClone(base);change(s);reject(s,id+' / '+label)}
}
for(const [label,change] of [
 ['one stack',s=>{s.player.inventory=[{id:'short_sword',count:10}]}],
 ['distinct stack ids',s=>{s.player.inventory=[item('short_sword'),item('potion_25')]}],
 ['unique town chest stacks',s=>{s.houseStorage={ashvale:{front_chest:[item('short_sword'),item('potion_25')]}}}],
 ['unique legacy chest stacks',s=>{s.houseStorage={front_chest:[item('short_sword'),item('potion_25')]}}],
 ['empty bag and chests',s=>{s.player.inventory=[];s.houseStorage={brackenford:{front_chest:[],side_chest:[]}}}],
 ]){
 const s=structuredClone(base);change(s);
 assert.doesNotThrow(()=>core.parse(make(s)),label);
 assert.equal(core.readLocal(JSON.stringify(rows(s))).unreadable,false,label);
 accepted++;
}
console.log('PASS: '+rejected+' duplicate backup cases rejected without writes; '+accepted+' valid/historical states accepted');

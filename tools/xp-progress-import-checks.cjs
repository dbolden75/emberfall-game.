'use strict';
// Imported XP must remain numeric: grantXp() uses += on the persisted value.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const gameFn=/function grantXp\(amount\)\{[^\n]+\}/.exec(html)?.[0];
assert(gameFn,'Exercise the real game XP function, not a reimplementation');
function nextXp(savedXp){
 const context={player:{xp:savedXp,level:1,max:10,hp:10},xpToNextLevel:()=>100,
  normalizePets:()=>{},scaleEnemiesForRegion:()=>{},syncHeroStats:()=>{},playSfx:()=>{},say:()=>{}};
 vm.runInNewContext(gameFn+';grantXp(7);',context);
 return context.player.xp;
}
assert.equal(nextXp('4'),'47','Reproduce numeric-text XP concatenating inside live grantXp');
assert.equal(nextXp(4),11,'Numerical XP accrues correctly');
const character=()=>({player:{name:'XpTester',class:'warrior',level:5,xp:4,coins:25,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}});
const row=state=>({id:'slot1',updated:60,state});
const backup=state=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:60,
 activeSlot:'slot1',slots:{slot1:row(state)}});
for(const xp of ['4','bad',false,[],{},-1]){
 const state=character();state.player.xp=xp;
 assert.throws(()=>core.parse(backup(state)),/experience|XP|progress/i,'Reject malformed XP '+JSON.stringify(xp));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(state)})).unreadable,true);
}
for(const xp of [0,4,12.5,null,undefined]){
 const state=character();if(xp===undefined)delete state.player.xp;else state.player.xp=xp;
 assert.doesNotThrow(()=>core.parse(backup(state)),'Keep legitimate or omitted historical XP '+xp);
}
const store={values:new Map([[core.SLOT_KEY,JSON.stringify({slot1:row(character())})]]),
 getItem(k){return this.values.has(k)?this.values.get(k):null;},
 setItem(k,v){this.values.set(k,String(v));},removeItem(k){this.values.delete(k);}};
const initial=store.getItem(core.SLOT_KEY);
const invalid=character();invalid.player.xp='4';
assert.throws(()=>core.restore(store,backup(invalid),{confirmed:true,allowOlder:true}),/experience|XP|progress/i);
assert.equal(store.getItem(core.SLOT_KEY),initial,'Rejected import does not overwrite local characters');
assert.equal(store.getItem(core.RECOVERY_KEY),null,'Rejected import does not alter recovery');
console.log('PASS: game XP concatenation reproduced; numeric and legacy XP accepted; corrupt imports/local slots rejected without replacement.');

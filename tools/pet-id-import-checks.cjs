'use strict';
// A newer/corrupt pet id must not be silently discarded by normalizePets()
// after Cloud Save reports a successful restore. This also rejects inherited
// Object.prototype names, which look like valid pet definitions via [] access.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const match=/const petDefs=\{([\s\S]*?)\n\};/.exec(game);
assert(match,'Find installed game pet definitions');
const actual=[...match[1].matchAll(/^\s*([a-z_]+):\{/gm)].map(m=>m[1]).sort();
const expected=['dalen','sylvi','corin','eryn','ember_dragon'].sort();
assert.deepEqual(actual,expected,'Update the Cloud Save pet allowlist when the game adds an actual pet type');
function state(pet){return {player:{name:'PetTester',class:'warrior',level:3,coins:12,inventory:[]},mapId:'ashvale',companions:[pet],mapStates:{},townQuestState:{}};}
function row(pet){return {id:'slot1',updated:100,state:state(pet)};}
function backup(pet){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:row(pet)}});}
const normalize=game.slice(game.indexOf('function normalizePets(){'),game.indexOf('function ensureStarterPet(){'));
assert(normalize.startsWith('function normalizePets(){'),'Find live pet normalization');
const pets=[{id:'lost_pet',hp:10,max:10,active:true}];
const ctx={companions:pets,petDefs:Object.fromEntries(actual.map(id=>[id,{hp:50,name:id,class:'warrior'}])),petLevel:()=>1,petMaxHealth:()=>50,GEAR_SLOTS:[]};
vm.runInNewContext(normalize+';normalizePets();',ctx);
assert.equal(ctx.companions.length,0,'Reproduce the game silently dropping an unrecognized pet');
for(const id of ['lost_pet','__proto__','constructor','toString']){
 const pet={id,hp:10,max:10,active:false};
 assert.throws(()=>core.parse(backup(pet)),/Invalid saved companion data/,id);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(pet)})).unreadable,true,'Do not treat lossy local character as readable: '+id);
}
for(const id of expected){assert(core.parse(backup({id,hp:10,max:50,active:false})),`Keep installed pet ${id}`);}
const store={m:new Map([[core.SLOT_KEY,JSON.stringify({slot1:row({id:'dalen',hp:25,max:50,active:true})})]]),getItem(k){return this.m.has(k)?this.m.get(k):null;},setItem(k,v){this.m.set(k,String(v));},removeItem(k){this.m.delete(k);}};
const old=store.getItem(core.SLOT_KEY);
assert.throws(()=>core.restore(store,backup({id:'lost_pet',hp:10,max:50}),{confirmed:true,allowOlder:true}),/Invalid saved companion data/);
assert.equal(store.getItem(core.SLOT_KEY),old,'Rejecting a lossy import cannot erase local characters');
assert.equal(store.getItem(core.RECOVERY_KEY),null,'Reject before touching recovery storage');
console.log('PASS: unknown/inherited pet ids rejected before restore; installed pets and local characters preserved.');

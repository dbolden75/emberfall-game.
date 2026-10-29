const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../app/src/main/assets/cloud-save-core.js');
const game = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

// The actual quest code treats plan as truthy and invokes clues.includes / clues.push.
// Malformed restored values can skip Ada's conversation or crash on clue pickup.
assert.match(game, /if\(s\.plan\)\{/);
assert.match(game, /s\.clues\.includes\(obj\.id\)/);
assert.match(game, /s\.clues\.push\(obj\.id\)/);

function row(briar) {
  return {id:'slot1', updated:100, state:{
    player:{name:'Briar scout',class:'warrior',level:4,coins:15,inventory:[]},
    mapId:'briarhollow', companions:[],mapStates:{},
    townQuestState:{briar_hollow:briar}
  }};
}
function backup(briar) {
  return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:row(briar)}});
}
const invalid = [
  {clues:'briar_bell,briar_clinic,briar_gate'},
  {clues:{length:3}},
  {clues:[null]},
  {clues:['briar_bell','briar_bell','briar_clinic']},
  {clues:['briar_bell','briar_clinic','briar_unknown']},
  {clues:['briar_bell','briar_clinic','briar_gate','extra']},
  {plan:'false'},
  {plan:true},
  {plan:0},
  {plan:'escape'}
];
for (const state of invalid) {
  assert.throws(()=>core.parse(backup(state)), /Invalid saved town quest progress/, 'Reject loss of Briar quest state: '+JSON.stringify(state));
  assert.equal(core.readLocal(JSON.stringify({slot1:row(state)})).unreadable, true, 'Malformed local Briar state must be flagged for explicit recovery: '+JSON.stringify(state));
}
const valid = [
  {},{plan:null,clues:null},{plan:'watch',clues:[]},
  {plan:'ration',clues:['briar_gate','briar_clinic','briar_bell']},
  {accepted:true,rescued:false,claimed:false,clues:['briar_bell']},
  {accepted:true,rescued:true,claimed:true,plan:'watch',clues:['briar_bell','briar_clinic','briar_gate']},
];
for (const state of valid) assert.doesNotThrow(()=>core.parse(backup(state)), 'Preserve valid historical Briar state: '+JSON.stringify(state));
const before = JSON.stringify({slot1:row({accepted:true,clues:['briar_bell']})});
const storage = {
  data:new Map([[core.SLOT_KEY,before]]),
  getItem(key){return this.data.has(key)?this.data.get(key):null},
  setItem(key,value){this.data.set(key,String(value))},
  removeItem(key){this.data.delete(key)}
};
assert.throws(()=>core.restore(storage,backup({clues:'broken'}),{confirmed:true,allowOlder:true}), /Invalid saved town quest progress/);
assert.equal(storage.getItem(core.SLOT_KEY),before, 'Rejected import must not overwrite existing characters');
assert.equal(storage.getItem(core.RECOVERY_KEY),null, 'Rejected import must not change recovery copies');
console.log('PASS: Briar Hollow clue arrays and Ada escape plans validated without changing older saves.');

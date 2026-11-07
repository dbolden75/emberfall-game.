'use strict';
// Prevent cross-version Cloud Save imports that silently discard map progress.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../app/src/main/assets/cloud-save-core.js');
const script = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/cloud-save.js'), 'utf8');
assert.match(script, /core\.assertRestorableMapLayout\(incoming,\s*maps\)/,
  'Review must reject mismatched maps before offering Restore');

const live = {
 ashvale: {enemies:[{id:'wolf'}, {id:'temporary',catalogSummoned:true}],
   runes:[1,2], runeSequence:['a','b'], traps:[{}], gatherNodes:[{},{}],
   chest:{open:false}, treasure:{opened:false}},
 sunmere: {enemies:[], runes:[], runeSequence:[], traps:[], gatherNodes:[]}
};
const mapStates = {
 ashvale: {enemies:[{alive:false}], runes:[true], runeProgress:1, traps:[false],
   gatherNodes:[0], chest:{open:false}, treasure:{opened:false}},
 sunmere: {enemies:[],runes:[],runeProgress:0,traps:[],gatherNodes:[]}
};
const row = {
 id:'slot1',name:'Hero',class:'warrior',level:1,updated:1,
 state:{player:{name:'Hero',class:'warrior',level:1,coins:0,inventory:[]},
  mapId:'ashvale', companions:[], townQuestState:{}, mapStates}
};
const backup=core.parse(core.encode({slot1:row},'slot1',1));
assert.equal(core.assertRestorableMapLayout(backup,live),true);
let rejectedCount=0;
function rejected(mutator,label){
 const corrupted=structuredClone(backup);
 mutator(corrupted.slots.slot1.state.mapStates);
 assert.throws(()=>core.assertRestorableMapLayout(corrupted,live),
  /can safely restore|Update Thornhaven/,label);
 rejectedCount++;
}
for(const field of ['enemies','runes','traps','gatherNodes']){
 rejected(states=>{const row=states.ashvale;row[field]=Array.from(
  {length:({enemies:1,runes:2,traps:1,gatherNodes:2})[field]+1},
  ()=>field==='runes'?false:field==='gatherNodes'?0:{alive:false});},'oversized '+field);
}
rejected(states=>{states.ashvale.runeProgress=3},'future shrine puzzle sequence');
rejected(states=>{states.sunmere.chest={open:true}},'opened chest no longer on current map');
rejected(states=>{states.sunmere.treasure={opened:true}},'claimed treasure no longer on current map');
rejected(states=>{states.ashvale.enemies.push({alive:true})},'temporary summons not persistent map slots');
const withSecond=structuredClone(backup);
withSecond.slots.slot2=structuredClone(withSecond.slots.slot1);withSecond.slots.slot2.id='slot2';
withSecond.slots.slot2.state.mapStates.sunmere.runes=[true];
assert.throws(()=>core.assertRestorableMapLayout(withSecond,live),/can safely restore/,'check every save slot');
rejectedCount++;
const benign=structuredClone(backup);
benign.slots.slot1.state.mapStates.sunmere.chest={open:false};
benign.slots.slot1.state.mapStates.sunmere.treasure={opened:false};
assert.equal(core.assertRestorableMapLayout(benign,live),true,'unused legacy loot flags should remain compatible');
console.log('PASS map-layout compatibility: current/legacy saves accepted; '+rejectedCount+' lossy cases rejected before restore.');

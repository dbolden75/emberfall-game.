'use strict';
// Saving and restoring corrupted skill/forge ranks must not silently erase
// earned gathering XP or award unpaid forge upgrades.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const normalizeSource=game.match(/function normalizeGatheringSkills\(saved\)\{.*?return out\}/s)?.[0];
assert(normalizeSource,'The live gathering-skill normalizer must exist');
const normalize=vm.runInNewContext(normalizeSource+';normalizeGatheringSkills');
assert.equal(normalize({mining:{xp:'damaged'}}).mining.xp,0,
 'Live game silently resets corrupted mining XP to zero');
assert.equal(normalize({mining:{xp:'Infinity'}}).mining.xp,Infinity,
 'Live game accepts infinite gathering XP and immediately maxes its level');
assert.match(game,/Math\.max\(0,Math\.min\(gearUpgradeCap\(id\),Math\.floor\(Number\(rank\)\|\|0\)\)\)/,
 'Live game silently clamps malformed forge ranks');
assert.equal(Math.max(0,Math.min(5,Math.floor(Number('Infinity')||0))),5,
 'A corrupted forge rank instantly maxes gear upgrades');
function row(state={}){return {id:'slot1',updated:123,state:{
 player:{name:'Craftswoman',class:'warrior',level:3,coins:70,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{},townQuestState:{},...state
}};}
function backup(state){return JSON.stringify({format:'thornhaven-save',schema:1,
 createdAt:123,activeSlot:'slot1',slots:{slot1:row(state)}});}
const invalid=[
 {gatheringSkills:'unparseable'},
 {gatheringSkills:[]},
 {gatheringSkills:{mining:'bad'}},
 {gatheringSkills:{woodcutting:{xp:'80'}}},
 {gatheringSkills:{fishing:{xp:-1}}},
 {gatheringSkills:{mining:{xp:3.5}}},
 {gatheringSkills:{mining:{xp:'Infinity'}}},
 {gatheringSkills:{mining:{xp:9,level:'2'}}},
 {gatheringSkills:{mining:{xp:9,level:0}}},
 {gearUpgradeLevels:[]},
 {gearUpgradeLevels:'unparseable'},
 {gearUpgradeLevels:{ashwood_blade:'3'}},
 {gearUpgradeLevels:{ashwood_blade:'Infinity'}},
 {gearUpgradeLevels:{ashwood_blade:-1}},
 {gearUpgradeLevels:{ashwood_blade:1.5}},
 {gearUpgradeLevels:{ashwood_blade:6}}
];
for(const state of invalid){
 assert.throws(()=>core.parse(backup(state)),/Invalid saved gathering or forge progress/,
  'Reject malformed earned progression '+JSON.stringify(state));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(state)})).unreadable,true,
  'Reject malformed local progression '+JSON.stringify(state));
}
const accepted=[
 {},{gatheringSkills:null,gearUpgradeLevels:null},
 {gatheringSkills:{},gearUpgradeLevels:{}},
 {gatheringSkills:{mining:{xp:0,level:1},woodcutting:{xp:80,level:2},fishing:{xp:500,level:10}},gearUpgradeLevels:{ashwood_blade:0,old_gear:5}},
 {gatheringSkills:{mining:{xp:450}},gearUpgradeLevels:{ashwood_blade:3}},
 {gatheringSkills:{fishing:{}},gearUpgradeLevels:{}}
];
for(const state of accepted)assert.doesNotThrow(()=>core.parse(backup(state)),
 'Preserve current and historical gathering and forge formats '+JSON.stringify(state));
const original=JSON.stringify({slot1:row({gatheringSkills:{mining:{xp:150,level:4}},gearUpgradeLevels:{ashwood_blade:2}})});
const storage={items:new Map([[core.SLOT_KEY,original]]),getItem(k){return this.items.has(k)?this.items.get(k):null;},
 setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(storage,backup({gatheringSkills:{mining:{xp:'damaged'}}}),
 {confirmed:true,allowOlder:true}),/Invalid saved gathering or forge progress/);
assert.equal(storage.getItem(core.SLOT_KEY),original,'Rejected import preserves existing character bytes');
assert.equal(storage.getItem(core.RECOVERY_KEY),null,'Rejected import preserves recovery record');
console.log('PASS: invalid gathering/forge progress rejected without overwriting saved characters; older valid progress accepted.');

'use strict';
// A malformed backup must not silently skip Hearthstead's rescue/rebuild
// chapter, unlock an unearned recipe, or erase Sera's food-repair obligation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../app/src/main/assets/cloud-save-core.js');
const game=fs.readFileSync('app/src/main/assets/index.html','utf8');
const match=game.match(/function frontierStage\(\)\{[^}]*\}/);
assert(match,'Update regression if the live frontier-stage implementation changes');
function stage(frontier){return vm.runInNewContext(match[0]+';frontierStage()',{
 frontierState:()=>frontier,settlementState:()=>({levels:{hall:1}})
});}
assert.equal(stage({complete:'false'}),'complete','Reproduce: textual false falsely completes the chapter');
assert.equal(stage({accepted:true,rescued:true,home:'false'}),'welcome','Reproduce: textual false skips the return-home step');
function row(quests){return {id:'slot1',updated:100,state:{player:{name:'Builder',class:'warrior',level:2,coins:15,inventory:[]},mapId:'frontier_outpost',companions:[],mapStates:{},townQuestState:quests}};}
function backup(quests){return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',slots:{slot1:row(quests)}});}
const bad=[
 {_frontier:{complete:'false'}},
 {_frontier:{accepted:true,rescued:true,home:'false'}},
 {_frontier:{mystery:'false'}},
 {_frontier:{blueprint:'false'}},
 {npc_sera:{choice:'divert',repaired:'false'}},
 {_frontier:[]},
 {npc_sera:'bad'}
];
for(const quests of bad){
 assert.throws(()=>core.parse(backup(quests)),/Invalid saved town quest progress/,'Reject lossy frontier state '+JSON.stringify(quests));
 assert.equal(core.readLocal(JSON.stringify({slot1:row(quests)})).unreadable,true,'Malformed local quest must be flagged before overwrite');
}
const valid=[{}, {_frontier:null}, {_frontier:{}}, {_frontier:{accepted:true,rescued:true,home:false,complete:false,mystery:false,blueprint:false}}, {_frontier:{accepted:true,rescued:true,home:true,complete:true,mystery:true,blueprint:true}}, {npc_sera:{choice:'divert'}}, {npc_sera:{choice:'divert',repaired:false}}, {npc_sera:{choice:'divert',repaired:true}}];
for(const quests of valid)assert.doesNotThrow(()=>core.parse(backup(quests)),'Preserve legitimate frontier save '+JSON.stringify(quests));
const old=JSON.stringify({slot1:row({_frontier:{complete:false}})});
const storage={items:new Map([[core.SLOT_KEY,old]]),getItem(k){return this.items.has(k)?this.items.get(k):null;},setItem(k,v){this.items.set(k,String(v));},removeItem(k){this.items.delete(k);}};
assert.throws(()=>core.restore(storage,backup({_frontier:{complete:'false'}}),{confirmed:true,allowOlder:true}),/Invalid saved town quest progress/);
assert.equal(storage.getItem(core.SLOT_KEY),old,'Rejected import must not overwrite the character');
assert.equal(storage.getItem(core.RECOVERY_KEY),null,'Rejected import must not overwrite recovery');
console.log('PASS: Hearthstead progression and NPC food-repair flags guarded; legitimate saves intact.');

// Transactional Cloud Save checks against the exact current Android source.
// This is a Node regression gate, not a claim of signed APK installation.
'use strict';
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
function state(name='Test'){return {player:{name,class:'warrior',level:10,coins:120,xp:50,inventory:[{id:'field_ration',count:2}]},mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}};}
function backup(time=200,name='Test'){return {format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:{id:'slot1',updated:time,state:state(name)}}};}
function storage(items={}){const m=new Map(Object.entries(items));let failKey=null;return {getItem:k=>m.has(k)?m.get(k):null,setItem(k,v){if(k===failKey)throw Error('simulated storage outage');m.set(k,String(v))},removeItem:k=>m.delete(k),fail(k){failKey=k},snapshot:()=>Object.fromEntries(m)};}
let checks=0;function run(label,fn){fn();checks++;console.log('PASS '+label);}
const old=backup(100,'Existing'),incoming=backup(200,'Imported');
run('valid backup round-trips without schema changes',()=>{assert.deepEqual(core.parse(core.encode(incoming.slots,'slot1',incoming.createdAt)),incoming)});
run('newer save restore writes recovery before commit',()=>{const before=JSON.stringify(old.slots),s=storage({[core.SLOT_KEY]:before,[core.ACTIVE_SLOT_KEY]:'slot1'});core.restore(s,JSON.stringify(incoming),{confirmed:true});assert.deepEqual(JSON.parse(s.getItem(core.SLOT_KEY)),incoming.slots);assert.equal(JSON.parse(s.getItem(core.RECOVERY_KEY)).slots,before)});
run('unconfirmed restore leaves existing bytes unchanged',()=>{const s=storage({[core.SLOT_KEY]:JSON.stringify(old.slots)}),before=s.snapshot();assert.throws(()=>core.restore(s,JSON.stringify(incoming)),/Confirm/);assert.deepEqual(s.snapshot(),before)});
run('older import requires explicit approval',()=>{const s=storage({[core.SLOT_KEY]:JSON.stringify(incoming.slots)}),before=s.snapshot();assert.throws(()=>core.restore(s,JSON.stringify(old),{confirmed:true}),/older/);assert.deepEqual(s.snapshot(),before)});
function reject(change,label){run(label,()=>{const bad=structuredClone(incoming);change(bad.slots.slot1.state);const s=storage({[core.SLOT_KEY]:JSON.stringify(old.slots)}),before=s.snapshot();assert.throws(()=>core.restore(s,JSON.stringify(bad),{confirmed:true}));assert.deepEqual(s.snapshot(),before)})}
reject(s=>{s.player.xp='50'},'string XP cannot corrupt character progress');
reject(s=>{s.townQuestState._settlement={founded:'false'}},'string settlement founding flag is rejected');
reject(s=>{s.townQuestState._settlement={stock:{wood:'Infinity'}}},'non-finite settlement stock is rejected');
reject(s=>{s.townQuestState._vampire={hunts:'5'}},'vampire hunt string counter is rejected');
reject(s=>{s.townQuestState._slayers={marks:'4'}},'Slayer Marks string ledger is rejected');
reject(s=>{s.gatheringSkills={mining:{xp:'10'}}},'gathering XP string is rejected');
reject(s=>{s.gearUpgradeLevels={short_sword:'5'}},'forge rank string is rejected');
reject(s=>{s.townQuestState.briar_hollow={clues:'briar_bell'}},'invalid Briar Hollow clue list is rejected');
run('storage quota failure during restore preserves original data',()=>{const before=JSON.stringify(old.slots),s=storage({[core.SLOT_KEY]:before,[core.ACTIVE_SLOT_KEY]:'slot1'});s.fail(core.SLOT_KEY);assert.throws(()=>core.restore(s,JSON.stringify(incoming),{confirmed:true}),/storage outage/);assert.equal(s.getItem(core.SLOT_KEY),before);assert.equal(s.getItem(core.ACTIVE_SLOT_KEY),'slot1')});
run('damaged local data requires explicit approval',()=>{const s=storage({[core.SLOT_KEY]:'{truncated'}),before=s.snapshot();assert.throws(()=>core.restore(s,JSON.stringify(incoming),{confirmed:true}),/approval/);assert.deepEqual(s.snapshot(),before)});
console.log('PASS: '+checks+' independent Cloud Save transaction checks');

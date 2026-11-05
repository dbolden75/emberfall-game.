'use strict';
// Real paid receipts and credits must survive cloud restores without being
// silently coerced into unusable balances or invalid ledger structures.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const oneRow=(quest={})=>({id:'slot1',name:'Tester',class:'warrior',level:2,updated:12345,state:{
  player:{name:'Tester',class:'warrior',level:2,coins:10,xp:5,hp:20,max:30,speed:3,x:10,y:15,inventory:[]},
  mapId:'wayfarers_camp',companions:[],mapStates:{},townQuestState:quest
}});
const envelope=(quest={})=>({format:'thornhaven-save',schema:1,createdAt:12345,activeSlot:'slot1',slots:{slot1:oneRow(quest)}});
const receiptId='a'.repeat(64),profile='b'.repeat(64);
const validCases=[
 {},
 {_purchaseCredits:{xp:0,builder:3}},
 {_playReceipts:{[receiptId]:'thornhaven_builder_contract'}},
 {_paidStyles:{thornhaven_crimson_aura:true}},
 {_purchaseProfile:profile},
 {_purchaseCredits:{xp:1,builder:0},_playReceipts:{[receiptId]:'thornhaven_builder_contract'},_paidStyles:{thornhaven_crimson_aura:true},_purchaseProfile:profile}
];
const invalidCases=[
 {_purchaseCredits:'not a record'},
 {_purchaseCredits:[]},
 {_purchaseCredits:{builder:'2'}},
 {_purchaseCredits:{xp:-1}},
 {_purchaseCredits:{builder:1.5}},
 {_purchaseCredits:{builder:null}},
 {_playReceipts:[]},
 {_playReceipts:{[receiptId]:null}},
 {_playReceipts:{[receiptId]:17}},
 {_playReceipts:{invalid_id:'thornhaven_builder_contract'}},
 {_paidStyles:[]},
 {_paidStyles:{thornhaven_crimson_aura:'false'}},
 {_purchaseProfile:'invalid'}
];
for(const q of validCases){
 const data=envelope(q);
 assert.doesNotThrow(()=>core.parse(JSON.stringify(data)),`valid/historical backup: ${JSON.stringify(q)}`);
 assert.equal(core.readLocal(JSON.stringify(data.slots)).unreadable,false);
}
for(const q of invalidCases){
 const data=envelope(q),text=JSON.stringify(data);
 assert.throws(()=>core.parse(text),/Invalid saved town quest progress/,`reject purchase corruption: ${JSON.stringify(q)}`);
 assert.equal(core.readLocal(JSON.stringify(data.slots)).unreadable,true,`don't treat malformed local purchases as clean save`);
 // Never alter the user's existing bytes when a selected backup is invalid.
 const previous=JSON.stringify({slot1:oneRow()}),writes=[];
 const stored=new Map([[core.SLOT_KEY,previous],[core.ACTIVE_SLOT_KEY,'slot1']]);
 const storage={getItem:key=>stored.has(key)?stored.get(key):null,setItem:(key,value)=>{writes.push(key);stored.set(key,value)},removeItem:key=>{writes.push(key);stored.delete(key)}};
 assert.throws(()=>core.restore(storage,text,{confirmed:true,allowOlder:true}),/Invalid saved town quest progress/);
 assert.deepEqual(writes,[],'invalid backup must fail before the first storage write');
 assert.equal(storage.getItem(core.SLOT_KEY),previous);
}
console.log(`PASS: ${validCases.length} valid/historical and ${invalidCases.length} invalid purchase-ledger backup cases, including local-read and zero-write restore protection`);

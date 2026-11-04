'use strict';
const assert=require('node:assert/strict');
const {reward}=require('../app/src/main/assets/purchase-delivery.js');
const profile='a'.repeat(64), id='b'.repeat(64);
const builder='thornhaven_builder_contract_25_15m';
const products=[{id:builder,productType:'consumable',category:'builder'}];
const receipt={id,product:builder,profile};
const state=(prior)=>({player:{level:7},townQuestState:{_purchaseProfile:profile,_playReceipts:{[id]:prior}}});
for(const bad of [null,false,{},'', 'emberfall_aura_embers']){
 const original=state(bad);
 assert.throws(()=>reward(original,receipt,products),/conflict|invalid/i,
  'A corrupt saved receipt must NOT cause the native bridge to acknowledge payment');
 assert.deepEqual(original,state(bad),'Failed delivery must not mutate save');
}
const duplicate=reward(state(builder),receipt,products);
assert.equal(duplicate.townQuestState._playReceipts[id],builder);
const blank={player:{level:7},townQuestState:{_purchaseProfile:profile}};
const fresh=reward(blank,receipt,products);
assert.equal(fresh.townQuestState._purchaseCredits.builder,1);
assert.equal(reward(fresh,receipt,products).townQuestState._purchaseCredits.builder,1);
console.log('PASS: corrupt/conflicting saved receipt rows reject payment acknowledgement; valid duplicate and first delivery preserved.');

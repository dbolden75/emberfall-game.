'use strict';
const assert=require('node:assert/strict');
const {reward}=require('../app/src/main/assets/purchase-delivery');
const profile='a'.repeat(64);
const products=[
 {id:'thornhaven_builder_contract_25_15m',productType:'consumable',category:'builder'},
 {id:'thornhaven_xp_boost_25_15m',productType:'consumable',category:'xp'},
 {id:'emberfall_aura_embers',productType:'non_consumable',category:'aura'}
];
const receipt=(id,product=products[0].id)=>({id:id.repeat(64),product,profile});
const state=(extra={})=>({player:{level:7},townQuestState:{_purchaseProfile:profile,...extra}});
let initial=state();
let first=reward(initial,receipt('b'),products);
assert.equal(first.townQuestState._purchaseCredits.builder,1);
assert.equal(initial.townQuestState._purchaseCredits,undefined,'Input character must not be mutated');
assert.equal(reward(first,receipt('b'),products).townQuestState._purchaseCredits.builder,1,'Same receipt must not grant twice');
let second=reward(first,receipt('c'),products);
assert.equal(second.townQuestState._purchaseCredits.builder,2,'New paid receipt adds exactly one credit');
assert.equal(reward(state({_purchaseCredits:null}),receipt('b'),products).townQuestState._purchaseCredits.builder,1,'Legacy null credit object must recover');
for(const count of ['1', -1, 1.5, Number.MAX_SAFE_INTEGER, true]){
 const original=state({_purchaseCredits:{builder:count}});
 assert.throws(()=>reward(original,receipt('b'),products),/Invalid purchase credit balance/);
 assert.equal(original.townQuestState._playReceipts,undefined,'Failed delivery must not write to original save');
}
for(const bad of [[], 'corrupted', true]){
 assert.throws(()=>reward(state({_purchaseCredits:bad}),receipt('b'),products),/Invalid purchase credit ledger/);
 assert.throws(()=>reward(state({_playReceipts:bad}),receipt('b'),products),/Invalid purchase receipt ledger/);
 assert.throws(()=>reward(state({_paidStyles:bad}),receipt('d',products[2].id),products),/Invalid purchased style ledger/);
}
const cosmetic=reward(state(),receipt('d',products[2].id),products);
assert.equal(cosmetic.townQuestState._paidStyles[products[2].id],true);
assert.equal(reward(cosmetic,receipt('d',products[2].id),products).townQuestState._paidStyles[products[2].id],true);
const xp=reward(state(),receipt('e',products[1].id),products);
assert.equal(xp.townQuestState._purchaseCredits.xp,1);
console.log('PASS: purchase credits and entitlement ledgers reject corrupt/overflowing saved shapes without acknowledging paid receipts; null legacy credits, replay prevention and existing rewards preserved.');

#!/usr/bin/env node
'use strict';
// Exercises the actual reducer. No Play purchase or Android device is used.
const assert=require('node:assert/strict');
const {reward}=require('../app/src/main/assets/purchase-delivery.js');
const id='b'.repeat(64), profile='a'.repeat(64);
const cosmetic={id:'emberfall_aura_embers',productType:'non_consumable',category:'aura'};
const builder={id:'thornhaven_builder_contract_25_15m',productType:'consumable',category:'builder'};
const products=[cosmetic,builder];
const receipt={id,product:cosmetic.id,profile};
const original=(extra={})=>({player:{level:10},townQuestState:{
 _purchaseProfile:profile,_playReceipts:{[id]:cosmetic.id},...extra
}});
const missing=original();
const repaired=reward(missing,receipt,products);
assert.equal(repaired.townQuestState._paidStyles?.[cosmetic.id],true,
 'A verified durable receipt must repair a missing style flag');
assert.equal(missing.townQuestState._paidStyles,undefined,
 'A failed or successful delivery must not mutate the original save');
const disabled=reward(original({_paidStyles:{[cosmetic.id]:false}}),receipt,products);
assert.equal(disabled.townQuestState._paidStyles[cosmetic.id],true,
 'Verified permanent ownership should survive a stale false flag');
const already=reward(original({_paidStyles:{[cosmetic.id]:true}}),receipt,products);
assert.equal(already.townQuestState._paidStyles[cosmetic.id],true,
 'Repeated ownership restores must remain idempotent');
assert.throws(()=>reward(original({_paidStyles:'corrupt'}),receipt,products),
 /Invalid purchased style ledger/,'Malformed ledger must not be acknowledged');
const replay=reward({player:{level:10},townQuestState:{
 _purchaseProfile:profile,_playReceipts:{[id]:builder.id},_purchaseCredits:{builder:7}
}},{...receipt,product:builder.id},products);
assert.equal(replay.townQuestState._purchaseCredits.builder,7,
 'Previously spent consumable receipts must never create another credit');
assert.throws(()=>reward(original(),{...receipt,product:builder.id},products),
 /Conflicting purchase receipt/,'Different SKU with same receipt remains rejected');
console.log('PASS: verified durable entitlements recover missing/stale ownership without replaying consumables; corrupted ledgers reject delivery.');

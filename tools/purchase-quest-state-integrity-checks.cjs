#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { reward } = require('../app/src/main/assets/purchase-delivery.js');
const receiptId = 'a'.repeat(64), profile = 'b'.repeat(64);
const style = { id:'emberfall_aura_embers', productType:'non_consumable', category:'aura' };
const builder = { id:'thornhaven_builder_contract_25_15m', productType:'consumable', category:'builder' };
const receipt = product => ({id:receiptId,product:product.id,profile});
for (const malformed of ['broken',17,true,[],[{}]]) {
  const state = {player:{level:10},townQuestState:malformed};
  const before = JSON.stringify(state);
  assert.throws(() => reward(state,receipt(style),[style]), /Invalid town quest state/,
    'Never acknowledge a paid style if its receipt and entitlement cannot persist');
  assert.equal(JSON.stringify(state), before, 'Reject corrupt state without mutating character saves');
}
for (const initial of [undefined,null]) {
  const state = {player:{level:10}};
  if(initial===null)state.townQuestState=null;
  const after=reward(state,receipt(style),[style]);
  assert.equal(after.townQuestState._playReceipts[receiptId],style.id);
  assert.equal(after.townQuestState._paidStyles[style.id],true);
}
const good = {player:{level:10},townQuestState:{_purchaseProfile:profile}};
const afterBuilder = reward(good,receipt(builder),[builder]);
assert.equal(afterBuilder.townQuestState._playReceipts[receiptId],builder.id);
assert.equal(afterBuilder.townQuestState._purchaseCredits.builder,1);
assert.equal(good.townQuestState._purchaseCredits,undefined, 'Reducer does not mutate original');
const duplicate = reward(afterBuilder,receipt(builder),[builder]);
assert.equal(duplicate.townQuestState._purchaseCredits.builder,1, 'Receipt replay gives no second credit');
console.log('PASS: reject malformed quest-state container before acknowledging paid cosmetics; preserve missing/null legacy state and idempotent credits.');

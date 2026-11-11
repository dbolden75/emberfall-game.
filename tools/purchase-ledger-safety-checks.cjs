#!/usr/bin/env node
'use strict';
// Run against the reconstructed production game, not a copy of the reward logic.
// Google Play checkout/receipt signature verification is tested separately;
// this suite checks that confirmed rewards cannot be replayed, transferred,
// discarded by malformed save ledgers, or silently overflowed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const assets=path.join(root,'app','src','main','assets');
const {reward}=require(path.join(assets,'purchase-delivery.js'));
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const found=html.match(/const PREMIUM_PRODUCTS=(\[[\s\S]*?\]);/);
assert(found,'Production premium product catalog missing');
const products=JSON.parse(found[1]);
assert.equal(products.length,15,'Unexpected Play product count');
assert.equal(new Set(products.map(p=>p.id)).size,15,'Duplicate product IDs');
const cosmetic=products.find(p=>p.category==='aura'&&p.productType==='non_consumable');
const builder=products.find(p=>p.category==='builder'&&p.productType==='consumable');
const xp=products.find(p=>p.category==='xp'&&p.productType==='consumable');
const levels=products.find(p=>p.category==='levels'&&p.productType==='consumable');
assert(cosmetic&&builder&&xp&&levels,'Production purchase family missing');
const profile='a'.repeat(64),otherProfile='b'.repeat(64),receiptId='1'.repeat(64);
const state=()=>({player:{name:'Test',class:'warrior',level:4},townQuestState:{_purchaseProfile:profile},other:{retained:true}});
const receipt=(product,id=receiptId,p=profile)=>({product:product.id,id,profile:p});
let count=0;
function check(label,fn){fn();count++;console.log('PASS: '+label);}
check('cosmetic grant sets ownership and receipt ledger',()=>{
 const next=reward(state(),receipt(cosmetic),products);
 assert.equal(next.townQuestState._paidStyles[cosmetic.id],true);
 assert.equal(next.townQuestState._playReceipts[receiptId],cosmetic.id);
});
check('existing cosmetic receipt repairs missing style flag without new reward',()=>{
 let next=reward(state(),receipt(cosmetic),products);
 delete next.townQuestState._paidStyles[cosmetic.id];
 next=reward(next,receipt(cosmetic),products);
 assert.equal(next.townQuestState._paidStyles[cosmetic.id],true);
 assert.equal(Object.keys(next.townQuestState._playReceipts).length,1);
});
check('builder contract delivers exactly one credit per receipt',()=>{
 let next=reward(state(),receipt(builder),products);
 next=reward(next,receipt(builder),products);
 assert.equal(next.townQuestState._purchaseCredits.builder,1);
});
check('historical paid XP credit is replay-safe',()=>{
 let next=reward(state(),receipt(xp),products);
 next=reward(next,receipt(xp),products);
 assert.equal(next.townQuestState._purchaseCredits.xp,1);
});
check('character-bound paid credit cannot transfer profiles',()=>{
 assert.throws(()=>reward(state(),receipt(builder,receiptId,otherProfile),products),/another character/);
});
check('one signed receipt cannot grant two different products',()=>{
 const next=reward(state(),receipt(builder),products);
 assert.throws(()=>reward(next,receipt(xp),products),/Conflicting/);
});
check('malformed receipt ledger is rejected, not acknowledged',()=>{
 const next=state();next.townQuestState._playReceipts=[];
 assert.throws(()=>reward(next,receipt(builder),products),/ledger/);
});
check('malformed town quest state is rejected, not acknowledged',()=>{
 const next=state();next.townQuestState='bad';
 assert.throws(()=>reward(next,receipt(builder),products),/town quest/);
});
check('credit overflow does not acknowledge a payment',()=>{
 const next=state();next.townQuestState._purchaseCredits={builder:Number.MAX_SAFE_INTEGER};
 assert.throws(()=>reward(next,receipt(builder),products),/balance/);
});
check('retired level-pack restore remains exactly once and immutable',()=>{
 const original=state();let next=reward(original,receipt(levels),products);
 assert.equal(next.player.level,4+levels.levels);
 assert.equal(original.player.level,4);
 next=reward(next,receipt(levels),products);
 assert.equal(next.player.level,4+levels.levels);
});
check('invalid receipt hash is rejected',()=>{
 assert.throws(()=>reward(state(),receipt(builder,'not-a-hash'),products),/Invalid purchase/);
});
check('unknown product cannot grant an item',()=>{
 assert.throws(()=>reward(state(),{product:'unlisted-sku',id:receiptId,profile},products),/Invalid purchase/);
});
check('unrelated character state is not mutated by grants',()=>{
 const original=state();const next=reward(original,receipt(builder),products);
 assert.deepEqual(next.other,original.other);
 assert.equal(original.townQuestState._purchaseCredits,undefined);
});
console.log('PASS: '+count+' production purchase-ledger regression scenarios');

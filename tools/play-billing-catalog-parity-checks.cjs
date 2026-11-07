#!/usr/bin/env node
'use strict';
// Prevent a paid Google Play SKU from being advertised without a deliverable
// entitlement, and prevent retired progression packs from reopening checkout.
// Pure local CI check: it cannot attest to Play Console SKU activation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const native=read('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java');
const js=read('app/src/main/assets/purchase-api.js');
const {reward}=require('../app/src/main/assets/purchase-delivery.js');
function extract(text,re,label){const m=text.match(re);assert(m,'Missing '+label);return m[1]}
const products=JSON.parse(extract(html,/const PREMIUM_PRODUCTS=(\[[\s\S]*?\]);/,'game product catalog'));
const ids=extract(native,/static final String\[\] PRODUCT_IDS=\{([^}]+)\}/,'Android Play SKU list').match(/"[^"]+"/g).map(s=>JSON.parse(s));
const retiredNative=extract(native,/private static final Set<String> RETIRED_SALE_IDS=[\s\S]*?Arrays\.asList\(([^)]+)\)/,'native retired SKUs').match(/"[^"]+"/g).map(s=>JSON.parse(s));
const retiredJs=extract(js,/const retiredSaleIds=new Set\(\[([^\]]+)\]\)/,'JS retired SKUs').match(/"[^"]+"/g).map(s=>JSON.parse(s));
const unique=arr=>new Set(arr).size===arr.length;
assert(unique(ids)&&unique(products.map(p=>p.id))&&unique(retiredNative),'Duplicate sale SKU');
assert.deepEqual([...ids].sort(),products.map(p=>p.id).sort(),'Native and JS SKU catalogs disagree');
assert.deepEqual([...retiredNative].sort(),[...retiredJs].sort(),'Retired sale catalog differs by platform');
assert(retiredNative.every(id=>ids.includes(id)),'Retired SKU lost from restoration catalog');
assert(native.includes('if(!RETIRED_SALE_IDS.contains(id))products.add('),'Retired products unexpectedly queried for sale');
assert(native.includes('if(RETIRED_SALE_IDS.contains(product))'),'Native checkout no longer blocks retired products');
assert(js.includes('if(retiredSaleIds.has(id))return show('),'JS checkout no longer blocks retired products');
let verified=0;
for(const product of products){
 assert.equal(product.productType,product.id.startsWith('thornhaven_')?'consumable':'non_consumable',product.id+' billing consumability mismatch');
 const initial={player:{name:'Traveler',class:'warrior',level:3},townQuestState:{_purchaseProfile:'a'.repeat(64)}};
 const receipt={id:(verified+1).toString(16).padStart(64,'0'),product:product.id,profile:'a'.repeat(64)};
 const purchased=reward(initial,receipt,products);
 assert.equal(purchased.townQuestState._playReceipts[receipt.id],product.id,product.id+' receipt not recorded');
 if(['builder','xp'].includes(product.category)){
  assert.equal(purchased.townQuestState._purchaseCredits[product.category],1,product.id+' credit not granted');
 }else if(product.category==='levels'){
  assert.equal(purchased.player.level,3+product.levels,product.id+' levels not granted');
 }else{
  assert.equal(purchased.townQuestState._paidStyles[product.id],true,product.id+' cosmetic not granted');
 }
 const again=reward(purchased,receipt,products);
 assert.deepEqual(again,purchased,product.id+' duplicate receipt replayed a paid grant');
 assert.deepEqual(initial,{player:{name:'Traveler',class:'warrior',level:3},townQuestState:{_purchaseProfile:'a'.repeat(64)}},'Purchase mutated live state prior to commit');
 verified++;
}
const badReceipt={id:'f'.repeat(64),product:'thornhaven_builder_contract_25_15m',profile:'b'.repeat(64)};
assert.throws(()=>reward({player:{level:3},townQuestState:{_purchaseProfile:'a'.repeat(64)}},badReceipt,products),/another character/i);
assert.throws(()=>reward({player:{level:3},townQuestState:{_purchaseProfile:'a'.repeat(64),_playReceipts:'invalid'}},{...badReceipt,profile:'a'.repeat(64)},products),/ledger/i);
console.log('PASS: '+verified+' Google Play SKUs match catalog, deliver exactly once, and retired checkout is blocked; purchase safety guards intact');

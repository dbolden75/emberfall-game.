#!/usr/bin/env node
'use strict';
// Release guard: source billing SKUs must match the actual game storefront and
// delivery contract. Does not establish Play Console SKU activation or purchases.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='app/src/main/assets/';
const java=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const html=fs.readFileSync(base+'index.html','utf8');
const js=fs.readFileSync(base+'purchase-api.js','utf8');
const reducer=fs.readFileSync(base+'purchase-delivery.js','utf8');
function capture(source,regex,name){const match=source.match(regex);assert(match,'Missing '+name);return match[1];}
function quoted(text){return [...text.matchAll(/["']([a-z][a-z0-9_]+)["']/g)].map(m=>m[1]);}
function ids(text,name){const values=quoted(text);assert.equal(values.length,new Set(values).size,'Duplicate SKU in '+name);return new Set(values);}
function same(a,b,label){assert.deepEqual([...a].sort(),[...b].sort(),label);}
const android=ids(capture(java,/static\s+final\s+String\[\]\s+PRODUCT_IDS\s*=\s*\{([^}]+)\}/,'PRODUCT_IDS'),'Android');
const old=ids(capture(java,/RETIRED_SALE_IDS\s*=\s*Collections\.unmodifiableSet\(new\s+HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\)\)/,'Android retired items'),'Android retired');
const jsOld=ids(capture(js,/retiredSaleIds\s*=\s*new\s+Set\(\[([^\]]*)\]\)/,'storefront retired items'),'storefront retired');
same(old,jsOld,'Retired native and storefront products must match');
for(const id of old)assert(android.has(id),'Retired Play ID missing from verification catalog: '+id);
const raw=capture(html,/const\s+PREMIUM_PRODUCTS\s*=\s*(\[[\s\S]*?\]);/,'game product catalog');
const products=JSON.parse(raw);
assert(Array.isArray(products)&&products.length>0,'Missing game product catalog');
const names=products.map(p=>p.id);
assert.equal(names.length,new Set(names).size,'Duplicate game product IDs');
same(android,new Set(names),'Native Play and game product IDs differ');
assert(/private\s+static\s+boolean\s+consumable\(String\s+id\)\s*\{\s*return\s+id\.startsWith\("thornhaven_"\);\s*\}/.test(java),
  'Native consumption classifier changed; audit before modifying sale types');
for(const product of products){
 const p=product;
 assert(/^[a-z][a-z0-9_]{2,}$/.test(p.id),'Malformed Play SKU: '+p.id);
 assert(['consumable','non_consumable'].includes(p.productType),'Unknown delivery type: '+p.id);
 assert.equal(p.productType==='consumable',p.id.startsWith('thornhaven_'),
   'Native consume/ack type differs from game catalog: '+p.id);
 assert(['aura','trail','title','bundle','xp','builder','levels'].includes(p.category),
   'Unhandled reward category: '+p.id);
 assert.equal(p.productType==='consumable',['xp','builder','levels'].includes(p.category),
   'Reward category/consumption mismatch: '+p.id);
 if(p.category==='bundle'){
   assert(Array.isArray(p.contains)&&p.contains.length>0,'Empty bundle: '+p.id);
   for(const childId of p.contains){
     const child=products.find(row=>row.id===childId);
     assert(child&&child.productType==='non_consumable',
       'Missing or consumable bundle component '+childId+' in '+p.id);
   }
 }
}
assert(/if\(product\.productType==='consumable'/.test(reducer),
  'Character-bound consumable delivery guard missing');
assert(/ledger\[receipt\.id\]/.test(reducer),
  'Durable receipt replay guard missing');
const active=products.filter(p=>!old.has(p.id));
assert(active.some(p=>p.productType==='consumable'),'No saleable consumable SKU');
assert(active.some(p=>p.productType==='non_consumable'),'No saleable permanent SKU');
console.log('PASS: '+products.length+' registered Play IDs match native, storefront and delivery; '+active.length+
  ' available in app, '+old.size+' retired but restorable; bundle and consumption checks passed.');
console.log('NOT VERIFIED: SKU activation/prices in Play Console or actual purchase and restoration.');

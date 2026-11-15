// Fail CI if the WebView shop and native Play Billing SKU lists drift.
// This is static catalog validation, NOT proof of Play Console activation.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('app/src/main/assets/index.html');
const api=read('app/src/main/assets/purchase-api.js');
const java=read('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java');
const found=html.match(/\bconst PREMIUM_PRODUCTS=(\[[^\n]+\]);/);
assert(found,'Missing declarative PREMIUM_PRODUCTS source');
const products=JSON.parse(found[1]);
assert(Array.isArray(products)&&products.length>0,'Empty premium catalog');
const ids=products.map(p=>p.id);
assert.equal(new Set(ids).size,ids.length,'Duplicate WebView product ID');
for(const p of products){
 assert.match(p.id,/^[a-z0-9_]+$/);
 assert(['consumable','non_consumable'].includes(p.productType),p.id+' invalid product type');
 assert.equal(p.productType==='consumable',p.id.startsWith('thornhaven_'),
  p.id+' conflicts with native consumable() routing');
 assert(['aura','trail','title','bundle','xp','builder','levels'].includes(p.category),
  p.id+' cannot be delivered by the game');
 if(p.productType==='consumable')assert(['xp','builder','levels'].includes(p.category),
  p.id+' has unsupported consumable reward');
 else assert(['aura','trail','title','bundle'].includes(p.category),
  p.id+' has unsupported non-consumable reward');
 if(p.category==='levels')assert([1,5,10].includes(p.levels),p.id+' unsupported level quantity');
 if(p.category==='bundle'){
  assert(Array.isArray(p.contains)&&p.contains.length,p.id+' empty bundle');
  assert.equal(new Set(p.contains).size,p.contains.length,p.id+' duplicate bundle item');
  for(const id of p.contains){
   const child=products.find(x=>x.id===id);
   assert(child&&child.productType==='non_consumable'&&child.category!=='bundle',
    p.id+' contains missing/consumable/recursive item '+id);
  }
 }
}
const quoted=s=>[...s.matchAll(/"([a-z0-9_]+)"/g)].map(x=>x[1]);
const native=java.match(/\bPRODUCT_IDS\s*=\s*\{([^}]+)\}\s*;/);
assert(native,'Missing native PRODUCT_IDS');
const nativeIds=quoted(native[1]);
assert.equal(new Set(nativeIds).size,nativeIds.length,'Duplicate native product ID');
assert.deepEqual([...nativeIds].sort(),[...ids].sort(),
 'Billing Java and WebView product IDs differ; checkout may be missing');
assert(/\bconsumable\(String id\)\s*\{\s*return id\.startsWith\("thornhaven_"\);\s*\}/.test(java),
 'Native consumable routing changed; update product-type parity check');
const javaRetired=java.match(/\bRETIRED_SALE_IDS\s*=\s*Collections\.unmodifiableSet\(new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\)\)/);
const webRetired=api.match(/\bretiredSaleIds\s*=\s*new Set\((\[[^\]]*\])\)/);
assert(javaRetired&&webRetired,'Missing retired SKU definitions');
const retiredJava=quoted(javaRetired[1]),retiredWeb=JSON.parse(webRetired[1]);
assert.equal(new Set(retiredJava).size,retiredJava.length,'Duplicate native retired SKU');
assert.equal(new Set(retiredWeb).size,retiredWeb.length,'Duplicate WebView retired SKU');
assert.deepEqual([...retiredJava].sort(),[...retiredWeb].sort(),
 'Retired products differ between WebView and native Play Billing');
for(const id of retiredWeb)assert(ids.includes(id),'Retired receipt history missing SKU '+id);
assert(/PREMIUM_PRODUCTS\.filter\(p=>!retiredSaleIds\.has\(p\.id\)\)/.test(api),
 'The store catalog must not offer retired SKUs');
console.log('PASS: '+ids.length+' shop/native SKUs agree; '+retiredWeb.length+
 ' retired SKUs excluded from new sales; Play activation remains unverified.');

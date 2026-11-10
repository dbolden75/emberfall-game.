'use strict';
// Verify real game shop, Play Billing SKU list and retired-sale policy agree.
// Included in tools/*checks.cjs for both Android build and maintained-key CI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'app/src/main/assets/purchase-api.js'), 'utf8');
const native = fs.readFileSync(path.join(root, 'app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java'), 'utf8');

function matchBody(source, pattern, name) {
  const m = source.match(pattern);
  assert(m, name + ': declaration missing or unexpectedly changed');
  return m[1];
}
function ids(source, name) {
  const result = [...source.matchAll(/"([a-z0-9_]+)"/g)].map(m => m[1]);
  assert(result.length > 0, name + ': empty catalog');
  assert.equal(new Set(result).size, result.length, name + ': duplicate IDs');
  assert.equal(source.replace(/"[a-z0-9_]+"/g, '').replace(/[\s,]/g, ''), '', name + ': unparsed SKU declaration');
  return result;
}
function sameSet(a, b, desc) {
  assert.deepEqual([...a].sort(), [...b].sort(), desc);
}
const nativeIds = ids(matchBody(native,
  /static\s+final\s+String\[\]\s+PRODUCT_IDS\s*=\s*\{([^}]+)\}\s*;/,
  'Native PRODUCT_IDS'), 'Native PRODUCT_IDS');
const nativeRetired = ids(matchBody(native,
  /RETIRED_SALE_IDS\s*=\s*Collections\.unmodifiableSet\(new\s+HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\)\)\s*;/,
  'Native RETIRED_SALE_IDS'), 'Native RETIRED_SALE_IDS');
const uiRetired = ids(matchBody(ui,
  /const\s+retiredSaleIds\s*=\s*new\s+Set\(\[([^\]]+)\]\)\s*;/,
  'UI retiredSaleIds'), 'UI retiredSaleIds');
const products = JSON.parse(matchBody(html,
  /const\s+PREMIUM_PRODUCTS\s*=\s*(\[[\s\S]*?\])\s*;/,
  'Game PREMIUM_PRODUCTS'));
assert(Array.isArray(products) && products.length > 0, 'Game has no premium catalog');
const gameIds = products.map(p => p && p.id);
assert(gameIds.every(id => typeof id === 'string' && /^[a-z0-9_]+$/.test(id)),
  'Game has invalid SKU ID');
assert.equal(new Set(gameIds).size, gameIds.length, 'Game has duplicate SKU IDs');
sameSet(nativeIds, gameIds, 'Native and game SKU lists disagree');
sameSet(nativeRetired, uiRetired, 'Native and UI retired-sale rules disagree');
for (const id of nativeRetired) {
  assert(nativeIds.includes(id), 'Retired SKU must remain restorable: ' + id);
}
for (const p of products) {
  // Java bridge calls consumeAsync for thornhaven_* and acknowledge otherwise.
  const expected = p.id.startsWith('thornhaven_') ? 'consumable' : 'non_consumable';
  assert.equal(p.productType, expected, p.id + ': incorrect native consume/ack behavior');
}
assert(/!retiredSaleIds\.has\(p\.id\)/.test(ui),
  'UI no longer hides retired products from its purchase catalog');
assert(/RETIRED_SALE_IDS\.contains\(product\)/.test(native),
  'Native billing no longer blocks retired products from new checkout');
console.log('PASS: ' + products.length + ' native/game SKUs, ' +
  nativeRetired.length + ' retired sale IDs, and consumption policy agree');

// Release gate: the Play Billing SDK, HTML shop, and JS facade must agree.
// This checks source parity only; it does not assert Play Console SKU activation
// or that a real-money transaction can complete on a physical device.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = p => fs.readFileSync(p, 'utf8');
const html = read('app/src/main/assets/index.html');
const native = read('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java');
const bridge = read('app/src/main/assets/purchase-api.js');

function extract(source, expression, label) {
  const found = source.match(expression);
  assert(found, 'Cannot find ' + label);
  return found[1];
}
const json = extract(html, /const PREMIUM_PRODUCTS=(\[[^\n]*?\]);/, 'HTML premium catalog');
const products = JSON.parse(json);
const ids = products.map(p => p.id);
const javaIds = [...extract(native, /\bPRODUCT_IDS\s*=\s*\{([^}]+)\};/, 'native Play product IDs').matchAll(/"([^"]+)"/g)].map(x => x[1]);
const retiredNative = [...extract(native, /RETIRED_SALE_IDS\s*=\s*Collections\.unmodifiableSet\(new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\)\);/, 'native retired product IDs').matchAll(/"([^"]+)"/g)].map(x => x[1]);
const retiredWeb = JSON.parse(extract(bridge, /retiredSaleIds\s*=\s*new Set\((\[[^\]]+\])\)/, 'web retired product IDs'));

function sameSet(actual, expected, name) {
  assert.equal(new Set(actual).size, actual.length, name + ' contains duplicate SKU values');
  assert.deepEqual([...actual].sort(), [...expected].sort(), name + ' differs from the HTML catalog');
}
sameSet(javaIds, ids, 'Native Play IDs');
sameSet(retiredWeb, retiredNative, 'Retired sale IDs (web/native)');
assert(retiredWeb.length > 0, 'No retired SKUs are protected');
for (const id of retiredWeb) {
  assert(ids.includes(id), 'A retired SKU must be kept in the legacy delivery catalog: ' + id);
  assert(products.find(p => p.id === id).productType === 'consumable', 'Retired SKU must remain deliverable: ' + id);
}
for (const p of products) {
  assert(/^[a-z][a-z0-9_]*$/.test(p.id), 'Invalid Play product identifier: ' + p.id);
  assert(['consumable', 'non_consumable'].includes(p.productType), 'Unsupported receipt type: ' + p.id);
  assert.equal(p.productType === 'consumable', p.id.startsWith('thornhaven_'),
    'Native consumable-prefix rule disagrees with ' + p.id);
}
assert(native.includes('id.startsWith("thornhaven_")'), 'Native consumable categorization changed');
assert(native.includes('if(!RETIRED_SALE_IDS.contains(id))products.add('),
  'Native price queries must exclude the off-sale SKUs');
assert(native.includes('if(RETIRED_SALE_IDS.contains(product))'),
  'Native checkout must reject off-sale SKUs');
assert(bridge.includes('PREMIUM_PRODUCTS.filter(p=>!retiredSaleIds.has(p.id))'),
  'Web catalog must not advertise off-sale products');
assert(bridge.includes('if(retiredSaleIds.has(id))return show('),
  'Web checkout must reject off-sale SKUs');
const sale = products.filter(p => !retiredNative.includes(p.id));
assert(sale.length > 0, 'Shop has no candidate products for Play query');
assert(sale.every(p => p.category !== 'xp' && p.category !== 'levels'),
  'XP or instant levels must not return to sale');
console.log('PASS: ' + ids.length + ' native, HTML and JS SKUs agree; ' +
  retiredNative.length + ' progression products remain restorable but cannot be sold; ' +
  sale.length + ' sale-candidate IDs have consistent receipt types.');
console.log('NOTE: Play Console activation, actual checkout, and Play signing are not tested.');

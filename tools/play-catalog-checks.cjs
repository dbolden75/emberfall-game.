#!/usr/bin/env node
'use strict';
// Offline release gate: keep Java Play Billing SKUs and bundled HTML delivery
// definitions in sync. This does not establish Play Console product activation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const javaPath = process.env.THORNHAVEN_CATALOG_JAVA || path.join(root, 'app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java');
const htmlPath = process.env.THORNHAVEN_CATALOG_HTML || path.join(root, 'app/src/main/assets/index.html');

function strings(source) {
  return [...source.matchAll(/"([a-z0-9_]+)"/g)].map(m => m[1]);
}
function noDuplicates(ids, name) {
  assert.equal(new Set(ids).size, ids.length, name + ': duplicate product IDs');
}
function definitions(java, html) {
  const list = java.match(/\bPRODUCT_IDS\s*=\s*\{([^}]+)\}/);
  assert.ok(list, 'Native PRODUCT_IDS literal list missing');
  const ids = strings(list[1]);
  assert.ok(ids.length, 'Native SKU catalog is empty');
  noDuplicates(ids, 'native catalog');
  const retiredList = java.match(/\bRETIRED_SALE_IDS\s*=\s*Collections\.unmodifiableSet\(new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\)\)/);
  assert.ok(retiredList, 'Retired sales allowlist missing');
  const retired = strings(retiredList[1]);
  noDuplicates(retired, 'retired sales');
  for (const id of retired) assert.ok(ids.includes(id), 'Retired receipt no longer restorable: ' + id);
  const htmlList = html.match(/\bconst PREMIUM_PRODUCTS=(\[[^\r\n]*\]);/);
  assert.ok(htmlList, 'Packaged PREMIUM_PRODUCTS JSON literal missing');
  const items = JSON.parse(htmlList[1]);
  assert.ok(Array.isArray(items) && items.length, 'Game premium catalog empty');
  noDuplicates(items.map(p => p.id), 'game catalog');
  for (const item of items) {
    assert.match(item.id, /^(emberfall|thornhaven)_[a-z0-9_]+$/, 'Unexpected product ID');
    assert.ok(['consumable', 'non_consumable'].includes(item.productType), 'Invalid product type for ' + item.id);
    assert.equal(item.productType === 'consumable', item.id.startsWith('thornhaven_'),
      'Java consumption classification disagrees for ' + item.id);
  }
  assert.deepEqual(new Set(ids), new Set(items.map(p => p.id)),
    'Java Play Billing allowlist and packaged game delivery catalog differ');
  return { ids, retired };
}
function saleGuards(java, data) {
  assert.match(java, /boolean consumable\(String id\)\s*\{return id\.startsWith\("thornhaven_"\);\}/,
    'Java consumable handling changed; review SKU/productType matching');
  assert.match(java, /for\s*\(String id\s*:\s*PRODUCT_IDS\)\s*if\s*\(!RETIRED_SALE_IDS\.contains\(id\)\)/,
    'Retired purchases must not be queried as new sale offers');
  assert.match(java, /\bvoid buy\(String product,String profile\)[\s\S]{0,240}RETIRED_SALE_IDS\.contains\(product\)/,
    'Retired purchases must be rejected by checkout');
  assert.ok(data.retired.length && data.ids.length > data.retired.length, 'Retired/active SKU split invalid');
}
function main() {
  const java = fs.readFileSync(javaPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const data = definitions(java, html);
  saleGuards(java, data);
  // Deliberate bad fixtures prove the release gate fails closed.
  assert.throws(() => definitions(java.replace('"emberfall_aura_embers"', '"emberfall_aura_unknown"'), html),
    /catalog differ/);
  const declaration = java.match(/\bRETIRED_SALE_IDS\s*=\s*Collections\.unmodifiableSet\(new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\)\)/)[0];
  const badRetirement = java.replace(declaration,
    declaration.replace('"' + data.retired[0] + '"', '"emberfall_aura_unknown"'));
  assert.throws(() => definitions(badRetirement, html), /no longer restorable/);
  const badType = html.replace(/("id":"emberfall_aura_embers"[^\r\n]*?"productType":)"non_consumable"/,
    '$1"consumable"');
  assert.throws(() => definitions(java, badType), /classification disagrees/);
  assert.throws(() => saleGuards(java.replace('RETIRED_SALE_IDS.contains(product)', 'false'), data),
    /rejected by checkout/);
  console.log('PASS: ' + data.ids.length + ' Java/HTML SKU definitions match; ' +
    data.retired.length + ' retired products remain restorable but unsellable; negative fixtures rejected.');
}
if (require.main === module) main();
module.exports = { definitions, saleGuards };

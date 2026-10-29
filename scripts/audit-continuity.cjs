// Read-only continuity inventory. Does not modify saves, maps or quests.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const title = (html.match(/<title>\s*([^<]+)\s*<\/title>/i) || [])[1] || '';
assert(/^Thornhaven\b/i.test(title), 'Player-facing HTML title must begin with Thornhaven');
const terms = {
  towns: ['Ashvale', 'Sunmere', 'Summere Port', 'Brackenford', 'Stonewatch', 'Bellwether'],
  story: ['Dalen', 'Eryn', 'Sylvi', 'Corin', 'Auren', 'Veyr', 'Oren Voss'],
  developer: ['TheDanCode', 'DanCode'],
};
const inventory = { title, groups: {} };
for (const [group, names] of Object.entries(terms)) {
  inventory.groups[group] = {};
  for (const name of names) {
    const matches = html.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    inventory.groups[group][name] = matches ? matches.length : 0;
  }
}
console.log(JSON.stringify(inventory, null, 2));
console.log('PASS: Thornhaven title verified; other names are inventory-only, not assumptions of implementation');

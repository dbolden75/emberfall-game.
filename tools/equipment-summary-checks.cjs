'use strict';
// Exercise the exact expression used by the game inventory HUD, not a copy.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const found=html.match(/document\.getElementById\('equipmentSummary'\)\.textContent=(.+?);document\.getElementById\('bagCapacity'\)/s);
assert(found,'Cannot find actual inventory equipped-gear summary in game code');
const summary=new Function('player','itemDefs','return '+found[1]);
const defs={iron_sword:{name:'Iron Sword'},wool_vest:{name:'Wool Vest'},wood_shield:{name:'Wood Shield'}};
const equipped={weapon:'iron_sword',armor:'wool_vest',shield:'wood_shield'};
assert.equal(summary(equipped,defs),'Weapon: Iron Sword · Armor: Wool Vest · Shield: Wood Shield');
for(const [part,label] of [['weapon','Weapon'],['armor','Armor'],['shield','Shield']]){
 const stale={...equipped,[part]:'removed_item_id'};
 const rendered=summary(stale,defs);
 assert.match(rendered,new RegExp(label+': none(?: ·|$)'),
  part+' points to an unavailable item and must not crash the inventory');
 assert.equal(stale[part],'removed_item_id','Never mutate old equipped IDs or save progress');
}
assert.equal(summary({weapon:null,armor:null,shield:null},defs),
 'Weapon: none · Armor: none · Shield: none');
console.log('PASS: inventory HUD tolerates unavailable historical gear IDs without changing saved equipment.');

#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../app/src/main/assets/cloud-save-core.js');
const catalog={short_sword:{name:'Short Sword'},health_tonic:{name:'Health Tonic'},buckler:{name:'Buckler'}};
const saved=()=>({format:'thornhaven-save',schema:1,createdAt:10,activeSlot:'slot1',slots:{
 slot1:{id:'slot1',updated:10,name:'Hero',class:'warrior',level:2,state:{
  player:{name:'Hero',class:'warrior',level:2,coins:20,inventory:[{id:'health_tonic',count:2}],weapon:'short_sword',shield:'buckler'},
  mapId:'ashvale',mapStates:{},townQuestState:{},companions:[],
  houseStorage:{brackenford:{front_chest:[{id:'health_tonic',count:1}],side_chest:[]}},
  gearUpgradeLevels:{short_sword:2}
 }}}
});
const fixture=saved();
assert.equal(core.assertRestorableItemCatalog(core.parse(JSON.stringify(fixture)),catalog),true);
assert.deepEqual(fixture,saved(),'Preflight must not change a backup');
function rejected(label,change){
 const backup=saved();change(backup.slots.slot1.state);
 const parsed=core.parse(JSON.stringify(backup));
 assert.throws(()=>core.assertRestorableItemCatalog(parsed,catalog),/unavailable item|item compatibility/i,label);
 assert.deepEqual(backup,JSON.parse(JSON.stringify(backup)),'Reject without altering backup');
}
rejected('Future bag item',s=>s.player.inventory[0].id='future_potion');
rejected('Future worn item',s=>s.player.weapon='future_blade');
rejected('Future pet equipment',s=>s.companions=[{id:'dalen',petVersion:1,weapon:'future_blade'}]);
rejected('Future town chest item',s=>s.houseStorage.brackenford.front_chest[0].id='future_ring');
rejected('Future root chest item',s=>{delete s.houseStorage.brackenford;s.houseStorage.front_chest=[{id:'future_ring',count:1}];});
rejected('Future paid forge upgrade',s=>s.gearUpgradeLevels.future_axe=3);
// Historical save fields can be absent, and unused future zero ranks should
// not block a restore. No schema changes are needed for either case.
const legacy=saved().slots.slot1.state;
delete legacy.houseStorage;delete legacy.gearUpgradeLevels;delete legacy.player.weapon;
assert.equal(core.assertRestorableItemCatalog({slots:{slot1:{state:legacy}}},catalog),true);
const emptyFuture=saved();emptyFuture.slots.slot1.state.gearUpgradeLevels.future_axe=0;
assert.equal(core.assertRestorableItemCatalog(emptyFuture,catalog),true);
assert.throws(()=>core.assertRestorableItemCatalog(fixture,Object.create(null)),/unavailable item/);
const ui=fs.readFileSync('app/src/main/assets/cloud-save.js','utf8');
assert(ui.includes('core.assertRestorableItemCatalog(incoming,itemDefs);'),'Cloud Save review must verify live item definitions');
assert(ui.indexOf('core.assertRestorableItemCatalog(incoming,itemDefs);')<ui.indexOf('pending=text;'),'Restore preflight must run before confirming a backup');
console.log('PASS: Cloud Save restore preflight blocks six unsupported item-loss paths and preserves legacy/known inventory.');

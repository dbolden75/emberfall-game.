// Regression matrix for shipped Thornhaven Cloud Save format.
// No signing key, Android device, or network access is required.
'use strict';
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
let passed=0;
function check(label,fn){fn();passed++;console.log('PASS',label);}
function state(){return {
 player:{name:'Upgrade Tester',class:'warrior',level:3,coins:12,xp:22,
  inventory:[{id:'iron_ore',count:2}],weapon:'short_sword',
  hp:20,max:20,speed:135,x:100,y:120},
 mapId:'ashvale',mapStates:{ashvale:{runes:[false],traps:[false],runeProgress:0,enemies:[]}},
 townQuestState:{_purchaseCredits:{xp:0,builder:0}},companions:[],
 houseStorage:{ashvale:{front_chest:[{id:'iron_ore',count:1}],side_chest:[]}},
 gatheringSkills:{mining:{xp:0,level:1}},
 gearUpgradeLevels:{short_sword:2}
};}
function row(){return {id:'slot1',updated:1700000000000,name:'Upgrade Tester',
 class:'warrior',level:3,state:state()};}
function backup(){return {format:'thornhaven-save',schema:1,createdAt:1700000000000,
 activeSlot:'slot1',slots:{slot1:row()}};}
const parse=o=>core.parse(JSON.stringify(o));
const itemCatalog={short_sword:{name:'Short Sword'},iron_ore:{name:'Iron Ore'}};
check('normal character, house and forged gear restore',()=>{
 const o=parse(backup());
 assert.equal(o.slots.slot1.state.gearUpgradeLevels.short_sword,2);
 assert.equal(o.slots.slot1.state.houseStorage.ashvale.front_chest[0].count,1);
 core.assertRestorableItemCatalog(o,itemCatalog);
});
check('future unavailable forged item with positive rank is blocked',()=>{
 const o=backup();o.slots.slot1.state.gearUpgradeLevels.future_sword=1;
 assert.throws(()=>core.assertRestorableItemCatalog(parse(o),itemCatalog),/unavailable item/);
});
check('unrecognized zero-rank metadata is compatible',()=>{
 const o=backup();o.slots.slot1.state.gearUpgradeLevels.future_sword=0;
 core.assertRestorableItemCatalog(parse(o),itemCatalog);
});
check('text or oversized forge rank is rejected',()=>{
 for(const rank of ['2',6,-1]){
  const o=backup();o.slots.slot1.state.gearUpgradeLevels.short_sword=rank;
  assert.throws(()=>parse(o),/forge progress/);
 }
});
check('corrupted chest stack is rejected',()=>{
 const o=backup();o.slots.slot1.state.houseStorage.ashvale.front_chest[0].count='2';
 assert.throws(()=>parse(o),/house chest/);
});
check('future home with stored items cannot be silently erased',()=>{
 const o=backup();
 o.slots.slot1.state.houseStorage.future_town={front_chest:[{id:'iron_ore',count:9}]};
 assert.throws(()=>parse(o),/house chest/);
});
check('unknown map progress cannot be silently erased',()=>{
 const o=backup();o.slots.slot1.state.mapStates.future_map={enemies:[]};
 assert.throws(()=>parse(o),/Unknown saved map/);
});
check('too many saved rune objects blocks lossy restore',()=>{
 const o=backup();o.slots.slot1.state.mapStates.ashvale.runes=[false,false];
 assert.throws(()=>core.assertRestorableMapLayout(parse(o),{
  ashvale:{runes:[{}],traps:[{}],enemies:[],gatherNodes:[],runeSequence:[]}
 }),/more runes/);
});
check('same-timestamp different saves trigger overwrite conflict',()=>{
 const o=backup(),local=row();local.state.player.coins=13;
 assert.deepEqual(core.conflicts(o,{slot1:local}),['slot1']);
});
check('restore cannot proceed without explicit confirmation',()=>{
 assert.throws(()=>core.restore({getItem:()=>null},JSON.stringify(backup())),/Confirm/);
});
check('confirmed empty-device restore persists slot and selection',()=>{
 const m=new Map(),storage={
  getItem:k=>m.has(k)?m.get(k):null,
  setItem:(k,v)=>m.set(k,v),
  removeItem:k=>m.delete(k)
 };
 core.restore(storage,JSON.stringify(backup()),{confirmed:true});
 assert.equal(storage.getItem(core.ACTIVE_SLOT_KEY),'slot1');
 assert.equal(JSON.parse(storage.getItem(core.SLOT_KEY)).slot1.state.player.coins,12);
});
check('silent slot-write failure rolls back selection',()=>{
 const m=new Map(),storage={
  getItem:k=>m.has(k)?m.get(k):null,
  setItem:(k,v)=>{if(k!==core.SLOT_KEY)m.set(k,v);},
  removeItem:k=>m.delete(k)
 };
 assert.throws(()=>core.restore(storage,JSON.stringify(backup()),{confirmed:true}),/Could not verify/);
 assert.equal(storage.getItem(core.ACTIVE_SLOT_KEY),null);
});
check('export/import preserves precise forged gear and home chest values',()=>{
 const slots={slot1:row()};
 const restored=core.parse(core.encode(slots,'slot1',1700000000000));
 assert.deepEqual(restored.slots,slots);
});
console.log('PASS: '+passed+' of '+passed+' signed-candidate save-compatibility assertions');

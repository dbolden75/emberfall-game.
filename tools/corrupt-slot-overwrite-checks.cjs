#!/usr/bin/env node
'use strict';
// Execute the real signed-release saveGame() and the late-loaded save guard.
// No device, external files or signing credentials are touched.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..','app','src','main','assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const client=fs.readFileSync(path.join(root,'purchase-api.js'),'utf8');
const a=html.indexOf('function saveGame(){'),b=html.indexOf('function applyDanCompanionGear(',a);
assert(a!==-1&&b>a,'Missing real Thornhaven save routine');
const begin=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */');
const end=client.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */');
assert(begin!==-1&&end>begin,'Missing save durability guard');
const guard=client.slice(begin,end+'/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'.length);
const KEY='emberfall_character_slots_v1';
let tests=0;
for(const malformed of [
 // Existing slots with unsupported class IDs cannot be silently normalized and overwritten.
// An inventory explicitly present but not an array (or containing invalid rows)
 // can crash inventory rendering and must not be overwritten by saving.
 // A parseable but corrupt stack must never be treated as durable inventory.
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:'3'}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:null}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:-1}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:0}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:1.5}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:2},{id:'ore',count:1}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'__proto__',count:1}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'constructor',count:1}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'prototype',count:1}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:null}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:{id:'ore'}}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[null]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:['ore']}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{count:2}]}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[]}}},slot2:{state:{player:{name:'Mia',class:'mage',inventory:null}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'archer'}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'WARRIOR'}}}}),
 JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior'}}},slot2:{state:{player:{name:'Mia',class:'unknown'}}}}),"{broken","null","[]","1","\"string\"","{\"slot1\":null}","{\"slot1\":7}","{\"slot1\":{}}","{\"slot1\":{\"state\":null}}","{\"slot1\":{\"state\":{\"mapId\":\"ashvale\"}}}","{\"slot1\":{\"state\":{\"player\":{\"name\":\"\",\"class\":\"warrior\"}}}}","{\"slot1\":{\"id\":\"slot1\",\"name\":\"Ava\",\"state\":{\"player\":{\"name\":\"Ava\",\"class\":\"warrior\"}}},\"slot2\":{\"state\":{\"player\":null}}}"]){
 const storage=new Map([[KEY,malformed]]),elements=new Map(),deliveryCalls=[];
 const state={player:{name:'Ava',class:'warrior',level:12,inventory:[{id:'ore',count:3}]},mapId:'ashvale'};
 const document={getElementById:id=>elements.get(id)||null,
   createElement:()=>({setAttribute(){},style:{},remove(){elements.delete(this.id)}}),
   body:{appendChild:el=>elements.set(el.id,el)}};
 const context={window:{},SAVE_SLOTS_KEY:KEY,SAVE_KEY:'emberfall_singleplayer_v1',
   ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
   hasStarted:true,titleMenuActive:false,switchingCharacter:false,
   activeSlotId:'slot1',saveSlots:{},player:state.player,
   snapshotGameState:()=>structuredClone(state),document,Date,JSON,
   console:{error(){},warn(){}},
   localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,
      setItem:(k,v)=>storage.set(k,String(v))},
   purchaseCommit(next){deliveryCalls.push(next);storage.set(KEY,JSON.stringify({slot1:{state:next}}));}
 };
 vm.createContext(context);
 vm.runInContext(html.slice(a,b),context,{timeout:1000});
 vm.runInContext(guard,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),true,'Checkout must be able to detect corrupted slots');
 context.saveGame();
 assert.equal(storage.get(KEY),malformed,'Ordinary save must preserve malformed bytes');
 assert.throws(()=>context.purchaseCommit(state),/Damaged character slots/);
 assert.equal(storage.get(KEY),malformed,'Paid delivery must not overwrite damaged bytes');
 assert.equal(deliveryCalls.length,0,'Purchase callback must be rejected before writing');
 assert.match(elements.get('saveFailureWarning').textContent,/Restore a verified backup/);
 // An intentional empty roster and an unwrapped historical state are valid.
 storage.set(KEY,'{}');
 assert.equal(context.window.ThornhavenDamagedSlots(),false,'Empty character list must remain valid');
 storage.set(KEY,JSON.stringify({slot1:state}));
 assert.equal(context.window.ThornhavenDamagedSlots(),false,'Historical unwrapped saves must remain valid');
 for(const supportedClass of ['warrior','rogue','mage','cleric']){
  storage.set(KEY,JSON.stringify({slot1:{state:{player:{name:'Ava',class:supportedClass}}}}));
  assert.equal(context.window.ThornhavenDamagedSlots(),false,'Supported class must remain loadable: '+supportedClass);
 }
 // Omitted inventories remain valid for historical characters; present valid rows
 // must also permit ordinary saves and paid delivery after restoration.
 storage.set(KEY,JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[]}}}}));
 assert.equal(context.window.ThornhavenDamagedSlots(),false,'An empty inventory is valid');
 storage.set(KEY,JSON.stringify({slot1:{state:{player:{name:'Ava',class:'warrior',inventory:[{id:'ore',count:2}]}}}}));
 assert.equal(context.window.ThornhavenDamagedSlots(),false,'Valid inventory rows remain supported');
 // After an explicitly restored, parseable slot, saves/purchases are allowed.
 storage.set(KEY,JSON.stringify({slot1:{id:'slot1',state}}));
 assert.equal(context.window.ThornhavenDamagedSlots(),false,'Verified recovery permits checkout');
 context.saveGame();
 assert.equal(JSON.parse(storage.get(KEY)).slot1.state.player.level,12);
 assert.equal(elements.has('saveFailureWarning'),false,'Successful retry should clear warning');
 context.purchaseCommit(state);
 assert.equal(deliveryCalls.length,1);
 tests++;
}
console.log('PASS: '+tests+' syntactic and structural corrupt-slot cases block saves and purchase delivery, including inactive-slot damage; empty and historical unwrapped slots remain valid. Mocked WebView only.');

// Deleting one character can also overwrite the authoritative slot map. At the
// title screen confirmSaveBeforeSlotSwitch() returns true without calling saveGame.
// Run the REAL deletion routine from the bundled HTML, not a synthetic delete.
const deleteBegin=html.indexOf('function confirmSaveBeforeSlotSwitch(){');
const deleteEnd=html.indexOf('function closeGameToSaveMenu()',deleteBegin);
assert(deleteBegin!==-1&&deleteEnd>deleteBegin,'Missing real save-slot deletion routine');
const deleteRoutine=html.slice(deleteBegin,deleteEnd);
for(const brokenSlot of [
 {state:{player:null}},
 {state:{player:{name:'',class:'warrior'}}},
]){
 const healthy={id:'slot1',name:'Ava',state:{player:{name:'Ava',class:'warrior'}}};
 const healthyToDelete={id:'slot2',name:'Ben',state:{player:{name:'Ben',class:'mage'}}};
 // Damage in inactive slot3 must protect unrelated slot2 from deletion.
 const slots={slot1:healthy,slot2:healthyToDelete,slot3:brokenSlot};
 let raw=JSON.stringify(slots),writes=0,confirmations=0;
 const elements=new Map();
 const context={SAVE_SLOTS_KEY:KEY,SAVE_KEY:'emberfall_singleplayer_v1',
  SAVE_SLOT_IDS:['slot1','slot2','slot3','slot4'],saveSlots:slots,
  activeSlotId:'slot1',hasStarted:false,titleMenuActive:true,switchingCharacter:false,
  saveGame(){},say(){},renderSaveSlots(){},Date,JSON,
  window:{confirm:()=>{confirmations++;return true;}},
  document:{getElementById:id=>elements.get(id)||null,
   createElement:()=>({setAttribute(){},style:{},remove(){}}),
   body:{appendChild:el=>elements.set(el.id,el)}},
  localStorage:{getItem:k=>k===KEY?raw:null,setItem:(k,v)=>{if(k===KEY){raw=String(v);writes++;}},removeItem(){}},
  console:{error(){},warn(){}}
 };
 vm.createContext(context);
 vm.runInContext(deleteRoutine,context,{timeout:1000});
 vm.runInContext(guard,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),true);
 context.deleteSaveSlot('slot2');
 assert.equal(raw,JSON.stringify(slots),'Delete of another slot must not overwrite damaged bytes');
 assert.equal(writes,0,'No authoritative storage writes when any slot is damaged');
 assert.equal(confirmations,0,'Deletion must be blocked before asking for destructive confirmation');
 assert.match(elements.get('saveFailureWarning').textContent,/Restore a verified backup/);
 tests++;
}
// Verified healthy roster must retain the ability to delete an inactive hero.
{
 const good={id:'slot1',state:{player:{name:'Ava',class:'warrior'}}};
 const slots={slot1:good,slot2:{id:'slot2',name:'Ben',state:{player:{name:'Ben',class:'mage'}}}};
 let raw=JSON.stringify(slots),writes=0;
 const context={SAVE_SLOTS_KEY:KEY,SAVE_KEY:'emberfall_singleplayer_v1',
  SAVE_SLOT_IDS:['slot1','slot2','slot3','slot4'],saveSlots:slots,
  activeSlotId:'slot1',hasStarted:false,titleMenuActive:true,switchingCharacter:false,
  saveGame(){},say(){},renderSaveSlots(){},Date,JSON,
  window:{confirm:()=>true},document:{getElementById:()=>null,createElement:()=>({setAttribute(){},style:{}}),body:{appendChild(){}}},
  localStorage:{getItem:k=>k===KEY?raw:null,setItem:(k,v)=>{if(k===KEY){raw=String(v);writes++;}},removeItem(){}},
  console:{error(){},warn(){}}
 };
 vm.createContext(context);vm.runInContext(deleteRoutine,context,{timeout:1000});vm.runInContext(guard,context,{timeout:1000});
 assert.equal(context.window.ThornhavenDamagedSlots(),false);
 context.deleteSaveSlot('slot2');
 assert.equal(writes,1,'Safe inactive slot can still be deleted');
 assert.deepEqual(Object.keys(JSON.parse(raw)),['slot1']);
 tests++;
}
console.log('PASS: title-screen deletion blocks all damaged character maps (including unrelated inactive slot damage); healthy inactive slot deletion still works. Mocked WebView.');

// Exercise the public checkout UI, not merely the exported guard.
(async()=>{
 const attempts=[],summary={textContent:''},restoreButton={},shopButton={textContent:''};
 const context={window:{ThornhavenPlayPurchases:{buy:(...args)=>attempts.push(args),restore(){}},
                  ThornhavenDamagedSlots:()=>true},
  document:{getElementById:id=>({premiumSummary:summary,restorePurchasesButton:restoreButton,premiumShopButton:shopButton})[id]||{},
   querySelectorAll:()=>[],querySelector:()=>null},
  PREMIUM_PRODUCTS:[{id:'test_cosmetic'}],premiumProduct:id=>id==='test_cosmetic'?{id}:null,
  hasStarted:true,titleMenuActive:false,switchingCharacter:false,danTesting:()=>false,
  pollPlayStore(){},playStore:{busy:false,products:{test_cosmetic:{price:'Play price'}}},
  ensurePurchaseProfile:()=> 'a'.repeat(64),townQuestState:{},
  renderPremiumShop(){},premiumCategory:'all',buyPlayProduct(){}
 };
 vm.createContext(context);vm.runInContext(client,context,{timeout:1000});
 assert.equal((await context.window.ThornhavenMonetization.purchase('test_cosmetic')).status,'unavailable');
 assert.match(summary.textContent,/Restore a verified backup/);
 assert.equal(attempts.length,0,'Never open checkout while authoritative save is damaged');
 context.window.ThornhavenDamagedSlots=()=>false;
 assert.equal((await context.window.ThornhavenMonetization.purchase('test_cosmetic')).status,'requested');
 assert.equal(attempts.length,1,'Valid restored slots permit native checkout');
 console.log('PASS: public Google Play checkout blocks damaged slots and allows verified recovery. Mocked Play bridge.');
})().catch(error=>{console.error(error);process.exitCode=1});

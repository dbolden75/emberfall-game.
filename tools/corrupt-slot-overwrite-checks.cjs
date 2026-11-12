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
for(const malformed of ['{broken','null','[]','1','"string"']){
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
console.log('PASS: '+tests+' malformed character-slot formats block saves and purchase delivery until verified recovery; no original bytes overwritten. Mocked WebView only.');

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

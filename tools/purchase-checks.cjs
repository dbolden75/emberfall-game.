const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {reward}=require('../app/src/main/assets/purchase-delivery');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const products=JSON.parse(html.match(/const PREMIUM_PRODUCTS=(\[.*?\]);/s)[1]);
const id='a'.repeat(64),profile='b'.repeat(64);
const state={player:{level:17,xp:23,name:'Tester',class:'warrior'},townQuestState:{_purchaseProfile:profile}};
const receipt={id,product:'thornhaven_levels_5',profile};
const paid=reward(state,receipt,products);assert.equal(paid.player.level,22);assert.equal(paid.player.xp,23);assert.equal(state.player.level,17);
assert.equal(reward(paid,receipt,products).player.level,22);
assert.throws(()=>reward(state,{...receipt,profile:'c'.repeat(64)},products));
assert.throws(()=>reward(state,{...receipt,product:'unknown'},products));
assert.throws(()=>reward(state,{...receipt,id:'forged'},products));
const boost=reward(state,{...receipt,product:'thornhaven_xp_boost_25_15m'},products);assert.equal(boost.townQuestState._purchaseCredits.xp,1);assert(!boost.townQuestState._xpBoost);assert.equal(reward(boost,{...receipt,product:'thornhaven_xp_boost_25_15m'},products).townQuestState._purchaseCredits.xp,1);
const builder=reward(state,{...receipt,product:'thornhaven_builder_contract_25_15m'},products);assert.equal(builder.townQuestState._purchaseCredits.builder,1);assert(!builder.townQuestState._builderBoost);
const cosmetic=reward(state,{...receipt,product:'emberfall_bundle_founder',profile:'other'},products);assert(cosmetic.townQuestState._paidStyles.emberfall_bundle_founder);
// Execute actual commit function with storage failures, not a copy of its logic.
const commit=html.slice(html.indexOf('function purchaseCommit('),html.indexOf('function ensurePurchaseProfile('));
let persisted={},failMain=false,failCache=false;
const context={SAVE_SLOTS_KEY:'slots',SAVE_KEY:'cache',ACTIVE_SLOT_KEY:'active',activeSlotId:'slot2',saveSlots:{slot1:{name:'Other'}},townQuestState:state.townQuestState,player:{...state.player},Date,JSON,syncHeroStats(){},normalizePets(){},scaleEnemiesForRegion(){},localStorage:{setItem(k,v){if(k==='slots'&&failMain||k!=='slots'&&failCache)throw Error('storage full');persisted[k]=v}}};
vm.createContext(context);vm.runInContext(commit,context);
failMain=true;assert.throws(()=>context.purchaseCommit(paid));assert.equal(context.player.level,17);assert.equal(context.townQuestState._playReceipts,undefined);
failMain=false;failCache=true;context.purchaseCommit(paid);assert.equal(context.player.level,22);const disk=JSON.parse(persisted.slots);assert.equal(disk.slot2.state.player.level,22);assert.equal(disk.slot2.state.townQuestState._playReceipts[id],receipt.product);assert.equal(disk.slot1.name,'Other');
// Crash/reload uses the authoritative slot state, so a callback replay cannot add levels.
assert.equal(reward(disk.slot2.state,receipt,products).player.level,22);
console.log('PASS: levels preserve XP; duplicate/reload protection; wrong character; invalid SKU/receipt; boost credits; cosmetic restore; storage failure and atomic reward ledger.');

'use strict';
// This release gate uses the shipped purchase bridge in a simulated JS host.
// It does not represent actual Google Play Billing or device testing.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/purchase-api.js','utf8');
const products=[
 {id:'emberfall_aura_embers',category:'aura'},
 {id:'emberfall_bundle_founder',category:'bundle',contains:['emberfall_aura_embers']}
];
let developer=true,removed=0,oldGrantCalls=0;
const oldFlags={emberfall_aura_embers:true};
const elements={premiumSummary:{textContent:''},premiumShopButton:{textContent:''},restorePurchasesButton:{}};
const fakeButton={textContent:'Test grant · no payment',remove(){removed++}};
const buys=[];
const context={
 window:{ThornhavenPlayPurchases:{buy:(...args)=>buys.push(args),restore() {}}},
 document:{getElementById:id=>elements[id],querySelectorAll:selector=>selector==='#premiumList .premiumCard button'?[fakeButton]:[],querySelector:()=>null},
 renderPremiumShop(){},premiumCategory:'all',PREMIUM_PRODUCTS:products,
 premiumProduct:id=>products.find(p=>p.id===id),
 hasStarted:true,titleMenuActive:false,switchingCharacter:false,
 danTesting:()=>developer,
 playStore:{products:{emberfall_aura_embers:{price:'$1.99'}},owned:[],busy:false},
 townQuestState:{_testPremium:oldFlags},
 purchaseOwned:id=>id in oldFlags,
 grantTestPremium(){oldGrantCalls++},
 ensurePurchaseProfile:()=>'a'.repeat(64),pollPlayStore(){},buyPlayProduct(){}
};
vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 assert.equal(context.purchaseOwned('emberfall_aura_embers'),false,'A developer test flag must not count as a paid item');
 assert.equal(context.grantTestPremium('emberfall_aura_embers'),false,'Free grant action must be disabled');
 assert.equal(oldGrantCalls,0,'Legacy grant function must never run');
 assert.equal(context.townQuestState._testPremium,oldFlags,'Old saves must not be rewritten');
 context.renderPremiumShop();
 assert.equal(removed,1,'Remove free-grant button from public shop');
 assert.match(elements.premiumSummary.textContent,/Level testing only/);
 assert.equal((await context.window.ThornhavenMonetization.purchase('emberfall_aura_embers')).status,'test-character');
 assert.equal(buys.length,0,'Developer char must not open checkout');
 context.playStore.owned=['emberfall_bundle_founder'];
 assert.equal(context.purchaseOwned('emberfall_aura_embers'),true,'Restored Play bundle must grant included cosmetic');
 context.playStore.owned=['emberfall_aura_embers'];
 assert.equal(context.purchaseOwned('emberfall_aura_embers'),true,'Verified individual Play cosmetic must remain owned');
 context.playStore.owned=[];developer=false;
 assert.equal(context.purchaseOwned('emberfall_aura_embers'),false,'Test flag must never leak to a normal character');
 assert.equal((await context.window.ThornhavenMonetization.purchase('emberfall_aura_embers')).status,'requested');
 assert.deepEqual(buys,[['emberfall_aura_embers','a'.repeat(64)]],'Normal character Google Play purchase path must work');
 console.log('PASS: TheDanCode has no free premium grants; old test data preserved but ignored; Play ownership, bundle restores, and normal checkout remain intact.');
})().catch(e=>{console.error(e);process.exitCode=1});

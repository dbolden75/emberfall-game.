const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app/src/main/assets/purchase-api.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(html.includes('<script src="purchase-api.js"></script>'));
function setup({native=true,test=false,available=true}={}){
 const calls=[],elements={premiumSummary:{},restorePurchasesButton:{}};
 const bridge={buy:(...args)=>calls.push(['buy',...args]),restore:()=>calls.push(['restore'])};
 const c={window:native?{ThornhavenPlayPurchases:bridge}:{},document:{getElementById:id=>elements[id]},PREMIUM_PRODUCTS:[{id:'halo'}],premiumProduct:id=>id==='halo'?{id}:null,hasStarted:true,titleMenuActive:false,switchingCharacter:false,danTesting:()=>test,pollPlayStore:()=>{},playStore:{products:available?{halo:{price:'$0.99'}}:{},busy:false},ensurePurchaseProfile:()=>'a'.repeat(64),buyPlayProduct:()=>{}};
 vm.createContext(c);vm.runInContext(source,c);return {c,calls,api:c.window.ThornhavenMonetization,elements};
}
(async()=>{
 let t=setup();assert.strictEqual(t.api,t.c.window.EmberfallMonetization);
 assert.equal((await t.c.buyPlayProduct('halo')).status,'requested');assert.deepEqual(t.calls,[['buy','halo','a'.repeat(64)]]);
 assert.equal((await t.elements.restorePurchasesButton.onclick()).status,'requested');assert.equal(t.calls[1][0],'restore');
 t=setup({test:true});assert.equal((await t.api.purchase('halo')).status,'test-character');assert.equal(t.calls.length,0);
 t=setup({native:false});assert.equal((await t.api.purchase('halo')).status,'unavailable');assert.equal((await t.api.restorePurchases()).status,'unavailable');
 t=setup({available:false});assert.equal((await t.api.purchase('halo')).status,'unavailable');assert.deepEqual(t.calls,[['restore']]);
 t=setup();t.c.playStore.busy=true;assert.equal((await t.api.purchase('halo')).status,'busy');assert.equal(t.calls.length,0);
 t=setup();t.c.ensurePurchaseProfile=()=>{throw Error('disk full')};assert.equal((await t.api.purchase('halo')).status,'error');assert.equal(t.calls.length,0);
 t=setup();t.c.hasStarted=false;assert.equal((await t.api.purchase('halo')).status,'unavailable');assert.equal(t.calls.length,0);
 t=setup();t.c.premiumProduct=()=>({id:'halo',saleEnabled:false});assert.equal((await t.api.purchase('halo')).status,'unavailable');assert.equal(t.calls.length,0);
 t=setup();assert.equal((await t.api.purchase('unknown')).status,'unavailable');assert.equal(t.calls.length,0);
 console.log('PASS: public APIs and Buy/Restore route to native billing; test character, unavailable product, missing bridge, busy checkout, storage failure and unloaded character do not start payment.');
})().catch(e=>{console.error(e);process.exitCode=1});

/* The Android billing bridge is authoritative; a preview is never ownership. */
(()=>{
 function result(status,message){return {status,message};}
 function show(value){document.getElementById('premiumSummary').textContent=value.message;return value;}
 const api=Object.freeze({
  mode:window.ThornhavenPlayPurchases?'google-play':'preview',
  getCatalog:()=>JSON.parse(JSON.stringify(PREMIUM_PRODUCTS)),
  purchase:async id=>{
   if(!premiumProduct(id))return show(result('unavailable','This item is not in the shop.'));
   if(!hasStarted||titleMenuActive||switchingCharacter)return show(result('unavailable','Load your character before making a purchase.'));
   if(danTesting())return show(result('test-character','Real payments are disabled for TheDanCode. Load a normal character to use Google Play checkout.'));
   if(!window.ThornhavenPlayPurchases)return show(result('unavailable','Google Play checkout requires the Android Play release.'));
   try{
   pollPlayStore();
   if(playStore.busy)return show(result('busy','A Google Play checkout is already open.'));
   if(!playStore.products[id]){window.ThornhavenPlayPurchases.restore();return show(result('unavailable','This item is not available from Google Play. Refreshing the shop; try again when its price appears.'));}
   window.ThornhavenPlayPurchases.buy(id,ensurePurchaseProfile());return show(result('requested','Checkout requested. Your item is delivered only after Google Play confirms payment.'));}
   catch{return show(result('error','Checkout could not start. Your character must be saved before payment. Use Restore purchases to retry.'));}
  },
  restorePurchases:async()=>{
   if(!window.ThornhavenPlayPurchases)return show(result('unavailable','Restore purchases requires the Android Play release.'));
   try{window.ThornhavenPlayPurchases.restore();pollPlayStore();return show(result('requested','Checking Google Play for purchases and available items.'));}
   catch{return show(result('error','Could not contact Google Play. Check your connection and try again.'));}
  }
 });
 window.EmberfallMonetization=api;
 window.ThornhavenMonetization=api;
 buyPlayProduct=id=>api.purchase(id);
 document.getElementById('restorePurchasesButton').onclick=()=>api.restorePurchases();
})();

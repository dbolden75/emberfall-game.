/* The Android billing bridge is authoritative; a preview is never ownership. */
(()=>{
 const retiredSaleIds=new Set(["thornhaven_xp_boost_25_15m","thornhaven_levels_1","thornhaven_levels_5","thornhaven_levels_10"]);
 function result(status,message){return {status,message};}
 function show(value){document.getElementById('premiumSummary').textContent=value.message;return value;}
 const api=Object.freeze({
  mode:window.ThornhavenPlayPurchases?'google-play':'preview',
  getCatalog:()=>JSON.parse(JSON.stringify(PREMIUM_PRODUCTS.filter(p=>!retiredSaleIds.has(p.id)))),
  purchase:async id=>{
   if(retiredSaleIds.has(id))return show(result('unavailable','XP and level packs are retired. Previous purchases can still be restored.'));
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
 // The Android menu opens genuine Google Play checkout; web builds remain previews.
 const shopEntry=document.getElementById('premiumShopButton');
 if(shopEntry)shopEntry.textContent=api.mode==='google-play'?'PREMIUM SHOP · GOOGLE PLAY':'PREMIUM SHOP · PREVIEW';
 buyPlayProduct=id=>api.purchase(id);
 document.getElementById('restorePurchasesButton').onclick=()=>api.restorePurchases();
 // Keep old receipt SKU definitions for restore and previously paid credits,
 // but do not show off-sale products as new purchase options.
 const previousRenderPremiumShop=renderPremiumShop;
 renderPremiumShop=function(...args){
  if(premiumCategory==='xp'||premiumCategory==='levels')premiumCategory='all';
  previousRenderPremiumShop.apply(this,args);
  for(const tab of document.querySelectorAll('[data-premium-category]'))
   if(tab.dataset.premiumCategory==='xp'||tab.dataset.premiumCategory==='levels')tab.hidden=true;
  for(const button of document.querySelectorAll('[data-preview-product]')){
   const id=button.dataset.previewProduct;
   if(!retiredSaleIds.has(id))continue;
   const card=button.closest('.premiumCard');
   const savedXpCredit=id==='thornhaven_xp_boost_25_15m'&&(townQuestState._purchaseCredits?.xp||0)>0;
   if(!savedXpCredit){card?.remove();continue;}
   const price=card?.querySelector('.premiumPrice');
   if(price)price.textContent='Previously purchased credit · no new sales';
   for(const control of card?.querySelectorAll('button')||[])
    if(control!==button&&!control.textContent.startsWith('Activate saved boost')){
     control.disabled=true;control.textContent='No longer sold';
    }
  }
  const notice=document.querySelector('.premiumPreviewNotice');
  if(notice)notice.textContent='Only Google Play-listed cosmetics and builder contracts are offered. XP and level packs are retired; legitimate older purchases can still be restored. Previously purchased XP credits remain usable.';
 };
})();

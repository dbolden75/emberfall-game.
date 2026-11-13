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
   if(window.ThornhavenDamagedSlots?.())return show(result('unavailable','Damaged character saves are protected. Restore a verified backup before checkout.'));
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
 // TheDanCode is a level-only developer character. Do not allow the public
 // package to grant premium items without a Google Play purchase. Keep
 // historical _testPremium save fields intact for backward compatibility,
 // but never treat them as ownership or offer a free-grant action.
 purchaseOwned=function(id){
  const owned=Array.isArray(playStore.owned)?playStore.owned:[];
  return owned.includes(id)||owned.some(key=>premiumProduct(key)?.contains?.includes(id));
 };
 grantTestPremium=function(){return false;};
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
  for(const button of document.querySelectorAll('#premiumList .premiumCard button')){
   if(button.textContent.startsWith('Test grant'))button.remove();
  }
  if(danTesting())document.getElementById('premiumSummary').textContent=
   'DEVELOPER TEST CHARACTER · Level testing only. Free premium grants and real checkout are disabled. Use a normal character for purchases.';
  const notice=document.querySelector('.premiumPreviewNotice');
  if(notice)notice.textContent='Only Google Play-listed cosmetics and builder contracts are offered. XP and level packs are retired; legitimate older purchases can still be restored. Previously purchased XP credits remain usable.';
 };
})();

/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */
// Ordinary saves, not only purchases/exits, must detect silent WebView storage failures.
// This runs after the original saveGame() and preserves its historical save keys/format.
(() => {
 // Unit-test previews may load purchase-api.js without initializing the game.
 if(typeof saveGame!=='function')return;
 const saveWithoutReadback=saveGame;
 // Startup recovery preserves malformed character slots for the user's consent.
 // The game must not subsequently overwrite those bytes with a new character
 // or a Play purchase just because its in-memory slot map is empty.
 // The live inventory is stack-based. Corrupt counts, duplicate IDs, or
 // inherited Object property IDs can lose items during load/remove/save.
 // Older characters may omit the inventory field; explicit lists must be safe.
 function safeStoredInventory(items){
  if(!Array.isArray(items))return false;
  const seen=new Set();
  for(const item of items){
   if(!item||typeof item!=='object'||Array.isArray(item)||
      typeof item.id!=='string'||!item.id.trim()||
      Object.prototype.hasOwnProperty.call(Object.prototype,item.id)||
      !Number.isSafeInteger(item.count)||item.count<=0||seen.has(item.id))return false;
   seen.add(item.id);
  }
  return true;
 }
 function damagedAuthoritativeSlots(){
  let raw;
  try{raw=localStorage.getItem(SAVE_SLOTS_KEY)}catch(_){return true;}
  if(raw===null)return false;
  try{
   const slots=JSON.parse(raw);
   if(!slots||typeof slots!=='object'||Array.isArray(slots))return true;
   // A syntactically valid map can still contain a damaged hero. Never replace
   // that original slot (or another healthy hero alongside it) on a later save.
   return ['slot1','slot2','slot3','slot4'].some(id=>{
    if(!Object.prototype.hasOwnProperty.call(slots,id))return false;
    const record=slots[id];
    if(!record||typeof record!=='object'||Array.isArray(record))return true;
    // Historical saves may store the state directly, without a .state wrapper.
    const state=Object.prototype.hasOwnProperty.call(record,'state')?record.state:record;
    const hero=state&&typeof state==='object'&&!Array.isArray(state)?state.player:null;
    // Unknown classes are normalized to Warrior on load. Preserve their original
    // bytes instead of silently converting and overwriting a damaged character.
    return !hero||typeof hero!=='object'||Array.isArray(hero)||
     typeof hero.name!=='string'||!hero.name.trim()||
     typeof hero.class!=='string'||!['warrior','rogue','mage','cleric'].includes(hero.class)||
     // An explicit non-array inventory or malformed entry can crash the game
     // after Object.assign(player, save.player). Preserve the source bytes.
     (Object.prototype.hasOwnProperty.call(hero,'inventory')&&
      !safeStoredInventory(hero.inventory));
   });
  }catch(_){return true;}
 }
 if(typeof window!=='undefined')window.ThornhavenDamagedSlots=damagedAuthoritativeSlots;
 function warnDamagedSlots(){
  let warning=document.getElementById('saveFailureWarning');
  if(!warning){
   warning=document.createElement('div');warning.id='saveFailureWarning';
   warning.setAttribute('role','alert');
   warning.style.cssText='position:fixed;bottom:70px;left:10%;right:10%;z-index:9999;padding:12px;background:#5c2020;color:white';
   document.body.appendChild(warning);
  }
  warning.textContent='Damaged character saves detected. Saving and purchase delivery are blocked to protect the original data. Restore a verified backup before continuing; do not uninstall or clear app data.';
 }
 // The save menu writes slot storage directly, even when no character has
 // started and saveGame() is disabled. Guard that destructive path as well.
 const deleteWithoutGuard=typeof deleteSaveSlot==='function'?deleteSaveSlot:null;
 if(deleteWithoutGuard)deleteSaveSlot=function(...args){
  if(damagedAuthoritativeSlots()){warnDamagedSlots();return;}
  return deleteWithoutGuard(...args);
 };
 const purchaseWithoutGuard=typeof purchaseCommit==='function'?purchaseCommit:null;
 if(purchaseWithoutGuard)purchaseCommit=function(...args){
  if(damagedAuthoritativeSlots()){
   warnDamagedSlots();
   throw new Error('Damaged character slots: purchase delivery cannot overwrite existing data');
  }
  return purchaseWithoutGuard(...args);
 };
 saveGame=function(...args){
  if(!hasStarted||titleMenuActive||switchingCharacter)return saveWithoutReadback(...args);
  if(damagedAuthoritativeSlots()){warnDamagedSlots();return;}
  // snapshotGameState makes a plain JSON copy, the same serialization as saveGame.
  // Do not make a new failure mode for a damaged state snapshot: let the
  // original save routine handle it and display its usual error.
  let expected;
  try{expected=snapshotGameState()}catch(_){return saveWithoutReadback(...args)}
  const slot=activeSlotId,result=saveWithoutReadback(...args);
  try{
   const saved=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
   if(!saved||JSON.stringify(saved[slot]?.state)!==JSON.stringify(expected))
    throw new Error('Character save did not persist');
   document.getElementById('saveFailureWarning')?.remove();
  }catch(error){
   let warning=document.getElementById('saveFailureWarning');
   if(!warning){
    warning=document.createElement('div');warning.id='saveFailureWarning';
    warning.setAttribute('role','alert');
    warning.style.cssText='position:fixed;bottom:70px;left:10%;right:10%;z-index:9999;padding:12px;background:#5c2020;color:white';
    document.body.appendChild(warning);
   }
   warning.textContent='Progress could not be saved. Keep the game open. Free device storage and retry.';
   console.error('Thornhaven save verification failed:',error);
  }
  return result;
 };
})();
/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */

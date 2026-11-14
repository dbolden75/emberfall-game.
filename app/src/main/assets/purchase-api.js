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
      (item.id==='prototype'||Object.prototype.hasOwnProperty.call(Object.prototype,item.id))||
      !Number.isSafeInteger(item.count)||item.count<=0||seen.has(item.id))return false;
   seen.add(item.id);
  }
  return true;
 }
 // The game normalizes old house chests and gathering skills on load.
 // A malformed *present* chest or XP record must not be quietly replaced
 // by empty storage/zero XP on the next save or paid purchase delivery.
 // Historical saves legitimately omit these optional fields.
 function safeStoredHouseStorage(storage){
  if(!storage||typeof storage!=='object'||Array.isArray(storage))return false;
  const homes=['ashvale','brackenford','stonewatch','sunmere'];
  const chests=['front_chest','side_chest'];
  for(const id of homes){
   if(!Object.prototype.hasOwnProperty.call(storage,id))continue;
   const home=storage[id];
   if(!home||typeof home!=='object'||Array.isArray(home))return false;
   for(const chest of chests)
    if(Object.prototype.hasOwnProperty.call(home,chest)&&
       !safeStoredInventory(home[chest]))return false;
  }
  // Older Brackenford-only save formats stored the chests at the root.
  for(const chest of chests)
   if(Object.prototype.hasOwnProperty.call(storage,chest)&&
      !safeStoredInventory(storage[chest]))return false;
  return true;
 }
 function safeStoredGatheringSkills(skills){
  if(!skills||typeof skills!=='object'||Array.isArray(skills))return false;
  for(const id of ['mining','woodcutting','fishing']){
   if(!Object.prototype.hasOwnProperty.call(skills,id))continue;
   const row=skills[id];
   if(!row||typeof row!=='object'||Array.isArray(row))return false;
   if(!Object.prototype.hasOwnProperty.call(row,'xp'))continue;
   if(!Number.isSafeInteger(row.xp)||row.xp<0)return false;
  }
  return true;
 }
 // Forge ranks are earned by spending crowns and gathered materials. The
 // loader converts malformed ranks into zero or clamps them, so reject
 // malformed *present* data before a normal save can erase those upgrades.
 // Old characters may not have a gearUpgradeLevels field at all.
 function safeStoredGearUpgrades(upgrades){
  if(!upgrades||typeof upgrades!=='object'||Array.isArray(upgrades))return false;
  for(const rank of Object.values(upgrades))
   if(!Number.isSafeInteger(rank)||rank<0||rank>5)return false;
  return true;
 }
 // The loader projects town relics and owned houses onto only the four
 // regions this client knows. Newer-region flags, or a malformed present
 // value, would be silently replaced by that projection on the next save.
 // Historical characters may legitimately omit either optional object.
 function safeStoredTownRegionFlags(flags){
  if(!flags||typeof flags!=='object'||Array.isArray(flags))return false;
  const known=new Set(['ashvale','brackenford','stonewatch','sunmere']);
  return Object.entries(flags).every(([id,owned])=>
   known.has(id)&&typeof owned==='boolean');
 }
 // Local saves must protect purchased and quest companions just as Cloud Save
 // import does. normalizePets() silently drops unknown/duplicate pet IDs and
 // migrates unsupported pet versions, otherwise erasing pets or their gear.
 // Legacy saves legitimately omit companions; present lists must be lossless.
 function safeStoredCompanions(pets){
  if(!Array.isArray(pets))return false;
  const known=new Set(['dalen','sylvi','corin','eryn','ember_dragon']);
  const seen=new Set();
  const unsafeId=id=>id==='prototype'||Object.prototype.hasOwnProperty.call(Object.prototype,id);
  return pets.every(p=>{
   if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.id!=='string'||
      !known.has(p.id)||seen.has(p.id))return false;
   seen.add(p.id);
   if(p.petVersion!=null&&(!Number.isSafeInteger(p.petVersion)||
      (p.petVersion!==0&&p.petVersion!==1)))return false;
   const gearSlots=['weapon','armor','shield','earrings','necklace','legs','boots'];
   if(!gearSlots.every(slot=>
      p[slot]==null||(typeof p[slot]==='string'&&!unsafeId(p[slot]))))return false;
   // Legacy pet migration returns known gear to inventory and clears its slot.
   // Unknown items would be silently discarded instead; preserve the raw save.
   if(p.petVersion!==1&&gearSlots.some(slot=>
      p[slot]&&!Object.prototype.hasOwnProperty.call(itemDefs,p[slot])))return false;
   if(!['hp','max'].every(field=>p[field]===undefined||
      (typeof p[field]==='number'&&Number.isFinite(p[field])&&p[field]>=0)))return false;
   if(p.hp!=null&&p.max!=null&&p.hp>p.max)return false;
   if(!['x','y'].every(field=>p[field]===undefined||
      (typeof p[field]==='number'&&Number.isFinite(p[field])&&Math.abs(p[field])<=10000)))return false;
   if(!['faceX','faceY'].every(field=>p[field]===undefined||
      (typeof p[field]==='number'&&Number.isFinite(p[field])&&Math.abs(p[field])<=1)))return false;
   if(!['cool','skillCool','attack','castTime'].every(field=>p[field]===undefined||
      (typeof p[field]==='number'&&Number.isFinite(p[field])&&p[field]>=0)))return false;
   return p.active==null||typeof p.active==='boolean';
  });
 }
 // applySavedGame() restores map data only for regions known to this build.
 // Unknown future region keys would vanish from the next snapshot and normal save,
 // silently losing enemy, chest, or puzzle progress (including on paid delivery).
 // Existing saves may omit mapStates; tests without map fixtures are unaffected.
 function safeStoredMapStates(states){
  if(!states||typeof states!=='object'||Array.isArray(states))return false;
  if(typeof maps==='undefined')return true;
  return Object.keys(states).every(id=>{
   if(!Object.prototype.hasOwnProperty.call(maps,id))return false;
   const row=states[id],map=maps[id];
   if(!row||typeof row!=='object'||Array.isArray(row))return false;
   // applySavedGame() only restores current indexes, while the next snapshot
   // emits exactly the current region's enemies, runes, traps and nodes.
   // Newer-build extra entries or present malformed arrays would be discarded.
   for(const field of ['enemies','runes','traps','gatherNodes']){
    if(!Object.prototype.hasOwnProperty.call(row,field))continue;
    const entries=row[field];
    if(!Array.isArray(entries))return false;
    const current=Array.isArray(map[field])?map[field]:[];
    const knownCount=field==='enemies'?current.filter(e=>!e.catalogSummoned).length:current.length;
    if(entries.length>knownCount)return false;
   }
   // Newer versions can add rune steps or chest/treasure metadata without
   // increasing the arrays above. The loader coerces/clamps these fields,
   // and snapshotGameState() drops future members on the next save.
   if(Object.prototype.hasOwnProperty.call(row,'runeProgress')){
    const progress=row.runeProgress;
    const knownSteps=Array.isArray(map.runeSequence)?map.runeSequence.length:0;
    if(!Number.isSafeInteger(progress)||progress<0||progress>knownSteps)return false;
   }
   for(const [field,flag] of [['chest','open'],['treasure','opened']]){
    if(!Object.prototype.hasOwnProperty.call(row,field)||row[field]===null)continue;
    const stored=row[field];
    if(!map[field]||!stored||typeof stored!=='object'||Array.isArray(stored)||
       !Object.prototype.hasOwnProperty.call(stored,flag)||
       typeof stored[flag]!=='boolean'||
       Object.keys(stored).some(key=>key!==flag))return false;
   }
   return true;
  });
 }
 // applySavedGame() also ignores a saved active mapId that this build does not
 // know. A later ordinary save or paid delivery would replace that region ID
 // with the old client's default location. Do not erase newer-world progress.
 function safeStoredActiveMapId(state){
  if(!Object.prototype.hasOwnProperty.call(state,'mapId'))return true; // Legacy saves.
  const id=state.mapId;
  if(typeof id!=='string'||!id.trim())return false;
  return typeof maps==='undefined'||Object.prototype.hasOwnProperty.call(maps,id);
 }
 function safeSavedState(state){
  return !!(state&&typeof state==='object'&&!Array.isArray(state)&&
   safeSavedHero(state.player)&&safeStoredActiveMapId(state)&&
   (!Object.prototype.hasOwnProperty.call(state,'townRelicState')||
     safeStoredTownRegionFlags(state.townRelicState))&&
   (!Object.prototype.hasOwnProperty.call(state,'ownedHomes')||
     safeStoredTownRegionFlags(state.ownedHomes))&&
   (!Object.prototype.hasOwnProperty.call(state,'mapStates')||
     safeStoredMapStates(state.mapStates))&&
   (!Object.prototype.hasOwnProperty.call(state,'companions')||
     safeStoredCompanions(state.companions))&&
   (!Object.prototype.hasOwnProperty.call(state,'gearUpgradeLevels')||
     safeStoredGearUpgrades(state.gearUpgradeLevels))&&
   (!Object.prototype.hasOwnProperty.call(state,'houseStorage')||
     safeStoredHouseStorage(state.houseStorage))&&
   (!Object.prototype.hasOwnProperty.call(state,'gatheringSkills')||
     safeStoredGatheringSkills(state.gatheringSkills)));
 }
 // Local WebView saves need the same lossless vital checks as Cloud Save.
 // applySavedGame() coerces bad HP/speed and teleports non-finite positions;
 // a later normal save would otherwise replace the original damaged bytes.
 // Omitted vitals are allowed for older characters, but explicit null is not.
 function safeStoredVitals(hero){
  for(const key of ['hp','max','speed','x','y']){
   if(!Object.prototype.hasOwnProperty.call(hero,key))continue;
   const value=hero[key];
   if(typeof value!=='number'||!Number.isFinite(value))return false;
   if((key==='max'||key==='speed')&&value<=0)return false;
   if(key==='speed'&&value>2000)return false;
   if(key==='hp'&&value<0)return false;
   if((key==='x'||key==='y')&&Math.abs(value)>10000)return false;
  }
  if(typeof hero.hp==='number'&&typeof hero.max==='number'&&hero.hp>hero.max)return false;
  return true;
 }
 // Loading a malformed level, XP or coin total can coerce the value during
 // combat/quest arithmetic (or concatenate string coins on rewards). A later
 // save would then overwrite the original bytes. Accept omitted legacy fields,
 // but never reinterpret explicit null, strings, negatives or unsafe totals.
 function safeStoredProgress(hero){
  for(const key of ['level','xp','coins']){
   if(!Object.prototype.hasOwnProperty.call(hero,key))continue;
   const value=hero[key];
   if(typeof value!=='number'||!Number.isFinite(value)||value<0||
      value>Number.MAX_SAFE_INTEGER)return false;
   if(key==='level'&&(!Number.isSafeInteger(value)||value<1))return false;
  }
  return true;
 }
 // On startup the game clears equipped items that are missing, incompatible,
 // or not allowed in their saved slot. Stop the next save or purchase from
 // silently replacing the original item ID with null. Old saves can omit slots.
 function safeStoredHeroGear(hero){
  for(const slot of ['weapon','armor','shield','earrings','necklace','legs','boots']){
   if(!Object.prototype.hasOwnProperty.call(hero,slot))continue;
   const id=hero[slot];
   if(id==null||id==='')continue;
   if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(itemDefs,id)||
      itemDefs[id]?.slot!==slot||!gearRequirements(id,hero))return false;
  }
  return true;
 }
 function safeSavedHero(hero){
  return !!(hero&&typeof hero==='object'&&!Array.isArray(hero)&&
   typeof hero.name==='string'&&hero.name.trim()&&
   typeof hero.class==='string'&&['warrior','rogue','mage','cleric'].includes(hero.class)&&
   safeStoredVitals(hero)&&safeStoredProgress(hero)&&safeStoredHeroGear(hero)&&
   (!Object.prototype.hasOwnProperty.call(hero,'inventory')||safeStoredInventory(hero.inventory)));
 }
 function damagedAuthoritativeSlots(){
  let raw;
  try{raw=localStorage.getItem(SAVE_SLOTS_KEY)}catch(_){return true;}
  if(raw===null){
   // Older installs can have only the legacy single-character save. A malformed
   // legacy document must not be replaced by the next new-game save or purchase.
   // A present slot store is authoritative; stale legacy mirrors are ignored.
   let rawLegacy;
   try{rawLegacy=localStorage.getItem(SAVE_KEY)}catch(_){return true;}
   if(rawLegacy===null)return false; // Genuine first installation.
   try{
    const legacy=JSON.parse(rawLegacy);
    return !legacy||typeof legacy!=='object'||Array.isArray(legacy)||
     !safeSavedState(legacy);
   }catch(_){return true;}
  }
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
    // Unknown classes are normalized to Warrior on load. Preserve their original
    // bytes instead of silently converting and overwriting a damaged character.
    return !safeSavedState(state);
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
 // Stored bytes can be healthy even when live game state becomes invalid.
 // Never replace a valid character with a normalized null or invalid progress,
 // including when a confirmed purchase is about to be acknowledged.
 function warnInvalidLiveState(){
  warnDamagedSlots();
  document.getElementById('saveFailureWarning').textContent=
   'Invalid current character data detected. Existing saves are protected. Saving and purchase delivery are blocked. Do not uninstall or clear app data; restore a verified backup.';
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
  if(args.length && !safeSavedState(args[0])){
   warnInvalidLiveState();
   throw new Error('Invalid purchase delivery state: existing character save preserved');
  }
  return purchaseWithoutGuard(...args);
 };
 saveGame=function(...args){
  if(!hasStarted||titleMenuActive||switchingCharacter)return saveWithoutReadback(...args);
  if(damagedAuthoritativeSlots()){warnDamagedSlots();return;}
  // snapshotGameState makes a plain JSON copy, the same serialization as saveGame.
  // Never retry a snapshot failure through the unguarded save routine.
  // If the first snapshot throws transiently and the second returns invalid
  // data, that fallback could silently replace a previously healthy save.
  // Keep existing bytes untouched and let the player retry after recovery.
  let expected;
  try{expected=snapshotGameState()}catch(error){
   warnInvalidLiveState();
   document.getElementById('saveFailureWarning').textContent=
    'Current character snapshot could not be verified. Existing saves are protected; saving is blocked. Keep the game open and retry. Do not uninstall or clear app data.';
   console.error('Thornhaven snapshot validation failed:',error);
   return;
  }
  if(!safeSavedState(expected)){
   warnInvalidLiveState();
   return;
  }
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

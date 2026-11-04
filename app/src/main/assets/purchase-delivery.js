/* Pure delivery reducer. Caller must commit this state before acknowledging delivery. */
(function(root){
function reward(state,receipt,products){
 const product=products.find(p=>p.id===receipt.product);
 if(!product||!receipt.id||!/^[a-f0-9]{64}$/.test(receipt.id))throw Error('Invalid purchase');
 const next=JSON.parse(JSON.stringify(state)),q=next.townQuestState||(next.townQuestState={});
 // A truthy malformed quest state (string, number, array) silently swallows
 // receipt/ownership writes in non-strict JavaScript. Never acknowledge a
 // payment whose durable ledger cannot be saved to the character.
 if(!q||typeof q!=='object'||Array.isArray(q))throw Error('Invalid town quest state');
 if(product.productType==='consumable'&&(!q._purchaseProfile||receipt.profile!==q._purchaseProfile))throw Error('Purchase belongs to another character');
 // Never acknowledge a paid receipt against a malformed ledger: duplicate
 // callbacks could otherwise re-grant the same consumable indefinitely.
 const ledger=q._playReceipts==null?(q._playReceipts={}):q._playReceipts;
 if(typeof ledger!=='object'||Array.isArray(ledger))throw Error('Invalid purchase receipt ledger');
 // The presence of a receipt ID alone does not prove this particular item
 // was delivered: a damaged/migrated entry could otherwise suppress a real
 // reward while its native receipt is marked delivered and consumed.
 if(Object.prototype.hasOwnProperty.call(ledger,receipt.id)){
  if(ledger[receipt.id]!==product.id)throw Error('Conflicting purchase receipt ledger entry');
  // Durable styles can be restored idempotently. A damaged/legacy save may
  // retain the verified receipt but lose its separate cosmetic ownership flag.
  // Do not acknowledge this receipt again without repairing that flag.
  if(product.productType==='non_consumable'){
   const owned=q._paidStyles==null?(q._paidStyles={}):q._paidStyles;
   if(typeof owned!=='object'||Array.isArray(owned))throw Error('Invalid purchased style ledger');
   owned[product.id]=true;
  }
  // Credits and levels may have been used already. Never replay those grants.
  return next;
 }
 if(product.category==='levels'){
  if(![1,5,10].includes(product.levels)||!Number.isSafeInteger(next.player.level)||next.player.level<1||!Number.isSafeInteger(next.player.level+product.levels))throw Error('Invalid level grant');
  next.player.level+=product.levels;
 }else if(product.category==='xp'||product.category==='builder'){
  // Refuse a malformed or overflowing existing balance instead of recording
  // a paid receipt whose builder/XP credit was not actually added.
  const credits=q._purchaseCredits==null?(q._purchaseCredits={}):q._purchaseCredits;
  if(!credits||typeof credits!=='object'||Array.isArray(credits))throw Error('Invalid purchase credit ledger');
  const old=Object.prototype.hasOwnProperty.call(credits,product.category)?credits[product.category]:0;
  if(!Number.isSafeInteger(old)||old<0||old===Number.MAX_SAFE_INTEGER)throw Error('Invalid purchase credit balance');
  credits[product.category]=old+1;
 }else if(product.productType==='non_consumable'){
  const owned=q._paidStyles==null?(q._paidStyles={}):q._paidStyles;
  if(typeof owned!=='object'||Array.isArray(owned))throw Error('Invalid purchased style ledger');
  owned[product.id]=true;
 }else throw Error('Unsupported product');
 ledger[receipt.id]=product.id;
 return next;
}
if(typeof module!=='undefined')module.exports={reward};else root.ThornhavenPurchaseDelivery={reward};
})(typeof window!=='undefined'?window:this);

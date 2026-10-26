/* Pure delivery reducer. Caller must commit this state before acknowledging delivery. */
(function(root){
function reward(state,receipt,products){
 const product=products.find(p=>p.id===receipt.product);
 if(!product||!receipt.id||!/^[a-f0-9]{64}$/.test(receipt.id))throw Error('Invalid purchase');
 const next=JSON.parse(JSON.stringify(state)),q=next.townQuestState||(next.townQuestState={});
 if(product.productType==='consumable'&&(!q._purchaseProfile||receipt.profile!==q._purchaseProfile))throw Error('Purchase belongs to another character');
 const ledger=q._playReceipts||(q._playReceipts={});
 if(ledger[receipt.id])return next;
 if(product.category==='levels'){
  if(![1,5,10].includes(product.levels)||!Number.isSafeInteger(next.player.level)||next.player.level<1||!Number.isSafeInteger(next.player.level+product.levels))throw Error('Invalid level grant');
  next.player.level+=product.levels;
 }else if(product.category==='xp'||product.category==='builder'){
  const credits=q._purchaseCredits||(q._purchaseCredits={});
  credits[product.category]=(credits[product.category]||0)+1;
 }else if(product.productType==='non_consumable'){
  const owned=q._paidStyles||(q._paidStyles={});owned[product.id]=true;
 }else throw Error('Unsupported product');
 ledger[receipt.id]=product.id;
 return next;
}
if(typeof module!=='undefined')module.exports={reward};else root.ThornhavenPurchaseDelivery={reward};
})(typeof window!=='undefined'?window:this);

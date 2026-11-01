/* Pure delivery reducer. Caller must commit this state before acknowledging delivery. */
(function(root){
function reward(state,receipt,products){
 const product=products.find(p=>p.id===receipt.product);
 if(!product||!receipt.id||!/^[a-f0-9]{64}$/.test(receipt.id))throw Error('Invalid purchase');
 const next=JSON.parse(JSON.stringify(state)),q=next.townQuestState||(next.townQuestState={});
 if(product.productType==='consumable'&&(!q._purchaseProfile||receipt.profile!==q._purchaseProfile))throw Error('Purchase belongs to another character');
 const ledger=q._playReceipts||(q._playReceipts={});
 if(ledger[receipt.id])return next;
 if(product.category==='crowns'){
  if(!Number.isSafeInteger(product.crowns)||product.crowns<=0||!Number.isSafeInteger(next.player.coins)||next.player.coins<0||!Number.isSafeInteger(next.player.coins+product.crowns))throw Error('Invalid crown grant');
  next.player.coins+=product.crowns;
 }else if(product.category==='pet'){
  if(product.petId!=='ember_dragon')throw Error('Invalid pet grant');
  const pets=next.companions||(next.companions=[]);
  let pet=pets.find(p=>p.id===product.petId);
  if(!pet){
   const level=Math.max(1,Math.floor(next.player.level/2)),max=product.petHealth+(level-1)*7;
   pet={id:product.petId,petId:product.petId,petVersion:1,name:'Sol',class:product.petClass,gender:'male',level,xp:0,hp:max,max,active:false,cool:0,skillCool:0,attack:0,x:next.player.x,y:next.player.y,faceX:1,faceY:0};pets.push(pet);
  }
  pet.purchasedWithRealMoney=true;
 }else if(product.category==='levels'){
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

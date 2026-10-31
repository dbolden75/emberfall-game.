// Guard Play Billing 9's eligible one-time offer selection.
 // This is static coverage; Android CI separately compiles the BillingClient API.
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const start=src.indexOf('private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p)');
const end=src.indexOf('private void publish()',start);
assert(start>=0&&end>start,'Native Billing offer selector missing');
const fn=src.slice(start,end);
for(const expression of [
 'p.getOneTimePurchaseOfferDetailsList()',
 'o.getRentalDetails()!=null',
 'o.getPreorderDetails()!=null',
 'if(o.getOfferId()==null)return o',
 'if(eligibleOffer==null)eligibleOffer=o',
 'return eligibleOffer'
])assert(fn.includes(expression),'Purchase-offer selection is missing: '+expression);
assert(src.includes('ProductDetails.OneTimePurchaseOfferDetails o=offer(p);'),
       'The Google Play catalog and checkout must use the same eligibility selector');
assert(src.includes('.setOfferToken(o.getOfferToken())'),
       'Checkout must use the token for the displayed eligible offer');
console.log('PASS (static): Play Billing prefers non-rental standard buy options, falls back to eligible non-rental/non-preorder offers, and uses the selected offer token. Live Play eligibility not tested.');

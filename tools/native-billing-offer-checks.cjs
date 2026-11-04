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
// Regression guard for "nothing available to buy": failed product and owned-
// purchase queries must be diagnosed separately from a genuinely empty catalog.
// These checks enforce callback branches; Android CI compiles the Java code.
const beginRefresh=src.indexOf('private void refresh()');
const endRefresh=src.indexOf('private static String hash(',beginRefresh);
assert(beginRefresh>=0&&endRefresh>beginRefresh,'Play Billing refresh method not found');
const refresh=src.slice(beginRefresh,endRefresh);
assert(refresh.includes('if(status.getResponseCode()==BillingClient.BillingResponseCode.OK){'),
       'Do not classify a Play product query error as a valid empty catalog');
for(const text of [
 'Google Play returned no available products for this account.',
 'Google Play could not load prices (code ',
 'Google Play could not restore purchases (code ',
 'Leave cached verified receipts untouched',
])assert(refresh.includes(text),'Missing billing diagnostic or safe restore path: '+text);
const restoreGuard=refresh.indexOf('if(status.getResponseCode()!=BillingClient.BillingResponseCode.OK||purchases==null)');
const reconciliation=refresh.indexOf('Set<String> active=new HashSet<>()');
assert(restoreGuard>=0 && reconciliation>restoreGuard &&
       refresh.slice(restoreGuard,reconciliation).includes('return;'),
       'Failed or null Play restore results must never process ownership revocations');
assert(refresh.includes('Existing purchases are preserved; tap Restore purchases to retry.'),
       'Null purchases must be reported as an incomplete restore, not as an empty ownership list');
console.log('PASS (static): Play Billing prefers non-rental standard buy options, falls back to eligible non-rental/non-preorder offers, and uses the selected offer token. Live Play eligibility not tested.');
console.log('PASS (static): price-query errors, zero active SKUs, and restore errors have distinct messaging without revoking saved receipts on failed queries.');

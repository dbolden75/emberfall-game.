// Static native purchase-ledger safety gates. Full Java compilation and
// simulated JavaScript purchase delivery run separately in Android CI.
// These assertions do NOT emulate Google Play or verify a live purchase.
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
function body(from,to){
 const i=src.indexOf(from),j=src.indexOf(to,i+from.length);
 assert(i>=0&&j>i,'Missing guarded native billing method: '+from);
 return src.slice(i,j);
}
const verify=body('private boolean trustworthySavedReceipt(JSONObject record, Purchase current)','private boolean trustworthySavedReceipt(JSONObject record){');
for(const must of [
 'valid(saved)',
 'current.getPurchaseToken().equals(saved.getPurchaseToken())',
 'product.equals(saved.getProducts().get(0))',
 'hash(current.getPurchaseToken()).equals(record.optString("id"))',
 'current.getPurchaseToken().equals(record.optString("token"))',
 'product.equals(record.optString("product"))',
 'profile.equals(record.optString("profile"))',
 'profile.equals(savedProfile)'
])assert(verify.includes(must),'Stored receipt missing identity guard: '+must);
const accept=body('private void accept(Purchase p){','private boolean persist(){');
assert(accept.includes('if(!trustworthySavedReceipt(existing,p)){'));
assert(accept.includes('.put("delivered",false).put("finished",false)'),
       'Rebuilt receipts must not inherit stale paid-item acknowledgements');
assert(accept.includes('existing.put("json",p.getOriginalJson()).put("signature",p.getSignature())'),
       'Reverified receipts must refresh signed purchase data');
assert(accept.includes('if(!persist()){receipts=previous;'),
       'Failure to save receipt must roll back full ledger');
const published=body('private void publish(){','@JavascriptInterface public String state()');
assert(published.includes('!r.optString("token").equals(original.getPurchaseToken())'),
       'A tampered token field may not reach the game');
const delivered=body('@JavascriptInterface public void delivered(String id)','private void retryFinishing()');
assert(delivered.includes('!trustworthySavedReceipt(r)'),
       'Game delivery callback must verify native receipt metadata');
const finish=body('private void retryFinishing()','private void finish(JSONObject r)');
assert(finish.includes('trustworthySavedReceipt(r)'),
       'Restored receipts must not finish corrupted purchase tokens');
// A lost BillingClient connection can discard consume/ack callbacks. Clear
// the in-flight token set and reject callbacks from that ended Play session,
// otherwise Restore permanently skips an otherwise valid receipt.
const connection=body('void connect(){','private void refresh(){');
const disconnected=connection.slice(connection.indexOf('public void onBillingServiceDisconnected()'));
for(const guard of ['billingSessionEpoch++','finishing.clear()','busy=false','catalog.clear()'])
  assert(disconnected.includes(guard),'Disconnect must recover: '+guard);
const finishMethod=body('private void finish(JSONObject r)','private void complete(JSONObject r');
assert(finishMethod.includes('final int finishSession=billingSessionEpoch;'),
       'Finish requests must capture the Play session identity');
assert.equal(finishMethod.split('complete(r,result,finishSession)').length-1,2,
       'Consumption and acknowledgement callbacks must preserve their session identity');
const completeMethod=body('private void complete(JSONObject r','void close(){');
assert(completeMethod.indexOf('if(closed||finishSession!=billingSessionEpoch)return;')>=0,
       'End-of-session responses must not persist stale receipts');
assert(completeMethod.indexOf('if(closed||finishSession!=billingSessionEpoch)return;')
       < completeMethod.indexOf('finishing.remove('),
       'Reject stale finish callbacks before changing the current session token set');
const purchasesUpdated=body('@Override public void onPurchasesUpdated','@JavascriptInterface public void delivered');
assert(purchasesUpdated.includes('if(closed)return;'),
       'Purchase callbacks may not mutate the ledger after Activity teardown');
const deliveredGuard=body('@JavascriptInterface public void delivered','private void retryFinishing()');
assert(deliveredGuard.includes('if(closed)return;'),
       'Delayed JavaScript delivery callbacks must not persist after teardown');
const shutdown=src.slice(src.indexOf('void close(){'));
assert(shutdown.includes('billingSessionEpoch++')&&shutdown.includes('finishing.clear()'),
       'Closing BillingClient must invalidate unfinished requests');
console.log('PASS (static): stale consume/ack callbacks are isolated by Play session; disconnect clears blocked finishing and checkout, teardown suppresses late callbacks.');

console.log('PASS (static): corrupted Play receipt identity cannot inherit delivery/finish state or bypass native acknowledgement guards; Android CI compiles Java and runs purchase simulations separately.');

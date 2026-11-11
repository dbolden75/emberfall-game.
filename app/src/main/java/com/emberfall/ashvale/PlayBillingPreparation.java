package com.emberfall.ashvale;

import android.app.Activity;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import com.android.billingclient.api.*;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import org.json.*;

/** Client-only Play Billing for this offline game. Never trusts preview/UI ownership. */
final class PlayBillingPreparation implements PurchasesUpdatedListener {
    private static final String PUBLIC_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtdx3DqRc7RNNs/qsOnPSrSSy7MEW1dAIfBu78KLdMpAkOOQ2G/aNfpOf4AHkvzHpyq+FVRWsZqejqA62A59SkBpz0IyQBnSgdKq6S1f9sHD97+E33ovzWiykkp1Iy+j9UboiSjLBtVnvrt+30J59jDPYkdUFkMI3Xtyl/P2zHZxJHijQn0x1pCabxa2foD3POJ0uqXL35sl1FIpsywatFOmrKPz5UhYk3ES6+U4d4gJS/CfB52mIMEnBVzBXDNcQMpl/UnoneG5VjE0bEDG5OT0YAfIXwJK5GCFaYL45vJO083ZuLKnXeNMkqAhl089L+8Jc4khi5ZK9MxObfeO8SQIDAQAB";
    static final String[] PRODUCT_IDS={"emberfall_aura_embers","emberfall_aura_frost","emberfall_aura_arcane","emberfall_trail_embers","emberfall_trail_stars","emberfall_trail_leaves","emberfall_title_emberborn","emberfall_title_wayfarer","emberfall_title_champion","emberfall_bundle_founder","thornhaven_xp_boost_25_15m","thornhaven_builder_contract_25_15m","thornhaven_levels_1","thornhaven_levels_5","thornhaven_levels_10"};
    // Legacy entitlements remain valid for Play restore and completion, but these
    // progression purchases are retired and must never open a new checkout.
    private static final Set<String> RETIRED_SALE_IDS=Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "thornhaven_xp_boost_25_15m", "thornhaven_levels_1", "thornhaven_levels_5", "thornhaven_levels_10")));
    private final Activity activity;
    private final BillingClient client;
    private final SharedPreferences prefs;
    private final Map<String,ProductDetails> catalog=new HashMap<>();
    private final Set<String> finishing=new HashSet<>();
    private JSONObject receipts;
    private volatile String snapshot="{}";
    private String message="Connecting to Google Play…";
    private boolean closed, busy, connecting;
    // Ignore results from earlier Play sessions after a disconnect or a newer refresh.
    private int refreshEpoch;
    // Unlike refreshEpoch, this changes only when a Play connection is lost
    // or the activity is destroyed. A finishing response must belong to
    // the same billing session that started the request.
    private int billingSessionEpoch;
    // A new verified receipt can arrive while an earlier asynchronous Play
    // ownership query is in flight. Never let that stale query revoke it.
    private int acceptedReceiptEpoch;
    private static boolean consumable(String id){return id.startsWith("thornhaven_");}
    PlayBillingPreparation(Activity activity){
        this.activity=activity; prefs=activity.getSharedPreferences("verified_play_purchases",0);
        try{receipts=new JSONObject(prefs.getString("receipts","{}"));}catch(Exception e){receipts=new JSONObject();}
        client=BillingClient.newBuilder(activity).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
        publish();
    }
    void connect(){
        if(closed||connecting)return;
        if(client.isReady()){refresh();return;}
        connecting=true;
        try{
            client.startConnection(new BillingClientStateListener(){
                public void onBillingSetupFinished(BillingResult result){activity.runOnUiThread(()->{
                    if(closed)return;
                    connecting=false;
                    if(result!=null&&result.getResponseCode()==BillingClient.BillingResponseCode.OK)refresh();
                    else {message="Google Play purchases are unavailable. Install the Play test release and retry.";publish();}
                });}
                public void onBillingServiceDisconnected(){activity.runOnUiThread(()->{if(closed)return;refreshEpoch++;billingSessionEpoch++;connecting=false;busy=false;finishing.clear();catalog.clear();message="Google Play disconnected. Tap Restore purchases to retry.";publish();});}
            });
        }catch(RuntimeException unavailable){
            // A Play service/BillingClient startup failure must not prevent the
            // offline game from launching or permanently block Restore retries.
            connecting=false;
            message="Google Play purchases could not start. Game play remains available. Tap Restore purchases to retry.";
            publish();
        }
    }
    private void invalidateCatalogForRefresh(){
        catalog.clear();
        message="Refreshing Google Play prices and purchase options. Checkout is temporarily unavailable.";
        publish(); // Keep verified ownership and deliveries visible, but hide stale offers.
    }
    private void refresh(){
        if(closed||!client.isReady())return;
        final int epoch=++refreshEpoch;
        // Previous prices and tokens may belong to an earlier Play session or account.
        // Invalidate them before starting any asynchronous query; a Restore tap
        // must never leave stale checkout choices visible while Play responds.
        invalidateCatalogForRefresh();
        List<QueryProductDetailsParams.Product> products=new ArrayList<>();
        for(String id:PRODUCT_IDS)if(!RETIRED_SALE_IDS.contains(id))products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        // Play may disconnect after isReady() and before this query is dispatched.
        // An exception must not crash the game or suppress a restore attempt.
        try{
            client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(),(status,result)->activity.runOnUiThread(()->{
            if(closed||!client.isReady()||epoch!=refreshEpoch)return;
            catalog.clear();
            if(status!=null&&status.getResponseCode()==BillingClient.BillingResponseCode.OK){
                // Play can report OK while supplying an incomplete catalog. A
                // null result is NOT a verified empty product list: never
                // dereference it or imply that Play has no active products.
                List<ProductDetails> details=result==null?null:result.getProductDetailsList();
                if(details==null){
                    message="Google Play returned an incomplete product catalog. No item prices are verified. Tap Restore purchases to retry.";
                }else{
                    // Only show registered, currently-for-sale products. An unexpected
                    // Play SDK response must never expose checkout for an unknown or
                    // retired SKU that valid(Purchase) cannot safely deliver.
                    for(ProductDetails p:details){
                        if(p==null)continue;
                        String id=p.getProductId();
                        if(id!=null && Arrays.asList(PRODUCT_IDS).contains(id)
                                && !RETIRED_SALE_IDS.contains(id))catalog.put(id,p);
                    }
                    String missingDetails=unfetchedProductStatus(result);
                    message=catalog.isEmpty()
                        ?"Google Play returned no available products for this account. Check Play Console product activation and tester access, then Restore purchases."+missingDetails
                        :"Google Play checkout ready. Prices are supplied by Google Play."+missingDetails;
                }
            }else{
                // An unavailable Play service is not the same as an empty product catalog.
                // Do not offer a stale price or imply that product activation alone fixes it.
                message=status==null
                    ?"Google Play returned no product-query status. No item prices are verified. Tap Restore purchases to retry."
                    :"Google Play could not load prices (code "+status.getResponseCode()+"). Check your connection and Play tester access, then Restore purchases.";
            }
            publish();
            }));
        }catch(RuntimeException queryFailed){
            // No price was verified. Old catalog prices cannot be used for checkout.
            if(!closed && epoch==refreshEpoch){
                catalog.clear();
                message="Google Play could not request item prices. Game play remains available; tap Restore purchases to retry.";
                publish();
            }
        }
        final int receiptsAtQuery=acceptedReceiptEpoch;
        try{
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(status,purchases)->activity.runOnUiThread(()->{
            if(closed||!client.isReady()||epoch!=refreshEpoch)return;
            if(status==null||status.getResponseCode()!=BillingClient.BillingResponseCode.OK||purchases==null){
                // Leave cached verified receipts untouched when the Play query fails.
                // Even an OK status is unusable if Play supplies no list object.
                // A null list is not an empty verified ownership list: treating
                // it as empty would revoke every permanent entitlement.
                message=status==null
                    ?"Google Play returned no purchase-restore status. Existing purchases are preserved; tap Restore purchases to retry."
                    :purchases==null && status.getResponseCode()==BillingClient.BillingResponseCode.OK
                    ?"Google Play returned an incomplete purchase restore. Existing purchases are preserved; tap Restore purchases to retry."
                    :"Google Play could not restore purchases (code "+status.getResponseCode()+"). Retry Restore purchases when Google Play is available.";
                publish();
                return;
            }
            // A purchase callback may have committed a receipt after this
            // query was dispatched but before its possibly older result arrived.
            final boolean staleOwnership=receiptsAtQuery!=acceptedReceiptEpoch;
            Set<String> active=new HashSet<>();
            boolean incomplete=false;
            for(Purchase p:purchases){
                if(p==null){incomplete=true;continue;}
                if(valid(p))active.add(hash(p.getPurchaseToken()));
                else {
                    // A malformed/invalid Play row cannot prove any previously
                    // verified permanent purchase was revoked. Do not grant
                    // this row, and defer revocation until a clean restore.
                    incomplete=true;
                }
                accept(p); // Pending purchases are reported, not delivered.
            }
            if(incomplete){
                // An incomplete Play list is not authoritative proof that an
                // existing non-consumable purchase was revoked. Process any
                // present receipts but leave old ownership untouched until a
                // complete successful query allows reconciliation.
                message="Google Play returned an incomplete purchase list. Existing purchases were preserved; tap Restore purchases to retry.";
                publish();retryFinishing();return;
            }
            if(staleOwnership){
                // The query cannot prove that a freshly purchased title or
                // cosmetic was revoked. Keep verified receipts active until a
                // new Restore purchases query observes the latest Play state.
                message="A newer purchase arrived during restoration. Existing ownership was preserved; tap Restore purchases to verify.";
                publish();retryFinishing();return;
            }
            // Apply a successful Play ownership query atomically. A failed
            // SharedPreferences commit must not revoke a saved entitlement
            // only in memory while its previous receipt remains on disk.
            reconcileActiveOwnedPurchases(active); publish(); retryFinishing();
            }));
        }catch(RuntimeException queryFailed){
            // A dispatch failure cannot establish that ownership was revoked.
            if(!closed && epoch==refreshEpoch){
                message="Google Play could not request purchase restoration. Existing purchases are preserved; tap Restore purchases to retry.";
                publish();
            }
        }
    }
    // Only a successful Play query may revoke ownership. Keep the original
    // in-memory flags if persistent storage refuses the new state, so a
    // temporary full disk does not hide previously verified purchased titles.
    private void reconcileActiveOwnedPurchases(Set<String> active){
        Map<String,Boolean> previous=new HashMap<>();
        try{
            Iterator<String> keys=receipts.keys();
            while(keys.hasNext()){
                String key=keys.next();
                JSONObject r=receipts.optJSONObject(key);
                if(r==null||consumable(r.optString("product")))continue;
                previous.put(key,r.optBoolean("active"));
                r.put("active",active.contains(r.optString("id")));
            }
            if(persist())return;
        }catch(Exception ignored){}
        for(Map.Entry<String,Boolean> entry:previous.entrySet()){
            JSONObject r=receipts.optJSONObject(entry.getKey());
            if(r!=null)try{r.put("active",entry.getValue());}catch(Exception ignored){}
        }
        message="Restored purchase ownership could not be saved. Free device storage, then tap Restore purchases.";
    }
    // Billing 9 reports why individual products cannot be fetched, even when
    // the overall query succeeds. Aggregate reasons help testers distinguish
    // missing Play SKUs from offers their account cannot buy.
    // No account IDs, tokens or purchase data are included.
    private static String unfetchedProductStatus(QueryProductDetailsResult result){
        if(result==null)return "";
        List<UnfetchedProduct> rows=result.getUnfetchedProductList();
        if(rows==null)return "";
        int missing=0,notFound=0,noOffer=0,other=0;
        for(UnfetchedProduct row:rows){
            if(row==null)continue;
            missing++;
            if(row.getStatusCode()==UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND)notFound++;
            else if(row.getStatusCode()==UnfetchedProduct.StatusCode.NO_ELIGIBLE_OFFER)noOffer++;
            else other++;
        }
        if(missing==0)return "";
        return " "+missing+" Play item(s) unavailable: "+notFound+" not found, "+noOffer+" with no eligible offer, "+other+" other. Check Play Console products and tester eligibility.";
    }
    private static String hash(String value){try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}catch(Exception e){throw new IllegalStateException(e);}}
    private boolean valid(Purchase p){
        try{return p.getPurchaseState()==Purchase.PurchaseState.PURCHASED&&p.getQuantity()==1&&p.getProducts().size()==1&&Arrays.asList(PRODUCT_IDS).contains(p.getProducts().get(0))&&activity.getPackageName().equals(p.getPackageName())&&!p.getPurchaseToken().isEmpty()&&BillingSignature.verify(Base64.decode(PUBLIC_KEY,Base64.DEFAULT),p.getOriginalJson(),Base64.decode(p.getSignature(),Base64.DEFAULT));}catch(Exception e){return false;}
    }
    // A stored receipt is reusable only when its saved token, product and
    // signed purchase still agree with the newly verified Play purchase.
    // Otherwise rebuild it as undelivered instead of retaining a corrupt
    // 'delivered' / 'finished' marker that could suppress a paid item.
    private boolean trustworthySavedReceipt(JSONObject record, Purchase current){
        if(record==null)return false;
        try{
            Purchase saved=new Purchase(record.getString("json"),record.getString("signature"));
            String product=current.getProducts().get(0);
            String profile=current.getAccountIdentifiers()==null?"":current.getAccountIdentifiers().getObfuscatedProfileId();
            String savedProfile=saved.getAccountIdentifiers()==null?"":saved.getAccountIdentifiers().getObfuscatedProfileId();
            if(profile==null)profile="";
            if(savedProfile==null)savedProfile="";
            return valid(saved)
                && current.getPurchaseToken().equals(saved.getPurchaseToken())
                && product.equals(saved.getProducts().get(0))
                && hash(current.getPurchaseToken()).equals(record.optString("id"))
                && current.getPurchaseToken().equals(record.optString("token"))
                && product.equals(record.optString("product"))
                && profile.equals(record.optString("profile"))
                && (!consumable(product)||profile.equals(savedProfile));
        }catch(Exception invalidStoredReceipt){return false;}
    }
    private boolean trustworthySavedReceipt(JSONObject record){
        if(record==null)return false;
        try{return trustworthySavedReceipt(record,new Purchase(record.getString("json"),record.getString("signature")));}
        catch(Exception invalidStoredReceipt){return false;}
    }
    private void accept(Purchase p){
        if(p.getPurchaseState()==Purchase.PurchaseState.PENDING){message="Payment pending. Items will arrive only after Google confirms payment.";publish();return;}
        if(!valid(p)){message="Purchase could not be verified. No items were granted.";publish();return;}
        // Billing callbacks run on the UI thread. Roll back the entire in-memory
        // ledger if disk persistence fails, rather than exposing an uncommitted
        // entitlement or dropping an existing (possibly delivered) receipt.
        JSONObject previous=null;
        try{
            previous=new JSONObject(receipts.toString());
            String id=hash(p.getPurchaseToken()),product=p.getProducts().get(0);
            String profile=p.getAccountIdentifiers()==null?"":p.getAccountIdentifiers().getObfuscatedProfileId();
            if(consumable(product)&&(profile==null||!profile.matches("[a-f0-9]{64}"))){message="Purchase has no matching character. It has not been consumed or acknowledged.";publish();return;}
            if(profile==null)profile="";
            JSONObject existing=receipts.optJSONObject(id);
            boolean trusted=trustworthySavedReceipt(existing,p);
            // Every successfully committed verification is new evidence that can
            // invalidate a previously dispatched Play ownership query.
            if(!trusted){
                // A corrupt old record must never permanently hide a real Play
                // purchase. Character save receipt IDs still prevent replay.
                existing=new JSONObject().put("id",id).put("product",product).put("profile",profile).put("token",p.getPurchaseToken()).put("json",p.getOriginalJson()).put("signature",p.getSignature()).put("delivered",false).put("finished",false);
                receipts.put(id,existing);
            }else{
                // The stored identity is verified; retain durable delivery state.
                existing.put("json",p.getOriginalJson()).put("signature",p.getSignature());
            }
            existing.put("active",true);
            if(!consumable(product)&&p.isAcknowledged())existing.put("finished",true);
            if(!persist()){receipts=previous;message="Cannot save purchase receipt. Free device storage and restore purchases.";}
            else {
                // Even a previously active, already-delivered receipt must make
                // older in-flight ownership queries stale; otherwise a query
                // started before this verified callback could revoke the item.
                acceptedReceiptEpoch++;
                message="Verified purchase ready for delivery.";
            }
            publish();
        }catch(Exception e){
            if(previous!=null)receipts=previous;
            message="Could not store the purchase. Tap Restore purchases to retry.";publish();
        }
    }
    private boolean persist(){return prefs.edit().putString("receipts",receipts.toString()).commit();}
    private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p){
        if(p==null)return null;
        List<ProductDetails.OneTimePurchaseOfferDetails> offers=p.getOneTimePurchaseOfferDetailsList();
        if(offers==null){
            // Billing 9 returns a null multi-offer list for ordinary one-time
            // products. Fall back only in that case, and only to an immediate
            // purchase with a valid Play offer token.
            ProductDetails.OneTimePurchaseOfferDetails legacy=p.getOneTimePurchaseOfferDetails();
            if(legacy==null||legacy.getRentalDetails()!=null||legacy.getPreorderDetails()!=null)return null;
            String token=legacy.getOfferToken();
            return token==null||token.isEmpty()?null:legacy;
        }
        ProductDetails.OneTimePurchaseOfferDetails eligibleOffer=null;
        for(ProductDetails.OneTimePurchaseOfferDetails o:offers){
            // Null/malformed entries must never crash price publication or checkout.
            if(o==null||o.getRentalDetails()!=null||o.getPreorderDetails()!=null)continue;
            String token=o.getOfferToken();
            if(token==null||token.isEmpty())continue;
            // Prefer the regular buy purchase option, when available.
            if(o.getOfferId()==null)return o;
            // Fall back to an eligible offer with a specific offer ID.
            if(eligibleOffer==null)eligibleOffer=o;
        }
        return eligibleOffer;
    }
    private void publish(){
        try{
            JSONObject result=new JSONObject().put("message",message).put("busy",busy);
            JSONObject items=new JSONObject();
            for(ProductDetails p:catalog.values()){
                if(p==null)continue;
                try{
                    ProductDetails.OneTimePurchaseOfferDetails o=offer(p);
                    if(o==null)continue;
                    String price=o.getFormattedPrice();
                    String id=p.getProductId();
                    if(id!=null&&!id.isEmpty()&&price!=null&&!price.trim().isEmpty())
                        items.put(id,new JSONObject().put("price",price));
                }catch(Exception invalidPlayOffer){
                    // A malformed Play price/offer must not hide verified purchases
                    // or valid prices for unrelated items in the same snapshot.
                }
            }
            JSONArray deliveries=new JSONArray(),owned=new JSONArray();
            Iterator<String> keys=receipts.keys();
            while(keys.hasNext()){
                // One damaged old record must not hide unrelated verified purchases.
                // Always validate signature, package, token, product and profile
                // separately before including a receipt in the JS snapshot.
                JSONObject r=receipts.optJSONObject(keys.next());
                if(r==null)continue;
                try{
                    Purchase original=new Purchase(r.getString("json"),r.getString("signature"));
                    if(!valid(original)||!r.optBoolean("active")||!r.optString("id").equals(hash(original.getPurchaseToken()))||!r.optString("token").equals(original.getPurchaseToken())||!r.optString("product").equals(original.getProducts().get(0)))continue;
                    String signedProfile=original.getAccountIdentifiers()==null?"":original.getAccountIdentifiers().getObfuscatedProfileId();
                    if(consumable(r.optString("product"))&&!r.optString("profile").equals(signedProfile))continue;
                    String product=r.getString("product");
                    if(!consumable(product))owned.put(product);
                    if(!r.optBoolean("delivered"))deliveries.put(new JSONObject().put("id",r.getString("id")).put("product",product).put("profile",r.optString("profile")));
                }catch(Exception invalidReceipt){
                    // Leave the suspicious entry untouched for a later Play restore.
                    // Invalid data never grants rewards or blocks unrelated receipts.
                }
            }
            result.put("products",items).put("owned",owned).put("deliveries",deliveries);snapshot=result.toString();
        }catch(Exception e){snapshot="{\"message\":\"Purchase storage needs recovery. Restore purchases to retry.\",\"products\":{},\"owned\":[],\"deliveries\":[]}";}
    }
    @JavascriptInterface public String state(){return snapshot;}
    @JavascriptInterface public void restore(){activity.runOnUiThread(this::connect);}
    @JavascriptInterface public void buy(String product,String profile){activity.runOnUiThread(()->{
        if(closed)return;
        if(RETIRED_SALE_IDS.contains(product)){
            message="XP and level packs are no longer sold. Previously purchased items can still be restored.";
            publish();return;
        }
        if(busy){message="A Google Play checkout is already open.";publish();return;}
        if(!client.isReady()){message="Reconnecting to Google Play. Retry when the item price appears.";publish();connect();return;}
        if(profile==null||!profile.matches("[a-f0-9]{64}")){message="Load and save your character before purchasing.";publish();return;}
        ProductDetails p=catalog.get(product);
        if(p==null){message="This item is unavailable from Google Play. Tap Restore purchases to refresh.";publish();return;}
        ProductDetails.OneTimePurchaseOfferDetails o;
        try{o=offer(p);}catch(RuntimeException invalidOffer){
            // A stale or malformed Play product row can throw while reading
            // its offers. Reject this checkout without crashing the Activity.
            message="Google Play returned an invalid purchase option. Tap Restore purchases to refresh.";
            publish();return;
        }
        if(o==null){message="No eligible purchase option is available for this item.";publish();return;}
        // A Play offer token alone does not establish a user-visible price.
        // Never open a checkout for a SKU the game could not price in its shop.
        String verifiedPrice;
        try{verifiedPrice=o.getFormattedPrice();}catch(RuntimeException invalidPrice){
            message="Google Play could not verify this item's price. Tap Restore purchases to refresh.";
            publish();return;
        }
        if(verifiedPrice==null||verifiedPrice.trim().isEmpty()){
            message="Google Play could not verify this item's price. Tap Restore purchases to refresh.";
            publish();return;
        }
        busy=true;message="Opening Google Play checkout…";publish();
        try{
            BillingFlowParams.ProductDetailsParams params=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(o.getOfferToken()).build();
            BillingResult result=client.launchBillingFlow(activity,BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(params)).setObfuscatedProfileId(profile).build());
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){busy=false;message="Checkout could not start. No new purchase was delivered. Restore purchases and retry.";publish();}
        }catch(RuntimeException launchFailed){
            // A stale offer, disconnected Play service, or other client-side
            // launch failure must not crash the Activity or wedge the shop busy.
            busy=false;
            message="Google Play checkout could not be confirmed. Restore purchases to check payment status before trying again.";
            publish();
        }
    });}
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){activity.runOnUiThread(()->{
        if(closed)return;
        busy=false;
        if(result==null){
            // An incomplete Play callback is not proof of payment or cancellation.
            // Reset checkout state and let an explicit restore verify ownership.
            message="Google Play returned no checkout status. Restore purchases to check payment status.";
        }else if(result.getResponseCode()==BillingClient.BillingResponseCode.OK){
            if(purchases==null||purchases.isEmpty()){
                message="Google Play returned no purchase details. Restore purchases to check payment status.";
            }else{
                boolean receivedPurchase=false;
                for(Purchase p:purchases){
                    if(p==null)continue;
                    receivedPurchase=true;
                    accept(p); // accept() independently verifies signature and package.
                }
                if(!receivedPurchase)message="Google Play returned incomplete purchase details. Restore purchases to retry.";
            }
        }else if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED){
            message="Purchase cancelled. No items were granted.";
        }else message="Purchase not completed. Restore purchases to check its status.";
        publish();
    });}
    // Called only after the game has atomically committed both reward and receipt ID.
    @JavascriptInterface public void delivered(String id){activity.runOnUiThread(()->{
        if(closed)return;
        JSONObject r=receipts.optJSONObject(id);if(r==null||!r.optBoolean("active")||!trustworthySavedReceipt(r))return;
        // A failed or throwing commit must not leave this receipt marked as
        // delivered in memory. Otherwise a future snapshot can suppress
        // delivery even though the receipt was never durably recorded.
        boolean wasDelivered=r.optBoolean("delivered");
        try{
            r.put("delivered",true);
            if(persist()){finish(r);publish();return;}
        }catch(Exception ignored){
            // Treat preference write exceptions exactly like commit() returning false.
        }
        try{r.put("delivered",wasDelivered);}catch(Exception ignored){}
        message="Purchase receipt could not be saved. Free device storage, then Restore purchases.";
        publish();
    });}
    private void retryFinishing(){Iterator<String> keys=receipts.keys();while(keys.hasNext()){JSONObject r=receipts.optJSONObject(keys.next());if(r!=null&&r.optBoolean("active")&&r.optBoolean("delivered")&&!r.optBoolean("finished")&&trustworthySavedReceipt(r))finish(r);}}
    private void finish(JSONObject r){
        String id=r.optString("id");if(closed||!client.isReady()||!r.optBoolean("active")||!trustworthySavedReceipt(r)||r.optBoolean("finished")||!finishing.add(id))return;
        final int finishSession=billingSessionEpoch;
        try{
            if(consumable(r.optString("product")))client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(r.optString("token")).build(),(result,token)->activity.runOnUiThread(()->completeConsumed(r,result,token,finishSession)));
            else client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(r.optString("token")).build(),result->activity.runOnUiThread(()->complete(r,result,finishSession)));
        }catch(RuntimeException dispatchFailure){
            // A thrown Play API call is not a confirmation. Keep the already
            // delivered receipt and allow Restore to retry without reconnecting.
            finishing.remove(id);
            message="Google Play could not confirm the saved purchase. Tap Restore purchases to retry.";
            publish();
        }
    }
    // A successful consume callback must refer to this exact paid token.
    // A mismatched/null callback token is not proof that Play consumed the
    // receipt we submitted. Leave the delivered reward intact and retryable.
    private void completeConsumed(JSONObject r,BillingResult result,String returnedToken,int finishSession){
        complete(r,r.optString("token").equals(returnedToken)?result:null,finishSession);
    }
    private void complete(JSONObject r,BillingResult result,int finishSession){
        // Ignore callbacks from an ended connection. After disconnect the
        // finishing set is cleared so Restore can retry the valid receipt.
        if(closed||finishSession!=billingSessionEpoch)return;
        finishing.remove(r.optString("id"));
        // A purchase can be refreshed, revoked, or its damaged receipt replaced
        // while Google Play is processing consume/ack. Never mark a detached or
        // no-longer-verified record "saved": persist() writes the live ledger,
        // not this stale JSONObject captured by the original callback.
        String id=r.optString("id");
        if(receipts.optJSONObject(id)!=r || !r.optBoolean("active")
                || !r.optBoolean("delivered") || !trustworthySavedReceipt(r)){
            message="Purchase receipt changed while Google Play was confirming it. Restore purchases to verify delivery.";
            publish();
            return;
        }
        // A null callback cannot confirm consume/acknowledge. Keep the delivered
        // receipt retryable instead of throwing on the UI thread.
        boolean playConfirmed=result!=null&&result.getResponseCode()==BillingClient.BillingResponseCode.OK;
        boolean savedConfirmation=false;
        if(playConfirmed){
            try{
                r.put("finished",true);
                savedConfirmation=persist();
            }catch(Exception ignored){
                // A failed preference write must not look like a durable receipt.
            }
            if(!savedConfirmation)try{
                // Keep the already delivered reward, but allow Restore to retry
                // the unrecorded completion instead of suppressing it in memory.
                r.put("finished",false);
            }catch(Exception ignored){}
        }
        message=playConfirmed
            ?(savedConfirmation?"Purchase delivered and saved.":"Google Play confirmed delivery, but receipt storage failed. Free device space, then Restore purchases.")
            :"Items saved. Google Play confirmation will retry when you restore purchases.";
        publish();
    }
    void close(){closed=true;refreshEpoch++;billingSessionEpoch++;finishing.clear();busy=false;catalog.clear();client.endConnection();}
}

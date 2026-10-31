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
    private final Activity activity;
    private final BillingClient client;
    private final SharedPreferences prefs;
    private final Map<String,ProductDetails> catalog=new HashMap<>();
    private final Set<String> finishing=new HashSet<>();
    private JSONObject receipts;
    private volatile String snapshot="{}";
    private String message="Connecting to Google Play…";
    private boolean closed, busy, connecting;
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
        client.startConnection(new BillingClientStateListener(){
            public void onBillingSetupFinished(BillingResult result){activity.runOnUiThread(()->{
                connecting=false;
                if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)refresh();
                else {message="Google Play purchases are unavailable. Install the Play test release and retry.";publish();}
            });}
            public void onBillingServiceDisconnected(){activity.runOnUiThread(()->{connecting=false;catalog.clear();message="Google Play disconnected. Tap Restore purchases to retry.";publish();});}
        });
    }
    private void refresh(){
        if(closed||!client.isReady())return;
        List<QueryProductDetailsParams.Product> products=new ArrayList<>();
        for(String id:PRODUCT_IDS)products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(),(status,result)->activity.runOnUiThread(()->{
            catalog.clear();
            if(status.getResponseCode()==BillingClient.BillingResponseCode.OK)for(ProductDetails p:result.getProductDetailsList())catalog.put(p.getProductId(),p);
            message=catalog.isEmpty()?"No products are available from Google Play yet.":"Google Play checkout ready. Prices are supplied by Google Play.";publish();
        }));
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(status,purchases)->activity.runOnUiThread(()->{
            if(status.getResponseCode()!=BillingClient.BillingResponseCode.OK)return;
            Set<String> active=new HashSet<>();
            for(Purchase p:purchases){if(valid(p))active.add(hash(p.getPurchaseToken()));accept(p);}
            // A successful owned-purchases query is authoritative for durable ownership.
            Iterator<String> keys=receipts.keys();
            while(keys.hasNext()){JSONObject r=receipts.optJSONObject(keys.next());if(r!=null&&!consumable(r.optString("product")))try{r.put("active",active.contains(r.optString("id")));}catch(Exception ignored){}}
            persist(); publish(); retryFinishing();
        }));
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
            if(!trustworthySavedReceipt(existing,p)){
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
            else message="Verified purchase ready for delivery.";
            publish();
        }catch(Exception e){
            if(previous!=null)receipts=previous;
            message="Could not store the purchase. Tap Restore purchases to retry.";publish();
        }
    }
    private boolean persist(){return prefs.edit().putString("receipts",receipts.toString()).commit();}
    private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p){
        List<ProductDetails.OneTimePurchaseOfferDetails> offers=p.getOneTimePurchaseOfferDetailsList();
        if(offers==null)return null;
        for(ProductDetails.OneTimePurchaseOfferDetails o:offers)if(o.getOfferId()==null)return o;
        return null;
    }
    private void publish(){
        try{
            JSONObject result=new JSONObject().put("message",message).put("busy",busy);
            JSONObject items=new JSONObject();
            for(ProductDetails p:catalog.values()){ProductDetails.OneTimePurchaseOfferDetails o=offer(p);if(o!=null)items.put(p.getProductId(),new JSONObject().put("price",o.getFormattedPrice()));}
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
        if(busy){message="A Google Play checkout is already open.";publish();return;}
        if(!client.isReady()){message="Reconnecting to Google Play. Retry when the item price appears.";publish();connect();return;}
        if(profile==null||!profile.matches("[a-f0-9]{64}")){message="Load and save your character before purchasing.";publish();return;}
        ProductDetails p=catalog.get(product);
        if(p==null){message="This item is unavailable from Google Play. Tap Restore purchases to refresh.";publish();return;}
        ProductDetails.OneTimePurchaseOfferDetails o=offer(p);
        if(o==null){message="No eligible purchase option is available for this item.";publish();return;}
        busy=true;message="Opening Google Play checkout…";publish();
        BillingFlowParams.ProductDetailsParams params=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(o.getOfferToken()).build();
        BillingResult result=client.launchBillingFlow(activity,BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(params)).setObfuscatedProfileId(profile).build());
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){busy=false;message="Checkout could not start. No new purchase was delivered. Restore purchases and retry.";publish();}
    });}
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){activity.runOnUiThread(()->{
        busy=false;
        if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&purchases!=null)for(Purchase p:purchases)accept(p);
        else if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED)message="Purchase cancelled. No items were granted.";
        else message="Purchase not completed. Restore purchases to check its status.";
        publish();
    });}
    // Called only after the game has atomically committed both reward and receipt ID.
    @JavascriptInterface public void delivered(String id){activity.runOnUiThread(()->{
        JSONObject r=receipts.optJSONObject(id);if(r==null||!r.optBoolean("active")||!trustworthySavedReceipt(r))return;
        try{r.put("delivered",true);if(!persist()){r.put("delivered",false);return;}finish(r);publish();}catch(Exception ignored){}
    });}
    private void retryFinishing(){Iterator<String> keys=receipts.keys();while(keys.hasNext()){JSONObject r=receipts.optJSONObject(keys.next());if(r!=null&&r.optBoolean("delivered")&&!r.optBoolean("finished")&&trustworthySavedReceipt(r))finish(r);}}
    private void finish(JSONObject r){
        String id=r.optString("id");if(closed||!client.isReady()||r.optBoolean("finished")||!finishing.add(id))return;
        if(consumable(r.optString("product")))client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(r.optString("token")).build(),(result,token)->activity.runOnUiThread(()->complete(r,result)));
        else client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(r.optString("token")).build(),result->activity.runOnUiThread(()->complete(r,result)));
    }
    private void complete(JSONObject r,BillingResult result){
        finishing.remove(r.optString("id"));
        if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)try{r.put("finished",true);persist();}catch(Exception ignored){}
        message=result.getResponseCode()==BillingClient.BillingResponseCode.OK?"Purchase delivered and saved.":"Items saved. Google Play confirmation will retry when you restore purchases.";publish();
    }
    void close(){closed=true;catalog.clear();client.endConnection();}
}

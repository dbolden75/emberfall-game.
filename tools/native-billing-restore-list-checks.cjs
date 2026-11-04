#!/usr/bin/env node
// Run the production Play Billing refresh() method against a deterministic Java
// callback fake. A null Play result must not be treated as an empty successful
// entitlement list, which would otherwise revoke all owned cosmetics/titles.
// This is not a live purchase or an Android device test.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const marker='private void refresh()';
const start=source.indexOf(marker);
assert(start>=0,'Production refresh method not found');
const brace=source.indexOf('{',start);let depth=0,end=-1;
for(let i=brace;i<source.length;i++){
 if(source[i]==='{')depth++;
 else if(source[i]==='}'&&--depth===0){end=i+1;break;}
}
assert(end>brace,'Production refresh method is not balanced');
const production=source.slice(start,end);
const java=`
import java.util.*;
public class RestoreListHarness {
  static class Activity {void runOnUiThread(Runnable fn){fn.run();}}
  static class Status {
    final int code;
    Status(int code){this.code=code;}
    int getResponseCode(){return code;}
  }
  static class BillingClient {
    static class BillingResponseCode{static final int OK=0;}
    static class ProductType{static final String INAPP="inapp";}
    interface DetailsCb {void complete(Status status,Details result);}
    interface PurchasesCb {void complete(Status status,List<Purchase> purchases);}
    DetailsCb detailsCallback;
    PurchasesCb purchasesCallback;
    boolean ready=true;
    boolean isReady(){return ready;}
    void queryProductDetailsAsync(QueryProductDetailsParams params,DetailsCb cb){detailsCallback=cb;}
    void queryPurchasesAsync(QueryPurchasesParams params,PurchasesCb cb){purchasesCallback=cb;}
  }
  static class QueryProductDetailsParams {
    static Builder newBuilder(){return new Builder();}
    static class Builder {
      Builder setProductList(List<Product> p){return this;}
      QueryProductDetailsParams build(){return new QueryProductDetailsParams();}
    }
    static class Product {
      static ProductBuilder newBuilder(){return new ProductBuilder();}
      static class ProductBuilder {
        ProductBuilder setProductId(String s){return this;}
        ProductBuilder setProductType(String s){return this;}
        Product build(){return new Product();}
      }
    }
  }
  static class QueryPurchasesParams {
    static Builder newBuilder(){return new Builder();}
    static class Builder {
      Builder setProductType(String s){return this;}
      QueryPurchasesParams build(){return new QueryPurchasesParams();}
    }
  }
  static class Details{
    final List<ProductDetails> items;
    Details(List<ProductDetails> items){this.items=items;}
    List<ProductDetails> getProductDetailsList(){return items;}
  }
  static class ProductDetails {
    String id;
    ProductDetails(String id){this.id=id;}
    String getProductId(){return id;}
  }
  static class Purchase {
    String id;
    Purchase(String id){this.id=id;}
    String getPurchaseToken(){return id;}
  }
  final Activity activity=new Activity();
  final BillingClient client=new BillingClient();
  final Map<String,ProductDetails> catalog=new HashMap<>();
  final String[] PRODUCT_IDS={"item_a","item_b"};
  final Set<String> RETIRED_SALE_IDS=Collections.emptySet();
  int refreshEpoch,publishCalls,acceptCalls,reconcileCalls,retryCalls;
  boolean closed;
  String message="untouched";
  Set<String> lastActive=null;
  boolean previouslyOwned=true;
  void publish(){publishCalls++;}
  boolean valid(Purchase p){return p!=null;}
  String hash(String s){return s;}
  void accept(Purchase p){acceptCalls++;}
  void reconcileActiveOwnedPurchases(Set<String> active){
    reconcileCalls++;
    lastActive=new HashSet<>(active);
    previouslyOwned=active.contains("previously_owned");
  }
  void retryFinishing(){retryCalls++;}
  // This harness tests the refresh callback's ownership/price flow. A separate
  // production-method Java harness exercises Billing 9 unfetched statuses.
  String unfetchedProductStatus(Details result){return "";}
  ${production}
  static void check(boolean ok,String msg){if(!ok)throw new AssertionError(msg);}
  static RestoreListHarness ready(){
    RestoreListHarness h=new RestoreListHarness();
    h.refresh();
    check(h.client.purchasesCallback!=null,"A Play purchase query must be queued");
    return h;
  }
  public static void main(String[] args){
    RestoreListHarness h=ready();
    h.client.purchasesCallback.complete(new Status(0),null);
    check(h.previouslyOwned && h.reconcileCalls==0 && h.acceptCalls==0,
      "OK plus null list must not revoke previously verified ownership");
    check(h.retryCalls==0 && h.message.contains("incomplete") && h.publishCalls==1,
      "Null list must explain retry without confirming a restore");

    h=ready();
    h.client.purchasesCallback.complete(new Status(0),Collections.emptyList());
    check(!h.previouslyOwned && h.reconcileCalls==1 && h.retryCalls==1,
      "A real empty list may revoke ownership after a successful Play query");
    check(h.lastActive.isEmpty(),"Empty query must reconcile with an empty set");

    h=ready();
    h.client.purchasesCallback.complete(new Status(0),Arrays.asList(new Purchase("previously_owned")));
    check(h.previouslyOwned && h.acceptCalls==1 && h.reconcileCalls==1 && h.retryCalls==1,
      "Valid purchases must be accepted and reconciled");

    h=ready();
    h.client.purchasesCallback.complete(new Status(6),null);
    check(h.previouslyOwned && h.reconcileCalls==0 && h.message.contains("code 6"),
      "Failed Play query must preserve entitlements and report its error code");

    h=ready();
    BillingClient.PurchasesCb stale=h.client.purchasesCallback;
    h.refresh();
    stale.complete(new Status(0),Collections.emptyList());
    check(h.previouslyOwned && h.reconcileCalls==0,
      "Stale Play responses must not revoke ownership");
    h.client.purchasesCallback.complete(new Status(0),null);
    check(h.reconcileCalls==0,"Current incomplete response must still preserve ownership");

    h=ready();
    h.closed=true;
    h.client.purchasesCallback.complete(new Status(0),Collections.emptyList());
    check(h.previouslyOwned && h.reconcileCalls==0,
      "Callback after Activity destruction must be ignored");

    h=new RestoreListHarness();
    h.client.ready=false;
    h.refresh();
    check(h.client.purchasesCallback==null && h.reconcileCalls==0,
      "Offline Play must not query or revoke");
    // The same production refresh() also receives Play product details.
    // OK plus missing data must not throw or incorrectly blame SKU activation.
    h=ready();
    h.catalog.put("old",new ProductDetails("old"));
    h.client.detailsCallback.complete(new Status(0),null);
    check(h.catalog.isEmpty() && h.message.contains("incomplete") && h.publishCalls==1,
      "Null OK product result must clear stale prices and explain an incomplete query");

    h=ready();
    h.client.detailsCallback.complete(new Status(0),new Details(null));
    check(h.catalog.isEmpty() && h.message.contains("incomplete"),
      "OK with a null details list must not dereference it or claim no SKUs exist");

    h=ready();
    h.client.detailsCallback.complete(new Status(0),new Details(Collections.emptyList()));
    check(h.catalog.isEmpty() && h.message.contains("no available products"),
      "A verified empty details list must retain the genuine no-products diagnostic");

    h=ready();
    h.client.detailsCallback.complete(new Status(0),new Details(Arrays.asList(
      null,new ProductDetails("item_a"))));
    check(h.catalog.size()==1 && h.catalog.containsKey("item_a") && h.message.contains("checkout ready"),
      "Only verified non-null product details may appear as buyable");

    h=ready();
    h.client.detailsCallback.complete(new Status(6),null);
    check(h.catalog.isEmpty() && h.message.contains("code 6"),
      "Play product-query errors must not be mistaken for an empty catalog");

    h=ready();
    BillingClient.DetailsCb staleDetails=h.client.detailsCallback;
    h.refresh();
    staleDetails.complete(new Status(0),new Details(Arrays.asList(new ProductDetails("old"))));
    check(h.catalog.isEmpty() && h.publishCalls==0,
      "An obsolete product callback cannot publish outdated buyable prices");
    h.client.detailsCallback.complete(new Status(0),new Details(Arrays.asList(new ProductDetails("item_b"))));
    check(h.catalog.size()==1 && h.catalog.containsKey("item_b"),
      "The current catalog callback must still publish valid products");

    h=ready();
    h.closed=true;
    h.client.detailsCallback.complete(new Status(0),new Details(Arrays.asList(new ProductDetails("item_a"))));
    check(h.catalog.isEmpty() && h.publishCalls==0,
      "Product callback after Activity destruction must be ignored");

    h=new RestoreListHarness();
    h.client.ready=false;
    h.refresh();
    check(h.client.detailsCallback==null,
      "Offline Play must not request product details");

    System.out.println("PASS: eight actual Java refresh() catalog scenarios (incomplete result/list, empty, valid, failed, stale, closed, offline)");
    System.out.println("PASS: seven actual Java refresh() scenarios for null, empty, valid, failed, stale, closed and offline Play results");
    System.out.println("NOT VERIFIED: real Google Play service, products, payment or restore on a phone.");
  }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-play-restore-'));
try {
 const file=path.join(dir,'RestoreListHarness.java');fs.writeFileSync(file,java,'utf8');
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,file]],['java',['-cp',dir,'RestoreListHarness']]]){
  const r=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,bin+' failed: '+(r.stderr||r.stdout||r.error));
  if(r.stdout)process.stdout.write(r.stdout);
 }
} finally {fs.rmSync(dir,{recursive:true,force:true});}

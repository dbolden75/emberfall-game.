// Run the exact production JavaScript buy() bridge in a deterministic Java fake.
// Simulates failed launches; does NOT contact Google Play or complete payments.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const marker='@JavascriptInterface public void buy(String product,String profile)';
const start=src.indexOf(marker);assert(start>=0,'Expected production Play checkout bridge');
const brace=src.indexOf('{',start);let depth=0,end=-1;
for(let i=brace;i<src.length;i++){
 if(src[i]==='{')depth++;
 else if(src[i]==='}'&&--depth===0){end=i+1;break;}
}
assert(end>brace,'Production checkout method must have balanced braces');
const method=src.slice(start,end);
const java=`
import java.util.*;
@interface JavascriptInterface {}
public class BillingLaunchHarness {
  static class Activity {void runOnUiThread(Runnable r){r.run();}}
  static class BillingResult {final int code;BillingResult(int c){code=c;}int getResponseCode(){return code;}}
  static class BillingClient {
    static class BillingResponseCode{static final int OK=0;}
    boolean ready=true,throwOnLaunch=false;int launchCalls=0,responseCode=0;
    boolean isReady(){return ready;}
    BillingResult launchBillingFlow(Activity a,BillingFlowParams params){
      launchCalls++;
      if(throwOnLaunch)throw new IllegalArgumentException("stale Play offer token");
      return new BillingResult(responseCode);
    }
  }
  static class ProductDetails{
    static class OneTimePurchaseOfferDetails {String getOfferToken(){return "token";}}
  }
  static class BillingFlowParams{
    static Builder newBuilder(){return new Builder();}
    static class Builder{
      Builder setProductDetailsParamsList(List<ProductDetailsParams> p){return this;}
      Builder setObfuscatedProfileId(String id){return this;}
      BillingFlowParams build(){return new BillingFlowParams();}
    }
    static class ProductDetailsParams{
      static ProductDetailsParamsBuilder newBuilder(){return new ProductDetailsParamsBuilder();}
      static class ProductDetailsParamsBuilder{
        ProductDetailsParamsBuilder setProductDetails(ProductDetails p){return this;}
        ProductDetailsParamsBuilder setOfferToken(String s){return this;}
        ProductDetailsParams build(){return new ProductDetailsParams();}
      }
    }
  }
  final Activity activity=new Activity();
  final BillingClient client=new BillingClient();
  final Map<String,ProductDetails> catalog=new HashMap<>();
  final Set<String> RETIRED_SALE_IDS=new HashSet<>(Arrays.asList("thornhaven_levels_1"));
  boolean busy,closed,offerAvailable=true;
  String message="";
  int published,connections;
  ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p){return offerAvailable?new ProductDetails.OneTimePurchaseOfferDetails():null;}
  void publish(){published++;}
  void connect(){connections++;}
  ${method}
  static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);}
  static final String PROFILE="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  static BillingLaunchHarness valid(){BillingLaunchHarness h=new BillingLaunchHarness();h.catalog.put("cosmetic",new ProductDetails());return h;}
  public static void main(String[] args){
    BillingLaunchHarness h=valid();h.client.throwOnLaunch=true;h.buy("cosmetic",PROFILE);
    check(!h.busy,"Thrown Play checkout must clear busy");
    check(h.client.launchCalls==1 && h.message.contains("could not open") && h.published==2,"Thrown launch must display actionable error and not crash");
    h=valid();h.client.responseCode=6;h.buy("cosmetic",PROFILE);
    check(!h.busy && h.client.launchCalls==1 && h.message.contains("could not start"),"Failed BillingResult must reset busy");
    h=valid();h.buy("cosmetic",PROFILE);
    check(h.busy && h.client.launchCalls==1 && h.message.contains("Opening"),"Successful start must remain busy until callback");
    h=valid();h.busy=true;h.buy("cosmetic",PROFILE);
    check(h.client.launchCalls==0 && h.busy,"Second checkout must not start while busy");
    h=valid();h.client.ready=false;h.buy("cosmetic",PROFILE);
    check(h.client.launchCalls==0 && h.connections==1 && !h.busy,"Offline billing must request reconnect without checkout");
    h=valid();h.buy("cosmetic","not-a-profile");
    check(h.client.launchCalls==0 && !h.busy,"Invalid character must not start checkout");
    h=valid();h.buy("thornhaven_levels_1",PROFILE);
    check(h.client.launchCalls==0 && !h.busy,"Retired progression pack must not start checkout");
    h=valid();h.buy("missing",PROFILE);
    check(h.client.launchCalls==0 && !h.busy,"Unknown product must not start checkout");
    h=valid();h.offerAvailable=false;h.buy("cosmetic",PROFILE);
    check(h.client.launchCalls==0 && !h.busy,"Offer without token must not start checkout");
    h=valid();h.closed=true;h.buy("cosmetic",PROFILE);
    check(h.client.launchCalls==0 && h.published==0,"Destroyed Activity must not open checkout");
    System.out.println("PASS: 10 native billing launch scenarios including thrown Play exception; no live checkout was performed");
  }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-launch-'));
try{
 const file=path.join(dir,'BillingLaunchHarness.java');fs.writeFileSync(file,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,file]],['java',['-cp',dir,'BillingLaunchHarness']]]){
  const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
  if(p.stdout)process.stdout.write(p.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

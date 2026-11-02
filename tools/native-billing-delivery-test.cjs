// Exercise the exact production @JavascriptInterface delivered() method in a
// minimal Java harness, including SharedPreferences.commit() failure modes.
// Does not simulate or claim an actual Google Play checkout.
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');

const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const marker='@JavascriptInterface public void delivered(String id)';
const start=source.indexOf(marker);
assert(start>=0,'Production receipt delivery callback must exist');
const brace=source.indexOf('{',start);
let depth=0,end=-1;
for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&!--depth){end=i+1;break;}
}
assert(end>brace,'Production delivery callback must have closing brace');
const productionMethod=source.slice(start,end);

const java=`
import java.util.*;
@interface JavascriptInterface {}
public class BillingDeliveryHarness {
  static class Activity { void runOnUiThread(Runnable r){r.run();} }
  static class JSONObject {
    final Map<String,Object> values=new HashMap<>();
    JSONObject put(String key,Object value){values.put(key,value);return this;}
    JSONObject optJSONObject(String key){
      Object v=values.get(key);
      return v instanceof JSONObject?(JSONObject)v:null;
    }
    String optString(String key){return String.valueOf(values.getOrDefault(key,""));}
    boolean optBoolean(String key){return Boolean.TRUE.equals(values.get(key));}
  }
  final Activity activity=new Activity();
  final JSONObject receipts=new JSONObject();
  boolean closed;
  boolean trustworthy=true;
  boolean storageAccepts=true, storageThrows;
  int persistenceCalls, finishCalls, publishCalls;
  String message="";
  boolean trustworthySavedReceipt(JSONObject r){return trustworthy;}
  boolean persist(){
    persistenceCalls++;
    if(storageThrows)throw new IllegalStateException("Device storage failure");
    return storageAccepts;
  }
  void finish(JSONObject r){finishCalls++;}
  void publish(){publishCalls++;}
  ${productionMethod}

  static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
  static BillingDeliveryHarness scenario(boolean active,boolean alreadyDelivered){
    BillingDeliveryHarness h=new BillingDeliveryHarness();
    h.receipts.put("token",new JSONObject()
        .put("id","token").put("active",active)
        .put("delivered",alreadyDelivered));
    return h;
  }
  JSONObject receipt(){return receipts.optJSONObject("token");}
  void assertUntouched(String name){
    check(persistenceCalls==0 && finishCalls==0 && publishCalls==0,name);
  }
  public static void main(String[] args){
    BillingDeliveryHarness h=scenario(true,false);
    h.delivered("token");
    check(h.receipt().optBoolean("delivered"),"Successful commit must deliver");
    check(h.persistenceCalls==1 && h.finishCalls==1 && h.publishCalls==1,"Success order");

    h=scenario(true,false);h.storageAccepts=false;
    h.delivered("token");
    check(!h.receipt().optBoolean("delivered"),"False commit must roll back delivery");
    check(h.persistenceCalls==1 && h.finishCalls==0 && h.publishCalls==1,"False commit must not acknowledge");
    check(h.message.contains("could not be saved"),"False commit must report storage failure");

    h=scenario(true,false);h.storageThrows=true;
    h.delivered("token");
    check(!h.receipt().optBoolean("delivered"),"Exception must roll back delivery");
    check(h.persistenceCalls==1 && h.finishCalls==0 && h.publishCalls==1,"Exception must not acknowledge");
    check(h.message.contains("could not be saved"),"Exception must report storage failure");

    h=scenario(true,true);h.storageThrows=true;
    h.delivered("token");
    check(h.receipt().optBoolean("delivered"),"Failed persistence preserves prior delivered state");
    check(h.finishCalls==0,"Failed persistence cannot finish old receipt");

    h=scenario(false,false);
    h.delivered("token");h.assertUntouched("Inactive receipts must not be delivered");

    h=scenario(true,false);h.trustworthy=false;
    h.delivered("token");h.assertUntouched("Unverified receipts must not be delivered");

    h=scenario(true,false);h.closed=true;
    h.delivered("token");h.assertUntouched("Activity teardown must reject delivery");

    h=scenario(true,false);
    h.delivered("missing");h.assertUntouched("Unknown token must be rejected");

    System.out.println("PASS: 8 native Play receipt delivery cases (success, false commit, exception, prior state, inactive, unverified, teardown, missing)");
  }
}
`;

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-billing-delivery-'));
try{
  const file=path.join(dir,'BillingDeliveryHarness.java');
  fs.writeFileSync(file,java,'utf8');
  for(const [bin,args] of [
    ['javac',['-encoding','UTF-8','-d',dir,file]],
    ['java',['-cp',dir,'BillingDeliveryHarness']]
  ]){
    const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
    assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
    if(p.stdout)process.stdout.write(p.stdout);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

// Run the exact production billing completion method against a tiny Java
// receipt/persistence harness. No Android SDK, Play purchase or secret is used.
// This is a unit simulation, not a live Google Play checkout.
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');

const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const marker='private void complete(JSONObject r,BillingResult result,int finishSession)';
const begin=source.indexOf(marker);
assert(begin>=0,'Billing completion method must exist');
const brace=source.indexOf('{',begin);
let depth=0,end=-1;
for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&!--depth){end=i+1;break;}
}
assert(end>brace,'Billing completion method must have a matching closing brace');
const productionMethod=source.slice(begin,end);
const consumeMarker='private void completeConsumed(JSONObject r,BillingResult result,String returnedToken,int finishSession)';
const consumeBegin=source.indexOf(consumeMarker);
assert(consumeBegin>=0,'Production consume-token completion guard must exist');
const consumeBrace=source.indexOf('{',consumeBegin);
let consumeDepth=0,consumeEnd=-1;
for(let i=consumeBrace;i<source.length;i++){
  if(source[i]==='{')consumeDepth++;
  if(source[i]==='}'&&!--consumeDepth){consumeEnd=i+1;break;}
}
assert(consumeEnd>consumeBrace,'Consume-token completion method must have a closing brace');
const productionConsumeMethod=source.slice(consumeBegin,consumeEnd);
assert(/consumeAsync\([\s\S]*?completeConsumed\(r,result,token,finishSession\)/.test(source),
       'Production Play consume callback must verify the token returned by Play');

const java=`
import java.util.*;
public class BillingCompletionHarness {
  static class BillingClient {
    static class BillingResponseCode { static final int OK=0; }
  }
  static class BillingResult {
    private final int code;
    BillingResult(int code){this.code=code;}
    int getResponseCode(){return code;}
  }
  static class JSONObject {
    final Map<String,Object> values=new HashMap<>();
    JSONObject put(String key,Object value){values.put(key,value);return this;}
    String optString(String key){return String.valueOf(values.getOrDefault(key,""));}
    JSONObject optJSONObject(String key){Object v=values.get(key);return v instanceof JSONObject?(JSONObject)v:null;}
    boolean optBoolean(String key){return Boolean.TRUE.equals(values.get(key));}
  }
  boolean closed;
  int billingSessionEpoch=7;
  Set<String> finishing=new HashSet<>();
  final JSONObject receipts=new JSONObject();
  boolean trustworthy=true;
  boolean trustworthySavedReceipt(JSONObject r){return trustworthy;}
  String message="";
  boolean storageAccepts=true, storageThrows;
  int persistenceCalls, published;
  boolean persist(){
    persistenceCalls++;
    if(storageThrows)throw new IllegalStateException("Disk unavailable");
    return storageAccepts;
  }
  void publish(){published++;}
  ${productionMethod}
  ${productionConsumeMethod}
  static void check(boolean condition,String name){
    if(!condition)throw new AssertionError(name);
  }
  static JSONObject receipt(){
    return new JSONObject().put("id","paid-token").put("token","expected-play-token").put("active",true).put("delivered",true).put("finished",false);
  }
  static BillingCompletionHarness active(JSONObject r){
    BillingCompletionHarness h=new BillingCompletionHarness();
    h.finishing.add("paid-token");
    h.receipts.put("paid-token",r);
    return h;
  }
  public static void main(String[] args){
    JSONObject r=receipt();BillingCompletionHarness h=active(r);
    h.complete(r,new BillingResult(0),7);
    check(r.optBoolean("finished"),"Successful commit must mark receipt finished");
    check(r.optBoolean("delivered"),"Successful commit must preserve reward");
    check(h.persistenceCalls==1 && h.published==1 && h.finishing.isEmpty(),"Successful callback sequence");
    check(h.message.contains("delivered and saved"),"Successful receipt message");

    r=receipt();h=active(r);h.storageAccepts=false;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished"),"Failed commit must restore retryable receipt");
    check(r.optBoolean("delivered"),"Failed commit must not regrant paid reward");
    check(h.finishing.isEmpty() && h.persistenceCalls==1 && h.published==1,"Failed commit callback sequence");
    check(h.message.contains("storage failed"),"Failed commit must not claim to be saved");

    r=receipt();h=active(r);h.storageThrows=true;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && r.optBoolean("delivered"),"Thrown persistence must roll back in-memory finish");
    check(h.message.contains("storage failed"),"Thrown persistence message");

    r=receipt();h=active(r);
    h.complete(r,new BillingResult(3),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,"Failed Play result must not mark confirmation");
    check(h.message.contains("retry"),"Failed Play response message");

    r=receipt();h=active(r);
    h.complete(r,null,7);
    check(!r.optBoolean("finished") && r.optBoolean("delivered"),"Null Play result cannot confirm delivery");
    check(h.persistenceCalls==0 && h.finishing.isEmpty() && h.published==1,"Null callback must allow retry without crashing");
    check(h.message.contains("retry"),"Null callback gives restore guidance");

    r=receipt();h=active(r);
    h.complete(r,new BillingResult(0),6);
    check(!r.optBoolean("finished") && h.persistenceCalls==0 && h.published==0 && h.finishing.size()==1,
          "Stale Play session cannot affect current ledger");

    r=receipt();h=active(r);h.closed=true;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0 && h.published==0,
          "Activity teardown must reject delayed completion");
    // Google Play may return after a new signed receipt replaces the object
    // previously submitted for acknowledgement. The old detached record must
    // never be reported as durably persisted.
    r=receipt();h=active(r);h.receipts.put("paid-token",receipt());
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,
          "Detached old receipt must not be called saved");
    check(h.message.contains("receipt changed") && h.finishing.isEmpty(),
          "Detached receipt must request a fresh restore");

    r=receipt();h=active(r);h.receipts.put("paid-token",null);
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,
          "Deleted receipt must not be confirmed");

    r=receipt();h=active(r);r.put("active",false);
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,
          "Revoked receipt must not be confirmed");

    r=receipt();h=active(r);h.trustworthy=false;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,
          "Unverified receipt must not be confirmed");

    r=receipt();h=active(r);
    h.completeConsumed(r,new BillingResult(0),"expected-play-token",7);
    check(r.optBoolean("finished") && h.persistenceCalls==1,
          "Matching Play consume token can finish the delivered receipt");

    r=receipt();h=active(r);
    h.completeConsumed(r,new BillingResult(0),"different-play-token",7);
    check(!r.optBoolean("finished") && r.optBoolean("delivered") && h.persistenceCalls==0,
          "Different Play consume token must never mark this receipt finished");
    check(h.finishing.isEmpty() && h.message.contains("retry"),
          "Mismatched consume response must permit a fresh Restore retry");

    r=receipt();h=active(r);
    h.completeConsumed(r,new BillingResult(0),null,7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,
          "Missing Play consume token cannot confirm this paid receipt");

    System.out.println("PASS: 14 native completion cases including matched/mismatched/missing Play consume tokens");
  }
}
`;

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-billing-complete-'));
try{
  const file=path.join(temp,'BillingCompletionHarness.java');
  fs.writeFileSync(file,java,'utf8');
  for(const [cmd,args] of [['javac',['-encoding','UTF-8','-d',temp,file]],['java',['-cp',temp,'BillingCompletionHarness']]]){
    const p=cp.spawnSync(cmd,args,{encoding:'utf8',timeout:30000});
    assert.equal(p.status,0,cmd+' failed: '+(p.stderr||p.stdout||p.error));
    if(p.stdout)process.stdout.write(p.stdout);
  }
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

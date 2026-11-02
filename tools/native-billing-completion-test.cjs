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
    boolean optBoolean(String key){return Boolean.TRUE.equals(values.get(key));}
  }
  boolean closed;
  int billingSessionEpoch=7;
  Set<String> finishing=new HashSet<>();
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
  static void check(boolean condition,String name){
    if(!condition)throw new AssertionError(name);
  }
  static JSONObject receipt(){
    return new JSONObject().put("id","paid-token").put("delivered",true).put("finished",false);
  }
  static BillingCompletionHarness active(){
    BillingCompletionHarness h=new BillingCompletionHarness();
    h.finishing.add("paid-token");
    return h;
  }
  public static void main(String[] args){
    JSONObject r=receipt();BillingCompletionHarness h=active();
    h.complete(r,new BillingResult(0),7);
    check(r.optBoolean("finished"),"Successful commit must mark receipt finished");
    check(r.optBoolean("delivered"),"Successful commit must preserve reward");
    check(h.persistenceCalls==1 && h.published==1 && h.finishing.isEmpty(),"Successful callback sequence");
    check(h.message.contains("delivered and saved"),"Successful receipt message");

    r=receipt();h=active();h.storageAccepts=false;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished"),"Failed commit must restore retryable receipt");
    check(r.optBoolean("delivered"),"Failed commit must not regrant paid reward");
    check(h.finishing.isEmpty() && h.persistenceCalls==1 && h.published==1,"Failed commit callback sequence");
    check(h.message.contains("storage failed"),"Failed commit must not claim to be saved");

    r=receipt();h=active();h.storageThrows=true;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && r.optBoolean("delivered"),"Thrown persistence must roll back in-memory finish");
    check(h.message.contains("storage failed"),"Thrown persistence message");

    r=receipt();h=active();
    h.complete(r,new BillingResult(3),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0,"Failed Play result must not mark confirmation");
    check(h.message.contains("retry"),"Failed Play response message");

    r=receipt();h=active();
    h.complete(r,new BillingResult(0),6);
    check(!r.optBoolean("finished") && h.persistenceCalls==0 && h.published==0 && h.finishing.size()==1,
          "Stale Play session cannot affect current ledger");

    r=receipt();h=active();h.closed=true;
    h.complete(r,new BillingResult(0),7);
    check(!r.optBoolean("finished") && h.persistenceCalls==0 && h.published==0,
          "Activity teardown must reject delayed completion");
    System.out.println("PASS: 6 native completion cases: saved, commit-failed, exception, Play error, stale session, teardown");
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

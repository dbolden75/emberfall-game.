#!/usr/bin/env node
// Compile the exact production onPurchasesUpdated() method with simple Java fakes.
// This is callback-failure QA, NOT a completed Google Play transaction.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const start=src.indexOf('@Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases)');
assert(start>=0,'Missing production purchase callback');
const brace=src.indexOf('{',start);let depth=0,end=-1;
for(let i=brace;i<src.length;i++){
  if(src[i]==='{')depth++;
  else if(src[i]==='}'&&--depth===0){end=i+1;break;}
}
assert(end>brace,'Unbalanced purchase callback');
const method=src.slice(start,end);
const java=`
import java.util.*;
public class BillingPurchaseCallbackHarness {
 static class Activity { void runOnUiThread(Runnable r){r.run();} }
 static class BillingClient {
  static class BillingResponseCode {static final int OK=0,USER_CANCELED=1;}
 }
 static class BillingResult {
  final int code; BillingResult(int code){this.code=code;}
  int getResponseCode(){return code;}
 }
 static class Purchase {final String id;Purchase(String id){this.id=id;}}
 final Activity activity=new Activity();
 boolean closed,busy=true;int published,accepted;String message="Opening Google Play checkout";
 void publish(){published++;}
 void accept(Purchase p){if(p==null)throw new AssertionError("Null purchase reached accept");
   accepted++;message="Verified receipt was accepted";}
 ${method}
 static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);}
 static BillingPurchaseCallbackHarness run(BillingResult result,List<Purchase> purchases){
  BillingPurchaseCallbackHarness h=new BillingPurchaseCallbackHarness();
  h.onPurchasesUpdated(result,purchases);return h;
 }
 public static void main(String[] args){
  BillingPurchaseCallbackHarness h=run(null,null);
  check(!h.busy&&h.accepted==0&&h.published==1&&h.message.contains("Restore"),
      "Null status must release checkout without granting items");
  h=run(new BillingResult(0),null);
  check(h.accepted==0&&!h.busy&&h.message.contains("Restore"),
      "Successful status with null purchase list is incomplete");
  h=run(new BillingResult(0),Collections.emptyList());
  check(h.accepted==0&&h.message.contains("Restore"),"Empty successful callback cannot grant rewards");
  h=run(new BillingResult(0),Arrays.asList((Purchase)null));
  check(h.accepted==0&&h.message.contains("Restore"),"Null purchase row must be ignored");
  h=run(new BillingResult(0),Arrays.asList(null,new Purchase("paid")));
  check(h.accepted==1&&h.published==1&&!h.busy,"One valid-shaped row is accepted, null row ignored");
  h=run(new BillingResult(0),Arrays.asList(new Purchase("paid"),new Purchase("another")));
  check(h.accepted==2&&h.published==1,"Multiple valid-shaped rows reach signature verifier");
  h=run(new BillingResult(1),Arrays.asList(new Purchase("paid")));
  check(h.accepted==0&&h.message.contains("cancelled"),"Cancelled callback must not grant");
  h=run(new BillingResult(6),null);
  check(h.accepted==0&&h.message.contains("Restore"),"Failed callback must not grant");
  h=new BillingPurchaseCallbackHarness();h.closed=true;
  h.onPurchasesUpdated(new BillingResult(0),Arrays.asList(new Purchase("paid")));
  check(h.accepted==0&&h.published==0,"Destroyed Activity must ignore callback");
  System.out.println("PASS: 9 production Play purchase callback scenarios (no live purchase)");
 }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-purchase-callback-'));
try {
 const javafile=path.join(dir,'BillingPurchaseCallbackHarness.java');fs.writeFileSync(javafile,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,javafile]],['java',['-cp',dir,'BillingPurchaseCallbackHarness']]]){
  const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
  if(p.stdout)process.stdout.write(p.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

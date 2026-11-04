#!/usr/bin/env node
// Executes production PlayBillingPreparation.connect() in a Java BillingClient
// fake. No Google Play transaction, Android emulator, or phone is involved.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const start=source.indexOf('void connect()');assert(start>=0,'Missing production connect()');
const brace=source.indexOf('{',start);let level=0,end=-1;
for(let i=brace;i<source.length;i++){if(source[i]==='{')level++;else if(source[i]==='}'&&--level===0){end=i+1;break;}}
assert(end>brace,'Unbalanced production connect()');
const method=source.slice(start,end);
const java=`
public class BillingConnectionHarness {
 static class Activity {void runOnUiThread(Runnable r){r.run();}}
 static class BillingResult {int code;BillingResult(int n){code=n;}int getResponseCode(){return code;}}
 interface BillingClientStateListener {
  void onBillingSetupFinished(BillingResult r);
  void onBillingServiceDisconnected();
 }
 static class BillingClient {
  static class BillingResponseCode {static final int OK=0;}
  boolean ready,throwStart;int starts;BillingClientStateListener callback;
  boolean isReady(){return ready;}
  void startConnection(BillingClientStateListener c){
   starts++;if(throwStart)throw new IllegalStateException("Play service unavailable");callback=c;
  }
 }
 final Activity activity=new Activity();
 final BillingClient client=new BillingClient();
 final java.util.Set<String> finishing=new java.util.HashSet<>();
 final java.util.Map<String,String> catalog=new java.util.HashMap<>();
 int refreshEpoch,billingSessionEpoch,published,refreshed;
 boolean connecting,closed,busy;String message="";
 void publish(){published++;}
 void refresh(){refreshed++;}
 ${method}
 static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);}
 public static void main(String[] args){
  BillingConnectionHarness h=new BillingConnectionHarness();h.client.throwStart=true;
  h.connect();
  check(!h.connecting&&h.client.starts==1&&h.published==1&&h.message.contains("retry"),"Thrown startup must not crash/lock game");
  h.client.throwStart=false;h.connect();check(h.connecting&&h.client.starts==2,"Restore must retry");
  h.connect();check(h.client.starts==2,"Duplicate in-flight connection forbidden");
  h.client.ready=true;h.client.callback.onBillingSetupFinished(new BillingResult(0));
  check(!h.connecting&&h.refreshed==1,"Success refreshes");
  h.connect();check(h.refreshed==2&&h.client.starts==2,"Ready service refreshes without reconnecting");
  h=new BillingConnectionHarness();h.connect();h.client.callback.onBillingSetupFinished(new BillingResult(6));
  check(!h.connecting&&h.published==1&&h.message.contains("unavailable"),"Failed setup is recoverable");
  h=new BillingConnectionHarness();h.connect();h.client.callback.onBillingSetupFinished(null);
  check(!h.connecting&&h.published==1,"Null setup response must not crash");
  h=new BillingConnectionHarness();h.connect();h.closed=true;h.client.callback.onBillingSetupFinished(new BillingResult(0));
  check(h.refreshed==0&&h.published==0,"Destroyed Activity ignores callback");
  h=new BillingConnectionHarness();h.connect();h.busy=true;h.finishing.add("r");h.catalog.put("p","v");
  h.client.callback.onBillingServiceDisconnected();
  check(!h.busy&&!h.connecting&&h.finishing.isEmpty()&&h.catalog.isEmpty()&&h.refreshEpoch==1&&h.billingSessionEpoch==1,"Disconnect invalidates session");
  System.out.println("PASS: 9 production Java billing connection tests; no Play transaction or device test");
 }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-connect-'));
try{
 const f=path.join(dir,'BillingConnectionHarness.java');fs.writeFileSync(f,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,f]],['java',['-cp',dir,'BillingConnectionHarness']]]){
  const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
  if(p.stdout)process.stdout.write(p.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

#!/usr/bin/env node
// Exercise the real native accept() committed branch against a Java harness.
// A verified Play callback must invalidate an older in-flight ownership query,
// including when the receipt was already active. No live purchase is simulated.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const from=src.indexOf('private void accept(Purchase p)');
const to=src.indexOf('private boolean persist()',from);
assert(from>=0&&to>from,'Production Play receipt accept() method missing');
const accept=src.slice(from,to);
const match=accept.match(/if\(!persist\(\)\)\{[^}]*\}\s*else\s*\{([\s\S]*?)\n\s*\}\s*publish\(\);/);
assert(match,'Cannot extract receipt-commit success branch from production');
assert(src.includes('final int receiptsAtQuery=acceptedReceiptEpoch;'),'Missing ownership-query start epoch');
assert(src.includes('final boolean staleOwnership=receiptsAtQuery!=acceptedReceiptEpoch;'),
 'Missing stale-query reconciliation guard');
const java=`
public class NativeBillingReceiptRaceHarness {
 int acceptedReceiptEpoch;
 String message="";
 void committed(boolean newlyActive,boolean persistSucceeded){
  if(!persistSucceeded)return;
  ${match[1]}
 }
 static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
 public static void main(String[] args){
  NativeBillingReceiptRaceHarness h=new NativeBillingReceiptRaceHarness();
  final int queryStart=h.acceptedReceiptEpoch;
  h.committed(false,true);
  check(h.acceptedReceiptEpoch>queryStart,
   "Previously active receipt reverified after query start must invalidate stale query");
  check(h.acceptedReceiptEpoch==1,"One verified commit advances exactly one epoch");
  check(h.message.contains("Verified"),"Success message remains available");
  h.committed(true,true);
  check(h.acceptedReceiptEpoch==2,"New receipt also invalidates stale query");
  h.committed(false,false);
  check(h.acceptedReceiptEpoch==2,"Failed persistence cannot advance epoch");
  h.committed(false,true);
  check(h.acceptedReceiptEpoch==3,"Repeated verified callback advances freshness epoch");
  System.out.println("PASS: verified receipt revalidation, new grant, failed persistence, repeated callback, and stale query invalidation (no live Play purchase)");
 }
}`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-billing-epoch-'));
try{
 const file=path.join(dir,'NativeBillingReceiptRaceHarness.java');
 fs.writeFileSync(file,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,file]],
                          ['java',['-cp',dir,'NativeBillingReceiptRaceHarness']]]){
  const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
  if(p.stdout)process.stdout.write(p.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

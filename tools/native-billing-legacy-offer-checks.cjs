#!/usr/bin/env node
// Execute the actual Billing 9 offer() Java method against deterministic fake products.
// The multi-offer list is nullable for ordinary one-time products. No real payments.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const start=source.indexOf('private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p)');
const end=source.indexOf('private void publish()',start);
assert(start>=0&&end>start,'Production Billing 9 offer selector missing');
const method=source.slice(start,end);
const java=`import java.util.*;
public class BillingLegacyOfferHarness {
 static class ProductDetails {
   List<OneTimePurchaseOfferDetails> offers;
   OneTimePurchaseOfferDetails legacy;
   ProductDetails(List<OneTimePurchaseOfferDetails> o,OneTimePurchaseOfferDetails l){offers=o;legacy=l;}
   List<OneTimePurchaseOfferDetails> getOneTimePurchaseOfferDetailsList(){return offers;}
   OneTimePurchaseOfferDetails getOneTimePurchaseOfferDetails(){return legacy;}
   static class OneTimePurchaseOfferDetails {
     final String id,token; final boolean rent,pre;
     OneTimePurchaseOfferDetails(String i,String t,boolean r,boolean p){id=i;token=t;rent=r;pre=p;}
     Object getRentalDetails(){return rent?new Object():null;}
     Object getPreorderDetails(){return pre?new Object():null;}
     String getOfferId(){return id;}
     String getOfferToken(){return token;}
   }
 }
 ${method}
 static void check(boolean condition,String description){if(!condition)throw new AssertionError(description);}
 static ProductDetails.OneTimePurchaseOfferDetails offer(String id,String token,boolean rent,boolean pre){
   return new ProductDetails.OneTimePurchaseOfferDetails(id,token,rent,pre);
 }
 public static void main(String[] args){
   BillingLegacyOfferHarness h=new BillingLegacyOfferHarness();
   var buy=offer(null,"buy-token",false,false);
   check(h.offer(new ProductDetails(null,buy))==buy,"legacy single-offer buy must work");
   check(h.offer(new ProductDetails(null,null))==null,"missing legacy offer rejected");
   check(h.offer(new ProductDetails(null,offer(null,"rent",true,false)))==null,"legacy rental rejected");
   check(h.offer(new ProductDetails(null,offer(null,"pre",false,true)))==null,"legacy preorder rejected");
   check(h.offer(new ProductDetails(null,offer(null,null,false,false)))==null,"null legacy token rejected");
   check(h.offer(new ProductDetails(null,offer(null,"",false,false)))==null,"empty legacy token rejected");
   check(h.offer(new ProductDetails(Collections.emptyList(),buy))==null,"empty eligible list cannot use stale fallback");
   var eligible=offer("discount","discount-token",false,false);
   check(h.offer(new ProductDetails(Arrays.asList(null,offer(null,"r",true,false),eligible),buy))==eligible,"skip null and rental offers");
   check(h.offer(new ProductDetails(Arrays.asList(eligible,buy),null))==buy,"prefer standard buy offer");
   check(h.offer(new ProductDetails(Arrays.asList(offer(null,"",false,false),eligible),null))==eligible,"skip missing offer token");
   check(h.offer(new ProductDetails(Arrays.asList(offer(null,"r",true,false),offer(null,"p",false,true)),null))==null,"rental and preorder only rejected");
   check(h.offer(null)==null,"null ProductDetails rejected");
   System.out.println("PASS: 12 production Java Billing 9 legacy/multi-offer scenarios; no Play payment or device test");
 }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-legacy-offers-'));
try {
 const filename=path.join(dir,'BillingLegacyOfferHarness.java');fs.writeFileSync(filename,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,filename]],['java',['-cp',dir,'BillingLegacyOfferHarness']]]){
  const r=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,bin+' failed: '+(r.stderr||r.stdout||r.error));
  if(r.stdout)process.stdout.write(r.stdout);
 }
} finally {fs.rmSync(dir,{recursive:true,force:true});}

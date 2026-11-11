#!/usr/bin/env node
'use strict';
// Compile and run the actual production Play Billing offer() method with Java
// fakes. No Google Play purchase, Android device, or Play account is used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const start=src.indexOf('private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p)');
const end=src.indexOf('private void publish()',start);
assert(start>=0&&end>start,'Production Billing offer selector missing');
const method=src.slice(start,end);
const java=[
'import java.util.*;',
'public class BillingOfferRuntimeHarness {',
' static class ProductDetails {',
'  final List<OneTimePurchaseOfferDetails> offers;',
'  final OneTimePurchaseOfferDetails legacy;',
'  ProductDetails(List<OneTimePurchaseOfferDetails> offers,OneTimePurchaseOfferDetails legacy){this.offers=offers;this.legacy=legacy;}',
'  List<OneTimePurchaseOfferDetails> getOneTimePurchaseOfferDetailsList(){return offers;}',
'  OneTimePurchaseOfferDetails getOneTimePurchaseOfferDetails(){return legacy;}',
'  static class OneTimePurchaseOfferDetails {',
'   final String id,token;final boolean rental,preorder;',
'   OneTimePurchaseOfferDetails(String id,String token,boolean rental,boolean preorder){',
'    this.id=id;this.token=token;this.rental=rental;this.preorder=preorder;',
'   }',
'   String getOfferId(){return id;}',
'   String getOfferToken(){return token;}',
'   Object getRentalDetails(){return rental?new Object():null;}',
'   Object getPreorderDetails(){return preorder?new Object():null;}',
'  }',
' }',
method,
' static ProductDetails.OneTimePurchaseOfferDetails o(String id,String token,boolean rental,boolean preorder){',
'  return new ProductDetails.OneTimePurchaseOfferDetails(id,token,rental,preorder);',
' }',
' static ProductDetails p(List<ProductDetails.OneTimePurchaseOfferDetails> list,ProductDetails.OneTimePurchaseOfferDetails legacy){',
'  return new ProductDetails(list,legacy);',
' }',
' static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);}',
' public static void main(String[] args){',
'  BillingOfferRuntimeHarness harness=new BillingOfferRuntimeHarness();',
'  ProductDetails.OneTimePurchaseOfferDetails buy=o(null,"standard-token",false,false);',
'  ProductDetails.OneTimePurchaseOfferDetails promo=o("launch-offer","promo-token",false,false);',
'  ProductDetails.OneTimePurchaseOfferDetails rental=o(null,"rental-token",true,false);',
'  ProductDetails.OneTimePurchaseOfferDetails preorder=o(null,"preorder-token",false,true);',
'  check(harness.offer(null)==null,"No product must never produce checkout");',
'  check(harness.offer(p(null,null))==null,"Null options without legacy remain unavailable");',
'  check(harness.offer(p(null,buy))==buy,"Null eligible list can use safe compatible buy option");',
'  check(harness.offer(p(Collections.emptyList(),buy))==buy,"Empty eligible list can use safe compatible buy option");',
'  check(harness.offer(p(Collections.emptyList(),null))==null,"Empty options without fallback remain unavailable");',
'  check(harness.offer(p(Collections.emptyList(),rental))==null,"Never fall back to a rental");',
'  check(harness.offer(p(Collections.emptyList(),preorder))==null,"Never fall back to a preorder");',
'  check(harness.offer(p(Collections.emptyList(),o(null,"",false,false)))==null,"Never fall back without a token");',
'  check(harness.offer(p(Collections.emptyList(),o(null,null,false,false)))==null,"Null fallback token cannot open checkout");',
'  check(harness.offer(p(Arrays.asList(promo,buy),null))==buy,"Prefer regular buy over limited offer");',
'  check(harness.offer(p(Arrays.asList(promo),null))==promo,"Accept eligible promotional offer if standard absent");',
'  check(harness.offer(p(Arrays.asList(null,rental,preorder,o(null,"",false,false),promo),null))==promo,',
'    "Skip null, rental, preorder, missing-token entries");',
'  check(harness.offer(p(Arrays.asList(rental,preorder),buy))==null,',
'    "Do not replace an explicit ineligible multi-offer list with an unverified fallback");',
'  check(harness.offer(p(Arrays.asList(promo,buy),promo))==buy,"The list has precedence over legacy");',
'  System.out.println("PASS: 14 production Java Play Billing offer scenarios (null/empty offers, immediate buy fallback, rental/preorder rejection, token and priority checks). No Play checkout.");',
' }',
'}'
].join('\n');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-billing-offers-'));
try{
 const file=path.join(temp,'BillingOfferRuntimeHarness.java');fs.writeFileSync(file,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',temp,file]],['java',['-cp',temp,'BillingOfferRuntimeHarness']]]){
  const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
  if(p.stdout)process.stdout.write(p.stdout);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}

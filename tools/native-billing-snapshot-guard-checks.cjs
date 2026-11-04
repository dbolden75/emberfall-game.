#!/usr/bin/env node
// Exercise production Java publish() with malformed Play product rows (no live purchase).
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert');
const s=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const a=s.indexOf('private void publish(){'),b=s.indexOf('@JavascriptInterface public String state()',a);
assert(a>=0&&b>a,'Missing production publish method');
const java=`import java.util.*;
public class BillingSnapshotGuard {
 static class JSONObject {
  Map<String,Object> m=new LinkedHashMap<>();
  JSONObject put(String k,Object v){m.put(k,v);return this;}
  JSONObject optJSONObject(String k){return (JSONObject)m.get(k);}
  String getString(String k){return m.get(k).toString();}
  String optString(String k){return m.getOrDefault(k,"").toString();}
  boolean optBoolean(String k){return Boolean.TRUE.equals(m.get(k));}
  Iterator<String> keys(){return m.keySet().iterator();}
  public String toString(){return m.toString();}
 }
 static class JSONArray {List<Object> l=new ArrayList<>();JSONArray put(Object v){l.add(v);return this;} public String toString(){return l.toString();}}
 static class AccountIdentifiers {String getObfuscatedProfileId(){return "";}}
 static class Purchase {String signature;Purchase(String j,String s){signature=s;}String getPurchaseToken(){return "TOKEN";}List<String> getProducts(){return Arrays.asList("emberfall_bundle_founder");}AccountIdentifiers getAccountIdentifiers(){return null;}}
 static class ProductDetails {
  String id;int mode; ProductDetails(String id,int m){this.id=id;mode=m;}
  String getProductId(){return id;}
  static class OneTimePurchaseOfferDetails {int mode;OneTimePurchaseOfferDetails(int m){mode=m;}String getFormattedPrice(){if(mode==2)throw new RuntimeException("broken price");return "$2.49";}}
 }
 Map<String,ProductDetails> catalog=new LinkedHashMap<>();JSONObject receipts=new JSONObject();
 String message="Play available",snapshot="";boolean busy;
 ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p){if(p.mode==1)throw new RuntimeException("broken offer");return new ProductDetails.OneTimePurchaseOfferDetails(p.mode);}
 boolean valid(Purchase p){return "good".equals(p.signature);}
 String hash(String s){return "HASH";}
 boolean consumable(String s){return s.startsWith("thornhaven_");}
 <<METHOD>>
 BillingSnapshotGuard(){receipts.put("verified",new JSONObject().put("id","HASH").put("token","TOKEN").put("product","emberfall_bundle_founder").put("json","signed").put("signature","good").put("active",true));}
 void check(){publish();if(!snapshot.contains("emberfall_bundle_founder")||!snapshot.contains("$2.49"))throw new AssertionError(snapshot);}
 public static void main(String[]args){
  BillingSnapshotGuard h=new BillingSnapshotGuard();
  h.catalog.put("okay",new ProductDetails("emberfall_aura_embers",0));h.check();
  h.catalog.put("bad-offer",new ProductDetails("bad",1));h.check();
  h.catalog.remove("bad-offer");h.catalog.put("bad-price",new ProductDetails("bad",2));h.check();
  System.out.println("PASS: production Java publish retains verified entitlements and valid prices despite malformed Play offers/prices");
 }
}
`.replace('<<METHOD>>',s.slice(a,b));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-billing-snapshot-'));
try{
 const file=path.join(dir,'BillingSnapshotGuard.java');fs.writeFileSync(file,java);
 for(const [bin,args] of [['javac',['-d',dir,file]],['java',['-cp',dir,'BillingSnapshotGuard']]]){
  const r=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,bin+': '+r.stderr+r.stdout);
  if(r.stdout)process.stdout.write(r.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

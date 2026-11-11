#!/usr/bin/env node
'use strict';
// Exercise the actual production invalidation method in Java, not a reimplementation.
// No Android, Play account, or transaction is used here.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const start=src.indexOf('private void invalidateCatalogForRefresh()');
const end=src.indexOf('private void refresh(){',start);
assert(start>0&&end>start,'Production stale-catalog invalidation method missing');
const method=src.slice(start,end);
const refresh=src.slice(end,src.indexOf('private void reconcileActiveOwnedPurchases(',end));
assert.match(refresh,/final int epoch=\+\+refreshEpoch;\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*invalidateCatalogForRefresh\(\);/,
  'Each Play refresh must invalidate stale prices before starting an async query');
assert.match(refresh,/if\(closed\|\|!client\.isReady\(\)\|\|epoch!=refreshEpoch\)return;/,
  'Stale Play query callbacks must remain rejected');
const java=[
'import java.util.*;',
'public class BillingRefreshHarness {',
' Map<String,String> catalog=new LinkedHashMap<>();',
' Map<String,String> receipts=new LinkedHashMap<>();',
' String message="Ready";',
' String snapshot="";',
' void publish(){ snapshot="offers="+catalog.toString()+";owned="+receipts.toString()+";message="+message; }',
method,
' static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}',
' public static void main(String[] args){',
'  BillingRefreshHarness h=new BillingRefreshHarness();',
'  h.catalog.put("accountA_old_offer","$2.99");',
'  h.receipts.put("verified_character_title","owned");',
'  h.publish();',
'  check(h.snapshot.contains("accountA_old_offer"),"fixture must expose stale offer before refresh");',
'  h.invalidateCatalogForRefresh();',
'  check(h.catalog.isEmpty(),"old account/Play session offers must be cleared");',
'  check(!h.snapshot.contains("accountA_old_offer"),"UI snapshot must lose stale checkout offers immediately");',
'  check(h.snapshot.contains("verified_character_title=owned"),"clearing offers must preserve verified receipts");',
'  check(h.snapshot.contains("temporarily unavailable"),"a pending refresh must not say checkout is ready");',
'  h.catalog.put("new_offer","$1.49");h.publish();',
'  h.invalidateCatalogForRefresh();',
'  check(!h.snapshot.contains("new_offer"),"repeated refresh must also remove new stale offers");',
'  h.invalidateCatalogForRefresh();',
'  check(h.catalog.isEmpty()&&h.receipts.size()==1,"no offers and persisted entitlement on empty/repeated refresh");',
'  System.out.println("PASS: production Play catalog refresh invalidation removes stale checkout choices, updates snapshot and preserves receipts.");',
' }',
'}'
].join('\n');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-billing-refresh-'));
try{
 const javaFile=path.join(tmp,'BillingRefreshHarness.java');fs.writeFileSync(javaFile,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',tmp,javaFile]],['java',['-cp',tmp,'BillingRefreshHarness']]]){
   const run=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
   assert.equal(run.status,0,bin+' failed: '+(run.stderr||run.stdout||run.error));
   if(run.stdout)process.stdout.write(run.stdout);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

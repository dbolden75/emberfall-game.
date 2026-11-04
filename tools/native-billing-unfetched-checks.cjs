// Exercise the actual production Billing 9 diagnostic helper with fake
// Play responses. This does not contact Google Play or complete purchases.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const marker='private static String unfetchedProductStatus(QueryProductDetailsResult result)';
const start=src.indexOf(marker);assert(start>=0,'Missing native Play unavailable-product diagnostic');
const brace=src.indexOf('{',start);let depth=0,end=-1;
for(let i=brace;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&!--depth){end=i+1;break;}}
assert(end>brace,'Unbalanced native diagnostic helper');
const method=src.slice(start,end);
const refresh=src.slice(src.indexOf('private void refresh(){'),src.indexOf('private static String hash('));
assert(refresh.includes('unfetchedProductStatus(result)'),
  'Successful product query must display unavailable-product reasons');
const java=`
import java.util.*;
public class UnfetchedHarness {
 static class UnfetchedProduct {
  static class StatusCode {static final int PRODUCT_NOT_FOUND=3,NO_ELIGIBLE_OFFER=4;}
  final int code;UnfetchedProduct(int c){code=c;}int getStatusCode(){return code;}
 }
 static class QueryProductDetailsResult {
  final List<UnfetchedProduct> missing;
  QueryProductDetailsResult(List<UnfetchedProduct> m){missing=m;}
  List<UnfetchedProduct> getUnfetchedProductList(){return missing;}
 }
 ${method}
 static void check(boolean value,String why){if(!value)throw new AssertionError(why);}
 public static void main(String[] args){
  check(unfetchedProductStatus(null).isEmpty(),"Null result must not crash");
  check(unfetchedProductStatus(new QueryProductDetailsResult(null)).isEmpty(),"Null list must not crash");
  check(unfetchedProductStatus(new QueryProductDetailsResult(List.of())).isEmpty(),"Complete catalog has no warning");
  String report=unfetchedProductStatus(new QueryProductDetailsResult(Arrays.asList(new UnfetchedProduct(3),new UnfetchedProduct(3),new UnfetchedProduct(4),new UnfetchedProduct(0),null)));
  check(report.contains("4 Play item(s) unavailable")&&report.contains("2 not found")&&report.contains("1 with no eligible offer")&&report.contains("1 other"),"Unavailable reasons must be accurate");
  check(!report.contains("token")&&!report.contains("profile"),"No private purchase identifiers in diagnostics");
  System.out.println("PASS: Billing 9 product diagnostics across null, complete and mixed Play responses (no live checkout).");
 }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-unfetched-'));
try{
 const file=path.join(dir,'UnfetchedHarness.java');fs.writeFileSync(file,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,file]],['java',['-cp',dir,'UnfetchedHarness']]]){
  const p=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,bin+' failed: '+(p.stderr||p.stdout||p.error));
  if(p.stdout)process.stdout.write(p.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

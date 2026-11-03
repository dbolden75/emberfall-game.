// Run the exact native ownership-reconciliation method against a Java
// SharedPreferences failure harness. No Play account or device is simulated.
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const marker='private void reconcileActiveOwnedPurchases(Set<String> active)';
const start=source.indexOf(marker);
assert(start>=0,'Production owned-purchase reconciliation method must exist');
const brace=source.indexOf('{',start);
let depth=0,end=-1;
for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&!--depth){end=i+1;break;}
}
assert(end>brace,'Production reconciliation method must have closing brace');
const productionMethod=source.slice(start,end);
const java=`
import java.util.*;
public class OwnershipHarness {
  static class JSONObject {
    final Map<String,Object> values=new LinkedHashMap<>();
    JSONObject put(String key,Object value){values.put(key,value);return this;}
    JSONObject optJSONObject(String key){
      Object v=values.get(key);
      return v instanceof JSONObject?(JSONObject)v:null;
    }
    boolean optBoolean(String key){return Boolean.TRUE.equals(values.get(key));}
    String optString(String key){return String.valueOf(values.getOrDefault(key,""));}
    Iterator<String> keys(){return values.keySet().iterator();}
  }
  final JSONObject receipts=new JSONObject();
  boolean storageAccepts=true, storageThrows=false;
  int persistenceCalls;
  String message="unchanged";
  static boolean consumable(String product){return product.startsWith("thornhaven_");}
  boolean persist(){
    persistenceCalls++;
    if(storageThrows)throw new IllegalStateException("Device full");
    return storageAccepts;
  }
  ${productionMethod}
  static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
  static OwnershipHarness sample(){
    OwnershipHarness h=new OwnershipHarness();
    h.receipts.put("owned",new JSONObject().put("id","owned").put("product","emberfall_title_champion").put("active",true));
    h.receipts.put("missing",new JSONObject().put("id","missing").put("product","emberfall_aura_arcane").put("active",false));
    h.receipts.put("consumable",new JSONObject().put("id","consumable").put("product","thornhaven_builder_contract_25_15m").put("active",true));
    return h;
  }
  JSONObject receipt(String id){return receipts.optJSONObject(id);}
  void checkRestored(){
    check(receipt("owned").optBoolean("active"),"Previously owned receipt must remain active on failure");
    check(!receipt("missing").optBoolean("active"),"Previously revoked receipt must remain inactive on failure");
    check(receipt("consumable").optBoolean("active"),"Consumable receipt must be unchanged");
  }
  public static void main(String[] args){
    OwnershipHarness h=sample();
    h.reconcileActiveOwnedPurchases(new HashSet<>(Arrays.asList("missing")));
    check(!h.receipt("owned").optBoolean("active"),"Persisted Play revocation must mark absent receipt inactive");
    check(h.receipt("missing").optBoolean("active"),"Persisted Play ownership must activate returned receipt");
    check(h.receipt("consumable").optBoolean("active"),"Reconciliation must not revoke consumables");
    check(h.persistenceCalls==1,"Successful reconciliation must commit");
    check(h.message.equals("unchanged"),"Successful reconciliation must not display a storage error");

    h=sample();h.storageAccepts=false;
    h.reconcileActiveOwnedPurchases(new HashSet<>(Arrays.asList("missing")));
    h.checkRestored();
    check(h.persistenceCalls==1 && h.message.contains("could not be saved"),
      "Failed commit must roll back in-memory flags and tell the player");

    h=sample();h.storageThrows=true;
    h.reconcileActiveOwnedPurchases(new HashSet<>(Arrays.asList("missing")));
    h.checkRestored();
    check(h.persistenceCalls==1 && h.message.contains("could not be saved"),
      "Thrown commit must roll back flags and report storage error");

    h=sample();
    h.reconcileActiveOwnedPurchases(new HashSet<>(Arrays.asList("owned")));
    check(h.receipt("owned").optBoolean("active") && !h.receipt("missing").optBoolean("active"),
      "Unchanged ownership query must preserve valid flags");
    h=sample();h.receipts.put("malformed","old corrupt record");
    h.reconcileActiveOwnedPurchases(new HashSet<>(Arrays.asList("owned")));
    check(h.receipts.values.get("malformed").equals("old corrupt record"),
      "Malformed historical receipt must remain untouched");
    check(h.persistenceCalls==1,"Malformed receipt must not prevent valid receipts being reconciled");
    System.out.println("PASS: 5 native ownership reconciliation scenarios, including false/throwing persistence and malformed receipt");
  }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-ownership-'));
try{
  const file=path.join(dir,'OwnershipHarness.java');
  fs.writeFileSync(file,java,'utf8');
  for(const [cmd,args] of [['javac',['-encoding','UTF-8','-d',dir,file]],['java',['-cp',dir,'OwnershipHarness']]]){
    const p=cp.spawnSync(cmd,args,{encoding:'utf8',timeout:30000});
    assert.equal(p.status,0,cmd+' failed: '+(p.stderr||p.stdout||p.error));
    if(p.stdout)process.stdout.write(p.stdout);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

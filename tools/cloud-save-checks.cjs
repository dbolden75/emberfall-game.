const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
class Storage {
 constructor(values={}){this.data=new Map(Object.entries(values));this.fail=null;}
 getItem(k){return this.data.has(k)?this.data.get(k):null;}
 setItem(k,v){if(k===this.fail)throw Error('QuotaExceededError');this.data.set(k,String(v));}
 removeItem(k){this.data.delete(k);}
}
function row(name='Cloud hero',updated=100){return {id:'slot1',name,class:'warrior',level:9,updated,state:{player:{name,class:'warrior',level:9,coins:543,inventory:[{id:'iron',count:12}],weapon:'iron_sword',armor:'leather',xp:27},mapId:'elderwood',companions:[{id:'dalen',hp:20,active:true}],mapStates:{elderwood:{enemies:[{alive:false,lootClaimed:true}],gatherNodes:[123]}},townQuestState:{questA:true,_localExploration:{elderwood:{'1,2':true}},_playReceipts:{receipt:'paid-item'}},houseStorage:{ashvale:{wood:10}},gatheringSkills:{mining:3},ownedHomes:{ashvale:true}}};}
const slots={slot1:row(),slot3:{...row('Second hero',200),id:'slot3'}};
const text=core.encode(slots,'slot3',300);
const phoneA=new Storage({[core.SLOT_KEY]:JSON.stringify(slots)}),phoneB=new Storage();
core.restore(phoneB,text,{confirmed:true,expectedCurrent:null});
assert.deepEqual(JSON.parse(phoneB.getItem(core.SLOT_KEY)),JSON.parse(phoneA.getItem(core.SLOT_KEY)));
console.log('PASS: transfer between simulated device stores preserves characters, inventory, equipment, quests, crowns, pets, purchase state and world progress.');
const older=core.encode({slot1:row('Older',50)},'slot1',500);
const before=phoneA.getItem(core.SLOT_KEY);
assert.throws(()=>core.restore(phoneA,text),/Confirm/);
assert.throws(()=>core.restore(phoneA,older,{confirmed:true}),/older/);
assert.equal(phoneA.getItem(core.SLOT_KEY),before);
assert.throws(()=>core.restore(phoneA,text,{confirmed:true,expectedCurrent:'stale'}),/changed/);
core.restore(phoneA,older,{confirmed:true,allowOlder:true,expectedCurrent:before});
assert.deepEqual(core.parse(core.recoveryText(phoneA)).slots,slots);
const recovery=core.recoveryText(phoneA);core.restore(phoneA,recovery,{confirmed:true,allowOlder:true});
assert.deepEqual(JSON.parse(phoneA.getItem(core.SLOT_KEY)),slots);
console.log('PASS: confirmation, older/missing-slot warnings, concurrent local changes and recovery restore.');
for(const fail of [core.RECOVERY_KEY,core.SLOT_KEY]){
 const store=new Storage({[core.SLOT_KEY]:before});store.fail=fail;
 assert.throws(()=>core.restore(store,older,{confirmed:true,allowOlder:true}),/Quota/);
 assert.equal(store.getItem(core.SLOT_KEY),before);
}
console.log('PASS: recovery-write and final-commit storage failures leave local progress intact.');
for(const bad of ['not json','{}',text.replace('"schema":1','"schema":99'),text.replace('Cloud hero','<img src=x>'),text.replace('"slots":{','"__proto__":{"polluted":true},"slots":{'),text.replaceAll('"level":9','"level":-1'),text.replace('"mapStates":{','"mapStates":null,"discarded":{')])assert.throws(()=>core.parse(bad));
assert.throws(()=>core.parse(' '.repeat(core.MAX_BYTES+1)),/8 MB/);
assert.equal({}.polluted,undefined);
assert.throws(()=>core.encode({},'slot1'),/no saved characters/);
console.log('PASS: corrupt, future-format, unsafe, oversized and incomplete backups rejected.');


const selectionBefore=new Storage({
 [core.SLOT_KEY]:JSON.stringify(slots),[core.ACTIVE_SLOT_KEY]:'slot3'
});
const fallbackBackup=core.encode({slot1:row('Only first',300)},'slot3',500);
core.restore(selectionBefore,fallbackBackup,{confirmed:true,allowOlder:true});
assert.equal(selectionBefore.getItem(core.ACTIVE_SLOT_KEY),'slot1',
 'Missing backup active slot must safely choose an available imported character');
assert.equal(core.parse(core.recoveryText(selectionBefore)).activeSlot,'slot3',
 'Recovery must remember the previously selected character');
const selectedBackup=core.encode(slots,'slot3',500);
core.restore(selectionBefore,selectedBackup,{confirmed:true,allowOlder:true});
assert.equal(selectionBefore.getItem(core.ACTIVE_SLOT_KEY),'slot3',
 'Import must select the backup character rather than a stale local slot');
for(const failedKey of [core.RECOVERY_KEY,core.ACTIVE_SLOT_KEY,core.SLOT_KEY]){
 const beforeSlots=JSON.stringify({slot1:row('Current',200)});
 const safeStore=new Storage({[core.SLOT_KEY]:beforeSlots,[core.ACTIVE_SLOT_KEY]:'slot1'});
 safeStore.fail=failedKey;
 assert.throws(()=>core.restore(safeStore,selectedBackup,{confirmed:true,allowOlder:true}),/Quota/);
 assert.equal(safeStore.getItem(core.SLOT_KEY),beforeSlots,
  'Failed import must never overwrite current character slots');
 assert.equal(safeStore.getItem(core.ACTIVE_SLOT_KEY),'slot1',
  'Failed import must preserve original character selection');
}
const noPriorActive=new Storage({[core.SLOT_KEY]:JSON.stringify({slot1:row('Current',200)})});
noPriorActive.fail=core.SLOT_KEY;
assert.throws(()=>core.restore(noPriorActive,selectedBackup,{confirmed:true,allowOlder:true}),/Quota/);
assert.equal(noPriorActive.getItem(core.ACTIVE_SLOT_KEY),null,
 'Rollback must remove a newly written active preference when none existed');
console.log('PASS: selected character restored, backed up, and preserved across failed backup imports.');


const fs=require('node:fs');
const activity=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/MainActivity.java','utf8');
const bridge=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/CloudSaveDocuments.java','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const ui=fs.readFileSync('app/src/main/assets/cloud-save.js','utf8');
assert.match(activity,/addJavascriptInterface\(cloudSave, "ThornhavenCloudSave"\)/);
assert.match(activity,/cloudSave\.onActivityResult\(requestCode, resultCode, data\)/);
for(const method of ['save','load','manage'])assert(bridge.includes('public void '+method+'('));
assert.match(bridge, /public void load\(String requestId, String ignoredText\)/, 'Load must accept two JS bridge arguments');
assert.match(bridge, /public void manage\(String requestId, String ignoredText\)/, 'Manage must accept two JS bridge arguments');
for(const intent of ['Intent.ACTION_CREATE_DOCUMENT','Intent.ACTION_OPEN_DOCUMENT'])assert(bridge.includes(intent));
assert(bridge.includes('MAX_BYTES = 8 * 1024 * 1024'));
assert(bridge.includes('output.write(request.bytes)'));
assert(bridge.includes('input.read(buffer)'));
assert(bridge.includes("thornhavenCloudResult"));
assert(ui.includes('core.restore(localStorage,pending,{confirmed:true'));
assert(!manifest.includes('android.permission.WRITE_EXTERNAL_STORAGE'));
console.log('PASS: Android backup bridge uses user-selected documents, capped I/O, and explicit restore review without broad storage permissions.');


// A damaged/truncated pre-existing local slot store must not make Cloud Save
// restoration impossible. Warn and require explicit consent; preserve the
// exact original bytes in the recovery record before changing any slots.
for(const raw of ['{truncated', 'null', '[1,2]', '{"slot1":null}', '{"slot1":{"updated":"bad"}}']){
 const local=new Storage({[core.SLOT_KEY]:raw,[core.ACTIVE_SLOT_KEY]:'slot3'});
 assert.equal(core.readLocal(raw).unreadable,true);
 assert.throws(()=>core.restore(local,text,{confirmed:true,expectedCurrent:raw}),/unreadable/);
 assert.equal(local.getItem(core.SLOT_KEY),raw,'Unsafe replacement without consent');
 assert.equal(local.getItem(core.RECOVERY_KEY),null,'Warning must not write recovery');
 core.restore(local,text,{confirmed:true,allowOlder:true,expectedCurrent:raw});
 assert.deepEqual(JSON.parse(local.getItem(core.SLOT_KEY)),slots);
 assert.equal(JSON.parse(local.getItem(core.RECOVERY_KEY)).slots,raw,
  'Recovery copy must retain original malformed local slot bytes');
 assert.equal(local.getItem(core.ACTIVE_SLOT_KEY),'slot3');
}
assert.equal(core.readLocal(null).unreadable,false);
assert.deepEqual(core.readLocal('{}').slots,{});
assert.match(fs.readFileSync('app/src/main/assets/cloud-save.js','utf8'),/core\.readLocal\(expected\)/,
 'Backup review must also warn on damaged local slots before requesting consent');
console.log('PASS: unreadable historical local slots can be explicitly recovered without silently overwriting local bytes.');


// Regression: a valid JSON object with a numeric timestamp can still contain
// an unusable save row. Do not silently overwrite it without the separate
// damaged-local-data consent, and preserve the exact original JSON bytes.
for(const raw of [
 '{"slot1":{"id":"slot1","updated":100}}',
 '{"slot1":{"id":"slot1","updated":100,"state":null}}',
 JSON.stringify({slot1:{...row(),updated:null}}),
 JSON.stringify({slot1:{...row(),id:'slot2'}}),
 JSON.stringify({slot1:{...row(),state:{...row().state,player:null}}}),
 JSON.stringify({slot1:{...row(),state:{...row().state,mapStates:null}}})
]){
 const local=new Storage({[core.SLOT_KEY]:raw,[core.ACTIVE_SLOT_KEY]:'slot1'});
 assert.equal(core.readLocal(raw).unreadable,true,'Malformed valid-JSON save must be flagged');
 assert.throws(()=>core.restore(local,text,{confirmed:true,expectedCurrent:raw}),/unreadable/);
 assert.equal(local.getItem(core.SLOT_KEY),raw,'Refusal must retain the malformed local data');
 assert.equal(local.getItem(core.RECOVERY_KEY),null,'Refusal must not mutate recovery');
 core.restore(local,text,{confirmed:true,allowOlder:true,expectedCurrent:raw});
 assert.deepEqual(JSON.parse(local.getItem(core.SLOT_KEY)),slots);
 assert.equal(JSON.parse(local.getItem(core.RECOVERY_KEY)).slots,raw,
  'Explicitly-approved restore must preserve the original malformed bytes');
}
assert.equal(core.readLocal(JSON.stringify(slots)).unreadable,false,
 'Historical 1.0.57-shaped character rows must continue to be readable');
console.log('PASS: malformed valid-JSON local rows need additional consent; history preserved byte-for-byte.');

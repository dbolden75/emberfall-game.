const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
class Storage {
 constructor(values={}){this.data=new Map(Object.entries(values));this.fail=null;}
 getItem(k){return this.data.has(k)?this.data.get(k):null;}
 setItem(k,v){if(k===this.fail)throw Error('QuotaExceededError');this.data.set(k,String(v));}
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


const fs=require('node:fs');
const activity=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/MainActivity.java','utf8');
const bridge=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/CloudSaveDocuments.java','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const ui=fs.readFileSync('app/src/main/assets/cloud-save.js','utf8');
assert.match(activity,/addJavascriptInterface\(cloudSave, "ThornhavenCloudSave"\)/);
assert.match(activity,/cloudSave\.onActivityResult\(requestCode, resultCode, data\)/);
for(const method of ['save','load','manage'])assert(bridge.includes('public void '+method+'('));
for(const intent of ['Intent.ACTION_CREATE_DOCUMENT','Intent.ACTION_OPEN_DOCUMENT'])assert(bridge.includes(intent));
assert(bridge.includes('MAX_BYTES = 8 * 1024 * 1024'));
assert(bridge.includes('output.write(request.bytes)'));
assert(bridge.includes('input.read(buffer)'));
assert(bridge.includes("thornhavenCloudResult"));
assert(ui.includes('core.restore(localStorage,pending,{confirmed:true'));
assert(!manifest.includes('android.permission.WRITE_EXTERNAL_STORAGE'));
console.log('PASS: Android backup bridge uses user-selected documents, capped I/O, and explicit restore review without broad storage permissions.');

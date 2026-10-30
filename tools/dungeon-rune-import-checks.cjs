'use strict';
// Verify a bad Cloud Save cannot silently rewrite shrine rune puzzle progress.
// Exercises the actual release Cloud Save core, not an imitation parser.
const assert = require('node:assert/strict');
const core = require(process.env.THORNHAVEN_CORE_PATH || './cloud-save-core.js');

function slots(progress){
  const state={
    player:{name:'Rune tester',class:'warrior',level:4,coins:25,xp:10,inventory:[]},
    mapId:'ashvale',companions:[],townQuestState:{},
    mapStates:{shrine_rootmaze:{runes:[true,false,false],runeProgress:progress}}
  };
  return {slot1:{id:'slot1',updated:1234,state}};
}
function backup(progress){
  return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1234,
    activeSlot:'slot1',slots:slots(progress)});
}
function local(progress){
  return core.readLocal(JSON.stringify(slots(progress)));
}
const bad=['2','Infinity','false',true,-1,1.25,{},[],Number.MAX_SAFE_INTEGER+1];
for(const invalid of bad){
  assert.throws(()=>core.parse(backup(invalid)),/enemy positions|rune progress|snapshot/i,
    `A corrupted rune sequence counter (${JSON.stringify(invalid)}) must be rejected`);
  assert.equal(local(invalid).unreadable,true,'The same damaged local snapshot must require recovery approval');
}
for(const okay of [null,0,1,2,3,4]){
  assert.doesNotThrow(()=>core.parse(backup(okay)),`Keep legitimate/older rune state: ${okay}`);
  assert.equal(local(okay).unreadable,false);
}
// An invalid incoming snapshot must not replace saved characters or recovery.
const before=JSON.stringify(slots(1));
const memory=new Map([[core.SLOT_KEY,before],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'old recovery']]);
const storage={getItem:k=>memory.has(k)?memory.get(k):null,
  setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
assert.throws(()=>core.restore(storage,backup('2'),{confirmed:true,allowOlder:true}),/enemy positions|rune progress|snapshot/i);
assert.equal(memory.get(core.SLOT_KEY),before,'Existing player must stay byte-for-byte unchanged');
assert.equal(memory.get(core.RECOVERY_KEY),'old recovery','Previous recovery copy must remain available');
console.log('PASS: shrine rune progress import safety, local recovery, and valid older snapshots');

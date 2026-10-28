/* Thornhaven portable save format. No credentials or device-wide storage. */
(function(root){
'use strict';
const SLOT_KEY='emberfall_character_slots_v1',ACTIVE_SLOT_KEY='emberfall_active_character_slot_v1',RECOVERY_KEY='thornhaven.restore-recovery.v1';
const IDS=['slot1','slot2','slot3','slot4'],MAX_BYTES=8*1024*1024;
const clone=v=>JSON.parse(JSON.stringify(v));
function validate(value){
 let nodes=0;
 function visit(v,depth){
  if(++nodes>300000||depth>40)throw Error('Backup is too complex.');
  if(typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid number in backup.');
  if(typeof v==='string'&&(v.length>100000||/[<>]/.test(v)))throw Error('Unsupported text in backup.');
  if(v&&typeof v==='object')for(const k of Object.keys(v)){
   if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe backup field.');visit(v[k],depth+1);
  }
 }
 visit(value,0);
 if(!value||value.format!=='thornhaven-save'||value.schema!==1)throw Error('This is not a supported Thornhaven backup.');
 if(!Number.isSafeInteger(value.createdAt)||value.createdAt<0)throw Error('Invalid backup date.');
 const slots=value.slots;
 if(!slots||Array.isArray(slots)||typeof slots!=='object'||!Object.keys(slots).length)throw Error('Backup has no saved characters.');
 for(const [id,row] of Object.entries(slots)){
  const p=row?.state?.player;
  if(!IDS.includes(id)||row.id!==id||!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!['warrior','rogue','mage','cleric'].includes(p.class))throw Error('Invalid character in backup.');
  if(!Number.isSafeInteger(row.updated)||row.updated<0||!Number.isSafeInteger(p.level)||p.level<1||!Number.isFinite(p.coins)||p.coins<0)throw Error('Invalid character progress.');
  if(!row.state.mapId||typeof row.state.mapId!=='string'||!Array.isArray(row.state.companions)||
   !row.state.mapStates||typeof row.state.mapStates!=='object'||Array.isArray(row.state.mapStates)||
   !row.state.townQuestState||typeof row.state.townQuestState!=='object'||Array.isArray(row.state.townQuestState))throw Error('Incomplete character progress.');
  if(!Array.isArray(p.inventory))throw Error('Invalid character inventory.');
  if(!safeEnemySnapshots(row.state.mapStates))throw Error('Invalid saved enemy positions.');
 }
 return value;
}
// Enemy snapshots are read directly on game startup. A null/invalid enemy
// entry throws inside applySavedGame and prevents the character from loading.
// Older regions without enemy snapshots remain compatible.
function safeEnemySnapshots(mapStates){
 return Object.values(mapStates).every(saved=>{
  if(saved==null)return true;
  if(typeof saved!=='object'||Array.isArray(saved))return false;
  if(saved.enemies===undefined)return true;
  return Array.isArray(saved.enemies)&&saved.enemies.every(e=>
   e&&typeof e==='object'&&!Array.isArray(e)&&
   (e.x===undefined||(typeof e.x==='number'&&Number.isFinite(e.x)))&&
   (e.y===undefined||(typeof e.y==='number'&&Number.isFinite(e.y))));
 });
}
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Backup exceeds 8 MB.');return validate(JSON.parse(text));}
function encode(slots,active,now=Date.now()){
 const data={format:'thornhaven-save',schema:1,createdAt:now,activeSlot:IDS.includes(active)?active:'slot1',slots:clone(slots)};
 const text=JSON.stringify(data);parse(text);return text;
}
// Preserve unreadable pre-existing slots instead of blocking a user-directed recovery.
// Never interpret damaged local data as an empty save without explicit approval.
// Syntactically valid local JSON can still contain unusable character rows.
// Require explicit approval before replacing them and preserve their original bytes.
function readableLocalRow(id,row){
 const state=row?.state,p=state?.player;
 return IDS.includes(id)&&row.id===id&&Number.isSafeInteger(row.updated)&&row.updated>=0&&
  state&&typeof state==='object'&&!Array.isArray(state)&&
  p&&typeof p==='object'&&!Array.isArray(p)&&typeof p.name==='string'&&!!p.name.trim()&&
  ['warrior','rogue','mage','cleric'].includes(p.class)&&
  Number.isSafeInteger(p.level)&&p.level>=1&&Number.isFinite(p.coins)&&p.coins>=0&&
  typeof state.mapId==='string'&&!!state.mapId&&Array.isArray(state.companions)&&
  state.mapStates&&typeof state.mapStates==='object'&&!Array.isArray(state.mapStates)&&
  state.townQuestState&&typeof state.townQuestState==='object'&&!Array.isArray(state.townQuestState)&&
  Array.isArray(p.inventory)&&safeEnemySnapshots(state.mapStates);
}
function readLocal(raw){
 if(raw===null)return {slots:{},unreadable:false};
 try{
  const slots=JSON.parse(raw);
  if(!slots||typeof slots!=='object'||Array.isArray(slots)||
   Object.entries(slots).some(([id,row])=>!readableLocalRow(id,row)))throw Error('Invalid local slots');
  return {slots,unreadable:false};
 }catch(_){return {slots:{},unreadable:true};}
}
function conflicts(incoming,current){return Object.keys(current).filter(id=>!incoming.slots[id]||Number(incoming.slots[id].updated)<Number(current[id].updated));}
function restore(storage,text,{confirmed=false,allowOlder=false,expectedCurrent}={}){
 if(!confirmed)throw Error('Confirm before replacing saved characters.');
 const incoming=parse(text),raw=storage.getItem(SLOT_KEY),local=readLocal(raw),current=local.slots;
 if(expectedCurrent!==undefined&&raw!==expectedCurrent)throw Error('Local progress changed. Review the backup again.');
 if((local.unreadable||conflicts(incoming,current).length)&&!allowOlder)throw Error('This backup is older, omits local characters, or replaces unreadable local saves. Explicit approval is required.');
 // Persist recovery first. If space is unavailable, do not alter the save slots.
 const previousActive=storage.getItem(ACTIVE_SLOT_KEY);
 const chosenActive=IDS.includes(incoming.activeSlot)&&incoming.slots[incoming.activeSlot]
  ?incoming.activeSlot:IDS.find(id=>incoming.slots[id]);
 const recovery=JSON.stringify({format:'thornhaven-recovery',schema:1,createdAt:Date.now(),slots:raw,activeSlot:previousActive});
 // A failed restore must not erase an earlier, still-valuable recovery copy.
 const previousRecovery=storage.getItem(RECOVERY_KEY);
 let wroteRecovery=false,attemptedActive=false;
 try{
  storage.setItem(RECOVERY_KEY,recovery);
  wroteRecovery=true;
  if(storage.getItem(RECOVERY_KEY)!==recovery)throw Error('Could not verify the recovery copy.');
  // Set the imported selection before the single-key slots commit. If that
  // commit fails, the existing slots must remain untouched.
  attemptedActive=true;
  storage.setItem(ACTIVE_SLOT_KEY,chosenActive);
  storage.setItem(SLOT_KEY,JSON.stringify(incoming.slots));
 }catch(error){
  if(attemptedActive){
   try{if(previousActive===null)storage.removeItem(ACTIVE_SLOT_KEY);
       else storage.setItem(ACTIVE_SLOT_KEY,previousActive);}catch(_){}
  }
  if(wroteRecovery){
   try{if(previousRecovery===null)storage.removeItem(RECOVERY_KEY);
       else storage.setItem(RECOVERY_KEY,previousRecovery);}catch(_){}
  }
  throw error;
 }
 return incoming;
}
function recoveryText(storage){const r=JSON.parse(storage.getItem(RECOVERY_KEY)||'null');if(!r||r.format!=='thornhaven-recovery'||r.schema!==1||typeof r.slots!=='string')throw Error('No recovery copy with saved characters is available.');return encode(JSON.parse(r.slots),r.activeSlot||'slot1',r.createdAt);}
const api={SLOT_KEY,ACTIVE_SLOT_KEY,RECOVERY_KEY,MAX_BYTES,IDS,validate,parse,encode,readLocal,conflicts,restore,recoveryText};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ThornhavenCloudSaveCore=api;
})(typeof window!=='undefined'?window:this);

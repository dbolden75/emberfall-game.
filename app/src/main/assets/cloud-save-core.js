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
  if(!safeInventory(p.inventory))throw Error('Invalid character inventory.');
  if(!safeCompanions(row.state.companions))throw Error('Invalid saved companion data.');
  if(!safeHouseStorage(row.state.houseStorage))throw Error('Invalid house chest contents.');
  if(!safeProgressFlags(row.state))throw Error('Invalid saved quest or home progress.');
  if(!safeTownQuestFlags(row.state.townQuestState))throw Error('Invalid saved town quest progress.');
  if(!safeEnemySnapshots(row.state.mapStates))throw Error('Invalid saved enemy positions.');
 }
 return value;
}
// The game applies !!value to quest milestones and home ownership when
// loading a character. Nonempty strings such as "false" therefore become true,
// incorrectly skipping quests or granting houses after a Cloud Save restore.
// Only validate explicitly supplied flags; missing/null legacy fields still
// receive the game's existing defaults without changing the save schema.
function safeProgressFlags(state){
 const flags=['done','hasSigil','hasFourfoldKey','huntRewarded','shrineRewarded',
  'deepQuestDone','houseBought'];
 if(!flags.every(key=>state[key]==null||typeof state[key]==='boolean'))return false;
 for(const group of ['townRelicState','ownedHomes']){
  const record=state[group];
  if(record==null)continue;
  if(typeof record!=='object'||Array.isArray(record))return false;
  for(const town of ['ashvale','brackenford','stonewatch','sunmere']){
   if(record[town]!=null&&typeof record[town]!=='boolean')return false;
  }
 }
 return true;
}
// Quest handlers test accepted/claimed/rescued as truthy values. Strings such
// as 'false' skip conversations and permanently withhold one-time rewards.
// The record is nested (e.g. slayer contracts); validate explicitly supplied
// fields without rejecting numerical completion counts or absent legacy fields.
function safeTownQuestFlags(quests){
 if(!quests||typeof quests!=='object'||Array.isArray(quests))return false;
 function check(value,depth,path=''){
  if(value===null||typeof value!=='object')return true;
  if(depth>40)return false;
  for(const [key,row] of Object.entries(value)){
   if(['accepted','claimed','rescued'].includes(key)&&row!=null&&typeof row!=='boolean'){console.log('CI DEBUG QUEST FLAG',path+'.'+key,JSON.stringify(row));return false;}
   if(!check(row,depth+1,path+'.'+key))return false;
  }
  return true;
 }
 return check(quests,0);
}
// Enemy snapshots are read directly on game startup. A null/invalid enemy
// entry throws inside applySavedGame and prevents the character from loading.
// Older regions without enemy snapshots remain compatible.
function safeEnemySnapshots(mapStates){
 return Object.values(mapStates).every(saved=>{
  if(saved==null)return true;
  if(typeof saved!=='object'||Array.isArray(saved))return false;
  // The game's loader applies Boolean(chest.open/treasure.opened). A corrupted
  // string such as 'false' becomes true and permanently skips dungeon loot.
  // Keep missing or null historical snapshots compatible.
  for(const [field,flag] of [['chest','open'],['treasure','opened']]){
   const row=saved[field];
   if(row!=null&&(typeof row!=='object'||Array.isArray(row)||
    (row[flag]!=null&&typeof row[flag]!=='boolean')))return false;
  }
  // The live dungeon loader restores rune and trap flags using !!value.
  // String 'false' would become true, changing completed puzzle progress and
  // silently rearming a disarmed trap. Reject malformed explicit snapshots
  // rather than reporting successful import of different world state.
  for(const field of ['runes','traps']){
   const flags=saved[field];
   if(flags!=null&&(!Array.isArray(flags)||
    !flags.every(flag=>typeof flag==='boolean')))return false;
  }
  if(saved.enemies===undefined)return true;
  return Array.isArray(saved.enemies)&&saved.enemies.every(e=>
   e&&typeof e==='object'&&!Array.isArray(e)&&
   (e.x===undefined||(typeof e.x==='number'&&Number.isFinite(e.x)))&&
   (e.y===undefined||(typeof e.y==='number'&&Number.isFinite(e.y)))&&
   // Reject invalid attributes before applySavedGame copies them to live
   // enemies. A nonnumeric respawnAt silently prevents future respawns.
   ['hp','maxHp','respawnAt','spawnX','spawnY'].every(key=>
    e[key]==null||(typeof e[key]==='number'&&Number.isFinite(e[key])&&
    (key==='hp'||key==='maxHp'||key==='respawnAt'?e[key]>=0:true)))&&
   ['alive','lootClaimed'].every(key=>e[key]==null||typeof e[key]==='boolean'));
 });
}
// Inventory is used as row.id/row.count without null checks by the game.
// Reject malformed imported rows before they can crash bag and shop rendering.
// Historical empty bags and ordinary {id,count} rows remain accepted.
// Malformed or duplicate pet records are silently discarded during game load.
// Reject lossy backups. Historical pet snapshots only need their stable id;
// other progress fields remain optional for older versions.
function safeCompanions(pets){
 if(!Array.isArray(pets))return false;
 const seen=new Set();
 return pets.every(p=>p&&typeof p==='object'&&!Array.isArray(p)&&
  typeof p.id==='string'&&!!p.id&&!seen.has(p.id)&&!!seen.add(p.id)&&
  // normalizePets() converts invalid health to zero and deactivates the pet.
  // Reject lossy health snapshots before replacing a player's existing save.
  ['hp','max'].every(field=>p[field]==null||
   (typeof p[field]==='number'&&Number.isFinite(p[field])&&p[field]>=0))&&
  // A string like 'false' is truthy in normalizePets(), activating pets
  // that were inactive in the backup. Keep missing historical flags valid.
  (p.active==null||typeof p.active==='boolean'));
}
function safeInventory(items){
 return Array.isArray(items)&&items.every(row=>
  row&&typeof row==='object'&&!Array.isArray(row)&&
  typeof row.id==='string'&&!!row.id&&
  Number.isSafeInteger(row.count)&&row.count>0);
}
// Older saves may omit houseStorage, use legacy top-level chest arrays, or
// include ignored home metadata. Validate every explicitly present chest.
// The game silently drops non-array chest values during normalization; reject
// these backups rather than reporting success while discarding stored gear.
// Null/missing chests retain historical "empty chest" compatibility.
function safeHouseStorage(saved){
 if(saved==null)return true;
 if(typeof saved!=='object'||Array.isArray(saved))return false;
 for(const id of ['ashvale','brackenford','stonewatch','sunmere']){
  const home=saved[id];
  // An explicitly supplied town chest must be a keyed container. The game
  // silently resets string/array town storage to an empty chest on import.
  // Keep missing/null legacy houses compatible, but refuse lossy shapes.
  if(home==null)continue;
  if(typeof home!=='object'||Array.isArray(home))return false;
  for(const chest of ['front_chest','side_chest']){
   if(home[chest]!=null&&!safeInventory(home[chest]))return false;
  }
 }
 // Historical saves sometimes stored the Brackenford chests at root level.
 // The game applies these legacy arrays *after* modern town storage, so a
 // backup containing conflicting copies would silently overwrite modern gear.
 // Do not choose one copy for the player: refuse the ambiguous import while
 // allowing legacy-only, modern-only and byte-equivalent duplicate arrays.
 for(const chest of ['front_chest','side_chest']){
  if(saved[chest]!=null&&!safeInventory(saved[chest]))return false;
  if(saved[chest]!=null&&saved.brackenford?.[chest]!=null&&
   JSON.stringify(saved[chest])!==JSON.stringify(saved.brackenford[chest]))return false;
 }
 return true;
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
  safeInventory(p.inventory)&&safeCompanions(state.companions)&&safeEnemySnapshots(state.mapStates)&&
  safeHouseStorage(state.houseStorage)&&safeProgressFlags(state)&&
  safeTownQuestFlags(state.townQuestState);
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
 const importedSlots=JSON.stringify(incoming.slots);
 let attemptedRecovery=false,attemptedActive=false,attemptedSlots=false;
 try{
  attemptedRecovery=true;
  storage.setItem(RECOVERY_KEY,recovery);
  if(storage.getItem(RECOVERY_KEY)!==recovery)throw Error('Could not verify the recovery copy.');
  // Commit the selected character before the slots. Verify both writes: an
  // interrupted/silent storage write must not be reported as a restore.
  attemptedActive=true;
  storage.setItem(ACTIVE_SLOT_KEY,chosenActive);
  if(storage.getItem(ACTIVE_SLOT_KEY)!==chosenActive)throw Error('Could not verify the selected character.');
  attemptedSlots=true;
  storage.setItem(SLOT_KEY,importedSlots);
  if(storage.getItem(SLOT_KEY)!==importedSlots)throw Error('Could not verify the restored characters.');
 }catch(error){
  // A faulty storage backend may write before throwing. Roll back the raw
  // bytes, not a parsed/reserialized approximation of the original save.
  let slotsRestored=true,activeRestored=true;
  if(attemptedSlots){
   try{
    if(storage.getItem(SLOT_KEY)!==raw){
     if(raw===null)storage.removeItem(SLOT_KEY);
     else storage.setItem(SLOT_KEY,raw);
    }
   }catch(_){}
   try{slotsRestored=storage.getItem(SLOT_KEY)===raw;}catch(_){slotsRestored=false;}
  }
  if(attemptedActive){
   try{
    if(storage.getItem(ACTIVE_SLOT_KEY)!==previousActive){
     if(previousActive===null)storage.removeItem(ACTIVE_SLOT_KEY);
     else storage.setItem(ACTIVE_SLOT_KEY,previousActive);
    }
   }catch(_){}
   try{activeRestored=storage.getItem(ACTIVE_SLOT_KEY)===previousActive;}catch(_){activeRestored=false;}
  }
  // If either rollback failed, retain the verified recovery snapshot rather
  // than replacing it with an older one. Never discard the pre-import save.
  if(attemptedRecovery&&slotsRestored&&activeRestored){
   try{if(previousRecovery===null)storage.removeItem(RECOVERY_KEY);
       else storage.setItem(RECOVERY_KEY,previousRecovery);}catch(_){}
  }
  if(!slotsRestored||!activeRestored)throw Error('Restore interrupted; use the preserved recovery copy before continuing.',{cause:error});
  throw error;
 }
 return incoming;
}
function recoveryText(storage){const r=JSON.parse(storage.getItem(RECOVERY_KEY)||'null');if(!r||r.format!=='thornhaven-recovery'||r.schema!==1||typeof r.slots!=='string')throw Error('No recovery copy with saved characters is available.');return encode(JSON.parse(r.slots),r.activeSlot||'slot1',r.createdAt);}
const api={SLOT_KEY,ACTIVE_SLOT_KEY,RECOVERY_KEY,MAX_BYTES,IDS,validate,parse,encode,readLocal,conflicts,restore,recoveryText};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ThornhavenCloudSaveCore=api;
})(typeof window!=='undefined'?window:this);

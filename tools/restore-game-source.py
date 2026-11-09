#!/usr/bin/env python3
"""Reconstruct Thornhaven from audited baseline + compact reviewed 1.0.63 source delta.

The delta was generated against the audited 1.0.56 HTML and independently
checked against Thornhaven's 1.0.62 Development Source ZIP, with only the
in-game version label advanced to 1.0.63. No proprietary reference assets.
"""
from pathlib import Path
import base64, hashlib, json, zlib

root = Path(__file__).resolve().parents[1]
parts = [root / 'source-payload' / f'index.html.part-{i:03}' for i in range(1, 4)]
source = b''.join(p.read_bytes() for p in parts)
assert hashlib.sha256(source).hexdigest() == '9e266784b17b65fcd11303f742e2d7f9fb91c727f2a3a1d7ebb6dd7e8d3c0e4f', 'Audited baseline hash mismatch'
lines = source.splitlines(keepends=True)
patch = (root / 'source-payload' / 'compact-1.0.63-patch.b64').read_text().strip()
edits = json.loads(zlib.decompress(base64.b64decode(patch)))
assembled = []
start = 0
for first, last, insertion in edits:
    if not (start <= first <= last <= len(lines)):
        raise ValueError('Patch has invalid or overlapping spans')
    assembled.extend(lines[start:first])
    assembled.append(insertion.encode('utf-8'))
    start = last
assembled.extend(lines[start:])
content = b''.join(assembled)
# The reviewed 1.0.62 source retained one stale title-screen footer.
# Fix that single display label and authenticate the resulting 1.0.63 HTML.
stale = 'Version 1.0.62 · Ashvale Reach'.encode('utf-8')
correct = 'Version 1.0.63 · Ashvale Reach'.encode('utf-8')
assert content.count(stale) == 1, 'Expected exactly one stale title version label'
content = content.replace(stale, correct, 1)
assert hashlib.sha256(content).hexdigest() == 'c9085391c1ad9c76e42502682d16c717fc73b39a4e906759a3463845cf2f14a0', 'Migrated HTML hash mismatch'
content = content.replace(b'1.0.63', b'1.0.64')
assert hashlib.sha256(content).hexdigest() == 'bc14b9f38375c9dca31b14cf28a5dae467108001c7523f9aaa4bd6ebb4791c57', 'Patch version hash mismatch'
# A 1.0.57-era saved enemy can omit x/y. Never overwrite its live,
# valid spawn coordinates with undefined when restoring either save format.
# Keep this narrowly scoped after the authenticated 1.0.64 migration.
for old, new in [
    (b'Object.assign(enemy,{x:e.x,y:e.y,spawnX:Number.isFinite(e.spawnX)?e.spawnX:enemy.spawnX',
     b'Object.assign(enemy,{x:Number.isFinite(e.x)?e.x:enemy.x,y:Number.isFinite(e.y)?e.y:enemy.y,spawnX:Number.isFinite(e.spawnX)?e.spawnX:enemy.spawnX'),
    (b'Object.assign(enemy,{x:e.x,y:e.y,hp:savedHp>0?',
     b'Object.assign(enemy,{x:Number.isFinite(e.x)?e.x:enemy.x,y:Number.isFinite(e.y)?e.y:enemy.y,hp:savedHp>0?'),
]:
    assert content.count(old) == 1, 'Expected exactly one enemy restore expression'
    content = content.replace(old, new, 1)
assert hashlib.sha256(content).hexdigest() == 'caab1a338d37e86dd4a25e509a6dc8c52901835a435fcc4e51a9e2e5b9bef225', 'Enemy coordinate compatibility patch hash mismatch'

# Restored older characters may refer to equipment removed or renamed in a
# later catalog. Showing their inventory must never dereference an unknown
# item id and crash; keep the underlying saved item id for future recovery.
for old, new in [
    (b"(player.weapon?itemDefs[player.weapon].name:'none')", b"(itemDefs[player.weapon]?.name||'none')"),
    (b"(player.armor?itemDefs[player.armor].name:'none')", b"(itemDefs[player.armor]?.name||'none')"),
    (b"(player.shield?itemDefs[player.shield].name:'none')", b"(itemDefs[player.shield]?.name||'none')"),
]:
    assert content.count(old) == 1, 'Expected exactly one equipped gear label'
    content = content.replace(old, new, 1)
assert hashlib.sha256(content).hexdigest() == '02fa2a23977ac87cc38301483c1fa2cea82832cb556113828b629fc9e96ef729', 'Equipment-label compatibility patch hash mismatch'


# Some historical save bags contain IDs no longer in the item catalog.
# Keep their bytes intact and visibly mark unavailable legacy rows; do not
# let invisible, unusable items permanently fill the pack or mislabel gear.
for old,new in [
    ("function bagUnits(){return (player.inventory||[]).reduce((n,row)=>n+(itemDefs[row.id]?.category==='quest'?0:row.count),0)}", "function bagUnits(){return (player.inventory||[]).reduce((n,row)=>n+(row&&itemDefs[row.id]&&itemDefs[row.id].category!=='quest'&&Number.isSafeInteger(row.count)&&row.count>0?row.count:0),0)}"),
    ("const rows=player.inventory.filter(row=>itemDefs[row.id]&&(inventoryFilter==='all'||(inventoryFilter==='quest'?itemDefs[row.id].category==='quest':inventoryFilter==='gathering'?['tool','material'].includes(itemDefs[row.id].category):itemDefs[row.id].category===inventoryFilter)));let out=rows.map(row=>inventoryTileHTML(row.id,row.count,GEAR_SLOTS.some(slot=>player[slot]===row.id))).join('');", "const rows=player.inventory.filter(row=>row&&itemDefs[row.id]&&(inventoryFilter==='all'||(inventoryFilter==='quest'?itemDefs[row.id].category==='quest':inventoryFilter==='gathering'?['tool','material'].includes(itemDefs[row.id].category):itemDefs[row.id].category===inventoryFilter)));const legacyRows=inventoryFilter==='all'?player.inventory.filter(row=>row&&!itemDefs[row.id]):[];let out=rows.map(row=>inventoryTileHTML(row.id,row.count,GEAR_SLOTS.some(slot=>player[slot]===row.id))).join('');out+=legacyRows.map(row=>'<div class=\"itemTile\" aria-label=\"Unavailable legacy item preserved\"><span class=\"itemTileIcon\">&#9671;</span><span class=\"itemTileName\">Unavailable legacy item (preserved)</span><span class=\"itemTileCount\">× '+(Number.isSafeInteger(row.count)&&row.count>0?row.count:0)+'</span></div>').join('');"),
    ("const occupied=rows.length+(hasSigil&&(inventoryFilter==='all'||inventoryFilter==='quest')?1:0);", "const occupied=rows.length+legacyRows.length+(hasSigil&&(inventoryFilter==='all'||inventoryFilter==='quest')?1:0);"),
    ("document.getElementById('inventoryNotice').textContent=rows.length?'Select an item for details and actions.':(inventoryFilter==='all'?'Your pack is empty. Visit Tilda in Ashvale for supplies.':'No items in this category.')", "document.getElementById('inventoryNotice').textContent=legacyRows.length?'Legacy items are preserved but cannot be used in this release; they do not take bag space.':rows.length?'Select an item for details and actions.':(inventoryFilter==='all'?'Your pack is empty. Visit Tilda in Ashvale for supplies.':'No items in this category.')"),
    ("(item?'<span>'+item.name+'</span>':'<span>Empty slot</span>')", "(item?'<span>'+item.name+'</span>':(id?'<span>Unavailable legacy gear</span>':'<span>Empty slot</span>'))"),
]:
    before,after=old.encode('utf-8'),new.encode('utf-8')
    assert content.count(before)==1, 'Expected exactly one legacy inventory expression'
    content=content.replace(before,after,1)
assert hashlib.sha256(content).hexdigest() == '96ba1263fb044e7d2a84bb0b11c281318c7423470915fab806969384d6179134', 'Legacy inventory compatibility patch hash mismatch'

# Archived character inventories may contain IDs absent from the current
# item catalog. The merchant Sell tab must skip unavailable items instead
# of raising TypeError, while keeping the underlying saved IDs untouched.
old=b'const rows=player.inventory.filter(row=>itemDefs[row.id].sell);'
new=b'const rows=player.inventory.filter(row=>row&&itemDefs[row.id]?.sell);'
assert content.count(old)==1, 'Expected exactly one shop sell inventory expression'
content=content.replace(old,new,1)
assert hashlib.sha256(content).hexdigest() == '406e7f4e4d3bab9cfd55bb85ec369b0f4cc7fc725b168a9dfa2874bb1cb3034e', 'Merchant legacy inventory safety patch hash mismatch'

# Keep the visible action buttons on the chosen LEFT side when touch-to-move
# hides the directional pad. The normal two-group joystick layout is unchanged.
# Restore and authenticate the original gameplay/save data first, then apply
# this single CSS-only release fix to the generated Android HTML.
left_touch_anchor = b'body[data-control-side="left"]:has(#gameView:not([hidden])) .shell .touchBar{flex-direction:row-reverse;justify-content:space-between}'
left_touch_rules = (
    b'\n/* Keep lone action group left when touch-to-move hides the D-pad. */\n'
    b'body[data-control-side="left"]:not([data-movement-mode="arrows"]):has(#gameView:not([hidden])) .shell .touchBar{justify-content:flex-end}\n'
    b'body[data-control-side="left"]:not([data-movement-mode="arrows"]):has(#gameView:not([hidden])) .shell .actions{margin-left:0;margin-right:auto}\n'
)
assert content.count(left_touch_anchor) == 1, 'Left-touch layout rule anchor changed'
content = content.replace(left_touch_anchor, left_touch_anchor + left_touch_rules, 1)
assert hashlib.sha256(content).hexdigest() == '0519ec8b8cc5ed8d83311fa36feb0c81a6dbb64ee447021bbb41fa42d46780b1', 'Left-touch CSS fix hash mismatch'

# Connect both public shop APIs to the verified native checkout implementation.
assert content.count(b'</body>') == 1
content = content.replace(b'</body>', b'<script src="purchase-api.js"></script>\n</body>', 1)


# Character slots are the authoritative save on startup. In the historical
# saveGame path, the legacy cache was written *first*. If the much larger
# slots JSON then hit WebView's quota, the cache looked newer than the
# authoritative slot and progress appeared to roll back on restart.
# Commit one complete next-slots snapshot first, then best-effort mirrors.
# In-memory slots must change only after the authoritative storage succeeds.
old = (b"const data=snapshotGameState();localStorage.setItem(SAVE_KEY,JSON.stringify(data));saveSlots[activeSlotId]={id:activeSlotId,name:player.name,class:player.class,level:player.level,updated:Date.now(),state:data};localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(saveSlots));localStorage.setItem(ACTIVE_SLOT_KEY,activeSlotId)")
new = (b"const data=snapshotGameState();const nextSlots={...saveSlots,[activeSlotId]:{id:activeSlotId,name:player.name,class:player.class,level:player.level,updated:Date.now(),state:data}};// Commit the authoritative save in one localStorage write, before caches.\nlocalStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(nextSlots));saveSlots=nextSlots;// A full legacy mirror can hit WebView quota after the slot succeeds.\n// Treat mirror/slot-preference failures as secondary, never as lost progress.\ntry{localStorage.setItem(SAVE_KEY,JSON.stringify(data))}catch(error){console.warn('Legacy save mirror unavailable; character slot committed:',error.name)}try{localStorage.setItem(ACTIVE_SLOT_KEY,activeSlotId)}catch(error){console.warn('Active slot preference unavailable; character slot committed:',error.name)}")
assert content.count(old) == 1, 'Expected exactly one historical saveGame commit sequence'
content = content.replace(old, new, 1)
assert hashlib.sha256(content).hexdigest() == '2022c73b1af65cc98290d29d5e61e73fb4508b4ff4ad2f27ab88dd4460e440a8', 'Atomic character save compatibility patch hash mismatch'


# Historical single-character saves predate the authoritative four-slot store.
# If a WebView quota failure prevents that first migration write, still load
# the existing legacy character in memory instead of silently showing a fresh
# start. The original SAVE_KEY bytes are never deleted; later saves can retry.
legacy_migration = (b"saveSlots.slot1={id:'slot1',name:legacySave.player?.name||'Hero',class:legacySave.player?.class||'warrior',level:legacySave.player?.level||1,updated:Date.now(),state:legacySave};localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(saveSlots))")
quota_safe_migration = (b"saveSlots.slot1={id:'slot1',name:legacySave.player?.name||'Hero',class:legacySave.player?.class||'warrior',level:legacySave.player?.level||1,updated:Date.now(),state:legacySave};try{localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(saveSlots))}catch(error){console.warn('Legacy character migration not yet persisted; original legacy save retained:',error.name)}")
assert content.count(legacy_migration) == 1, 'Expected one legacy single-slot migration write'
content = content.replace(legacy_migration, quota_safe_migration, 1)
assert hashlib.sha256(content).hexdigest() == 'd558dd52e56a29bfd3de72f630046362d3d92eb982fd51bd784fc3b0251c8416', 'Quota-safe legacy save migration hash mismatch'

# Prevent an active character's unsaved progress from being abandoned when
# the user selects a different slot. saveGame() swallows storage quota errors;
# verify the authoritative slot bytes before applying the replacement hero.
# A failed or silently discarded storage write leaves the current game open.
old = (
    b"function selectSaveSlot(id){\n"
    b" if(!SAVE_SLOT_IDS.includes(id)||switchingCharacter)return;\n"
    b" if(id===activeSlotId&&hasStarted){saveGame();saveFilesReturnToGame=true;closePanel('saveFilesScreen');return}\n"
    b" saveGame();switchingCharacter=true;"
)
new = (
    b"// Never abandon an active character when its latest slot data cannot be verified.\n"
    b"// saveGame() catches quota errors, and some storage backends silently reject writes.\n"
    b"function confirmSaveBeforeSlotSwitch(){\n"
    b" if(!hasStarted||titleMenuActive)return true;\n"
    b" saveGame();\n"
    b" try{\n"
    b"  const persisted=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');\n"
    b"  const row=persisted&&persisted[activeSlotId];\n"
    b"  return !!row&&JSON.stringify(row.state)===JSON.stringify(snapshotGameState());\n"
    b" }catch(_){return false}\n"
    b"}\n"
    b"function selectSaveSlot(id){\n"
    b" if(!SAVE_SLOT_IDS.includes(id)||switchingCharacter)return;\n"
    b" if(!confirmSaveBeforeSlotSwitch()){say('Character progress could not be saved. Free storage and retry before switching characters.');return}\n"
    b" if(id===activeSlotId&&hasStarted){saveFilesReturnToGame=true;closePanel('saveFilesScreen');return}\n"
    b" switchingCharacter=true;"
)
assert content.count(old) == 1, 'Expected exactly one vulnerable character-switch sequence'
content = content.replace(old, new, 1)
assert hashlib.sha256(content).hexdigest() == '9f85fb2b6ac55977fa80d86893367e1b1605451f4dcd52736285b69dbaca4eee', 'Character-switch save-guard hash mismatch'

# Save the requested slot preference before replacing the active hero.
# WebView storage can reject a write with an exception or silently. Without
# checking, this leaves a different hero loaded than the one chosen on restart.
# Keep the current hero in memory when preference persistence is unconfirmed.
slot_pref_old = b""" if(id===activeSlotId&&hasStarted){saveFilesReturnToGame=true;closePanel('saveFilesScreen');return}
 switchingCharacter=true;
 try{
  const record=saveSlots[id];
  applySavedGame(JSON.parse(JSON.stringify(record?(record.state||record):freshCharacterState)));
  activeSlotId=id;hasStarted=!!record;saveFilesReturnToGame=hasStarted;
  localStorage.setItem(ACTIVE_SLOT_KEY,id);
"""
slot_pref_new = b""" if(id===activeSlotId&&hasStarted){saveFilesReturnToGame=true;closePanel('saveFilesScreen');return}
 // Verify the next slot can be remembered BEFORE replacing the current hero.
 // WebView storage may throw or silently reject the preference write.
 const record=saveSlots[id];
 let nextState;
 try{nextState=JSON.parse(JSON.stringify(record?(record.state||record):freshCharacterState))}
 catch(_){say('This character save could not be loaded. Your current character remains active.');return}
 try{
  localStorage.setItem(ACTIVE_SLOT_KEY,id);
  if(localStorage.getItem(ACTIVE_SLOT_KEY)!==id)throw new Error('Character slot selection did not persist');
 }catch(_){say('Character switch could not be saved. Free storage and retry; your current character remains active.');return}
 switchingCharacter=true;
 try{
  applySavedGame(nextState);
  activeSlotId=id;hasStarted=!!record;saveFilesReturnToGame=hasStarted;
"""
assert content.count(slot_pref_old)==1, 'Expected exactly one prior character-switch sequence'
content=content.replace(slot_pref_old,slot_pref_new,1)
assert hashlib.sha256(content).hexdigest() == 'c9e67bca38ce0ebfc037e44227ea0e6543387bc95be6d97f1f4a791006f85cd0', 'Slot-preference guard hash mismatch'

# A selected slot's preference is written before loading the character, as a
# safeguard against WebView's silent preference-write refusals. If the saved
# character cannot be applied (or rendering throws), that already-persisted
# preference would otherwise refer to the wrong character on next launch.
# The preceding guard has verified the original slot's save is durable:
# restore its active selection and reload the verified save.
load_guard_old = b""" try{
  localStorage.setItem(ACTIVE_SLOT_KEY,id);
"""
load_guard_new = b""" const previousSlotId=activeSlotId;
 try{
  localStorage.setItem(ACTIVE_SLOT_KEY,id);
"""
assert content.count(load_guard_old) == 1, 'Expected one slot preference transaction'
content = content.replace(load_guard_old, load_guard_new, 1)

load_recovery_old = b"""  if(hasStarted)say('Welcome back, '+player.name+'. Your story continues in '+activeMap.name+'.');
 }finally{switchingCharacter=false}
}
function deleteSaveSlot(id)"""
load_recovery_new = b"""  if(hasStarted)say('Welcome back, '+player.name+'. Your story continues in '+activeMap.name+'.');
 }catch(error){
  // Even after the preference write succeeds, a corrupt save or UI error may
  // prevent the new hero from loading. Recover the previously verified slot.
  let recovered=false;
  try{
   localStorage.setItem(ACTIVE_SLOT_KEY,previousSlotId);
   recovered=localStorage.getItem(ACTIVE_SLOT_KEY)===previousSlotId;
  }catch(_){}
  if(recovered){
   say('That character could not be loaded. Reloading your previous saved character.');
   window.location.reload();
  }else{
   say('Character switch failed and the previous slot selection could not be restored. Keep the game open and back up your progress.');
  }
 }finally{switchingCharacter=false}
}
function deleteSaveSlot(id)"""
assert content.count(load_recovery_old) == 1, 'Expected one unguarded character-load path'
content = content.replace(load_recovery_old, load_recovery_new, 1)
assert hashlib.sha256(content).hexdigest() == 'eb2997aa721a4a2df455734fa1967e71009c33b16d32ffe2e6216db43d95146d', 'Character-load recovery hash mismatch'

# Character deletion must be durable before the live save-slot list is changed.
# Android WebView can throw on storage quota or silently ignore a write.
# Protect the currently active character: switch to another verified save
# before deleting it, and keep the existing legacy migration fallback.
delete_old = b"function deleteSaveSlot(id){if(!SAVE_SLOT_IDS.includes(id)||!saveSlots[id])return;const name=saveSlots[id].name||'this character';if(!window.confirm('Delete '+name+' and all progress in this slot?'))return;delete saveSlots[id];localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(saveSlots));if(id==='slot1')localStorage.removeItem(SAVE_KEY);if(id===activeSlotId){switchingCharacter=true;localStorage.setItem(ACTIVE_SLOT_KEY,'slot1');window.location.reload();return}renderSaveSlots()}"
delete_new = b"""function deleteSaveSlot(id){
 if(!SAVE_SLOT_IDS.includes(id)||!saveSlots[id]||switchingCharacter)return;
 // Never delete a running character or abandon its unsaved progress.
 if(id===activeSlotId){say('Switch to another character before deleting the active save.');return}
 if(!confirmSaveBeforeSlotSwitch()){say('Current character progress could not be saved. Free storage and retry before deleting a character.');return}
 const name=saveSlots[id].name||'this character';
 if(!window.confirm('Delete '+name+' and all progress in this slot?'))return;
 // Save and read back a copy before changing the live slot list. Storage can
 // throw or silently discard writes on Android WebView.
 const remaining={...saveSlots};delete remaining[id];
 const serialized=JSON.stringify(remaining);
 try{
  localStorage.setItem(SAVE_SLOTS_KEY,serialized);
  if(localStorage.getItem(SAVE_SLOTS_KEY)!==serialized)throw new Error('Slot deletion did not persist');
 }catch(_){say('Character deletion could not be saved. No characters were deleted. Free storage and retry.');return}
 saveSlots=remaining;
 // The old single-character mirror is only a migration fallback; the slot
 // store above is already authoritative. Failure to clear it is non-fatal.
 if(id==='slot1')try{localStorage.removeItem(SAVE_KEY)}catch(error){console.warn('Legacy save mirror could not be cleared:',error.name)}
 renderSaveSlots();
}"""
assert content.count(delete_old) == 1, 'Expected one vulnerable character deletion path'
content = content.replace(delete_old, delete_new, 1)
assert hashlib.sha256(content).hexdigest() == '0187ab7907d26f45ecdd32386f308ea26b2991dfc26d427d51ddeb15ea35bfe3', 'Atomic character-deletion hash mismatch'

# Only confirm a paid delivery after its receipt and reward are read back.
# WebView storage can silently drop setItem despite returning without errors.
# Acknowledging an undurable receipt loses a real-money purchase on restart.
purchase_commit_old = b"""function purchaseCommit(next){
 const slot={id:activeSlotId,name:next.player.name,class:next.player.class,level:next.player.level,updated:Date.now(),state:next};
 const slots={...saveSlots,[activeSlotId]:slot};
 // The slot store is authoritative on reload. One atomic write includes reward AND ledger.
 localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(slots));
 saveSlots=slots;townQuestState=next.townQuestState;player.level=next.player.level;
 syncHeroStats();normalizePets();scaleEnemiesForRegion();
 // Compatibility cache failure must not roll back a committed purchase.
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));localStorage.setItem(ACTIVE_SLOT_KEY,activeSlotId)}catch{}
}"""
purchase_commit_new = purchase_commit_old.replace(
    b" localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(slots));",
    b""" const serialized=JSON.stringify(slots);
 localStorage.setItem(SAVE_SLOTS_KEY,serialized);
 // Some WebView storage backends silently ignore writes. Never acknowledge
 // Google Play delivery until both the entitlement and receipt are durable.
 if(localStorage.getItem(SAVE_SLOTS_KEY)!==serialized)throw new Error('Purchase receipt was not saved');""",
    1)
assert content.count(purchase_commit_old) == 1, 'Expected one purchase transaction without read-back'
content = content.replace(purchase_commit_old,purchase_commit_new,1)
assert hashlib.sha256(content).hexdigest() == 'f57cc406c3c027cf12803d4711d6522c23ad079a217147e3732485404e4a3c6d', 'Purchase durability guard hash mismatch'





# A malformed authoritative slot JSON used to abort the whole startup loader
# via a silent catch{}, even when the original 1.0.57 legacy mirror was intact.
# Never resurrect a deliberately empty, but valid, slot store. For malformed
# bytes, require an independently read-back verified backup and explicit player
# consent before replacing the damaged store with the known legacy character.
corrupt_slot_old = b"saveSlots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'{}');"
corrupt_slot_new = b"""// If the authoritative slot JSON is malformed, keep its original bytes safe.
// Never treat a valid empty slot store as corruption: users may delete heroes intentionally.
const rawSlots=localStorage.getItem(SAVE_SLOTS_KEY);
let corruptSlots=false;
try{saveSlots=JSON.parse(rawSlots||'{}')}catch(_){corruptSlots=rawSlots!==null;saveSlots={}}
if(corruptSlots){
 const backupKey='emberfall_corrupt_character_slots_backup_v1';
 let backupVerified=false;
 try{
  if(localStorage.getItem(backupKey)===null)localStorage.setItem(backupKey,rawSlots);
  backupVerified=localStorage.getItem(backupKey)===rawSlots;
 }catch(_){}
 let recovered=false;
 if(backupVerified&&legacySave&&legacySave.player&&legacySave.player.name&&classDefs[legacySave.player.class]
    &&typeof window.confirm==='function'
    &&window.confirm('Thornhaven found damaged character-slot data. An older character backup is available. Restore the older character? The damaged slot bytes have been preserved separately.')){
  const restored={slot1:{id:'slot1',name:legacySave.player.name,class:legacySave.player.class,level:legacySave.player.level||1,updated:Date.now(),state:legacySave}};
  const serialized=JSON.stringify(restored);
  try{
   localStorage.setItem(SAVE_SLOTS_KEY,serialized);
   if(localStorage.getItem(SAVE_SLOTS_KEY)!==serialized)throw new Error('Restore write not confirmed');
   saveSlots=restored;recovered=true;
  }catch(_){saveSlots={}}
 }
 if(!recovered&&typeof window.alert==='function')window.alert('Thornhaven could not load damaged character slots. No damaged data was deleted. Do not start a new game or overwrite saves before recovering a backup.');
}
"""
assert content.count(corrupt_slot_old)==1, 'Expected one unguarded malformed slot parse'
content=content.replace(corrupt_slot_old,corrupt_slot_new,1)
assert hashlib.sha256(content).hexdigest() == '84c6dc43aa701f850ada2c3f21e18e0584e8dfc3f6750dfd3ec6e009c4e957f8', 'Corrupt-slot readback and consent guard hash mismatch'


target = root / 'app/src/main/assets/index.html'
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    assert target.read_bytes() == content, 'Refusing to overwrite a different game source'
else:
    target.write_bytes(content)
print('Thornhaven 1.0.64 HTML reconstructed, SHA-256 verified:', hashlib.sha256(content).hexdigest())

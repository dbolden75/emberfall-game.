/* Thornhaven portable save format. No credentials or device-wide storage. */
(function(root){
'use strict';
const SLOT_KEY='emberfall_character_slots_v1',ACTIVE_SLOT_KEY='emberfall_active_character_slot_v1',RECOVERY_KEY='thornhaven.restore-recovery.v1';
const IDS=['slot1','slot2','slot3','slot4'],MAX_BYTES=8*1024*1024;
// Thornhaven's current maps are at most a few thousand world pixels across.
// Permit much larger historical offsets, but refuse clearly corrupt positions
// that would clamp/teleport a hero or strand monsters outside every map.
const MAX_WORLD_COORD=10000;
const safeWorldCoord=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=MAX_WORLD_COORD;
// Live gathering and respawn AI compare saved deadlines to Date.now(). A
// mathematically finite but century-long deadline would permanently disable
// resources/respawns. Allow ten years of clock skew and historical timestamps.
const MAX_FUTURE_DEADLINE_MS=10*366*24*60*60*1000;
const safeDeadline=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&
 v<=Date.now()+MAX_FUTURE_DEADLINE_MS;
// Match installed petDefs ids. Unknown ids otherwise disappear in normalizePets().
// Explicit membership also rejects inherited names such as '__proto__'.
const KNOWN_PET_IDS=new Set(['dalen','sylvi','corin','eryn','ember_dragon']);
// Only map keys actually defined in the game are safe to restore. Unknown
// regions silently strand the hero; inherited names such as '__proto__' and
// 'constructor' make maps[id] appear valid and can crash setMap().
// Update this list when adding a playable map.
// Includes generated outdoor maps, Worldsend, interiors and four story sanctums.
const KNOWN_MAP_IDS=new Set([
 'ancientgrove','ashenpass','ashenwastes','ashvale','ashvale_home',
 'aurorareach','blackbriar','blackstone','bogreach','borealhollow',
 'brackenford','brackenford_home','briarhollow','burntwood','cinderfall',
 'cinderfields','cinderridge','coalcoast','coastroad','coldwater',
 'coralstrand','crowfield','deepfen','duskwood','dustroad',
 'easternshoals','elderwood','embercrypt','emberdeep','emberplain','fenroad',
 'fernvale','flamecrest','forgottenmoor','frontier_outpost','frontier_quarry',
 'frosthavenwilds','frostmarch','frostwood','frozenstrand','glaciergate',
 'glassridge','greenhollow','gullwatch','highmoor','hollowcrown','iceboundvale',
 'icecoast','meadowroad','memory_valley','moonwood','mosslight',
 'murkwood','northernshoals','northridge','oakheart','obsidianreach',
 'obsidianshore','redfen','redstonevale','reedwater','rimewatch',
 'saltwindreach','scorchedstrand','seafoamcliffs','shrine_heart','shrine_rootmaze',
 'silverpine','sinkinghollow','snowmeltbasin','snowveil','sootmarsh',
 'southernthicket','southwood','starfallridge','stonewatch','stonewatch_home',
 'stonewatchroad','stormcoast','stormspire','sunharbor','sunmere','sunmere_home',
 'thornwall','tidevault','tidewood','veilhaven','wayfarers_camp','westwood',
 'whisperwood','whitefangpass','willowfen','winterspire','witchfen',
 'wolfpine','worldsend'
]);
const clone=v=>JSON.parse(JSON.stringify(v));
// Item lookups use ordinary itemDefs[id] objects, not prototype-free maps.
// A serialized ID like 'constructor' or '__proto__' resolves to an inherited
// object rather than a real item, making bag/gear rendering or migration unsafe.
// Allow unknown future item IDs, but never JavaScript prototype property IDs.
const unsafeItemId=id=>id==='prototype'||Object.prototype.hasOwnProperty.call(Object.prototype,id);
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
  // The character selector displays row.name/class/level, while loading uses
  // row.state.player. A mismatched import can advertise a different hero or
  // level than the one it actually restores. Older saves may omit row labels.
  if((row.name!=null&&row.name!==p.name)||
     (row.class!=null&&row.class!==p.class)||
     (row.level!=null&&row.level!==p.level))throw Error('Backup character listing does not match its saved progress.');
  if(!KNOWN_MAP_IDS.has(row.state.mapId))throw Error('Unknown saved region in backup.');
  if(!Array.isArray(row.state.companions)||
   !row.state.mapStates||typeof row.state.mapStates!=='object'||Array.isArray(row.state.mapStates)||
   !row.state.townQuestState||typeof row.state.townQuestState!=='object'||Array.isArray(row.state.townQuestState))throw Error('Incomplete character progress.');
  // Game load/save only visits existing maps. Unknown saved map-state keys are
  // silently dropped during the next save, erasing enemy, shrine or loot progress.
  // Refuse lossy restores rather than falsely claiming a complete backup import.
  const unknownMapStates=Object.keys(row.state.mapStates).filter(id=>!KNOWN_MAP_IDS.has(id));
  if(unknownMapStates.length)throw Error('Unknown saved map state in backup: '+unknownMapStates.join(','));
  if(!safeExperience(p.xp,p.level))throw Error('Invalid character experience.');
  if(!safeHeroVitals(p))throw Error('Invalid character health, movement or position in backup.');
  if(!safeHeroGearSlots(p))throw Error('Invalid character equipment in backup.');
  if(!safeGatheringForgeProgress(row.state))throw Error('Invalid saved gathering or forge progress.');
  if(!safeInventory(p.inventory))throw Error('Invalid character inventory.');
  if(!safeCompanions(row.state.companions))throw Error('Invalid saved companion data.');
  if(!safeHouseStorage(row.state.houseStorage))throw Error('Invalid house chest contents.');
  if(!safeProgressFlags(row.state))throw Error('Invalid saved quest or home progress.');
  if(!safeTownQuestFlags(row.state.townQuestState))throw Error('Invalid saved town quest progress.');
  if(!safeEnemySnapshots(row.state.mapStates))throw Error('Invalid saved enemy positions.');
 }
 return value;
}
// applySavedGame() coerces saved hero vitals with Number(...), replacing
// malformed values with full health, default movement speed or town arrival.
// An import must not silently heal the character or move them to another spot.
// Historical snapshots may omit optional vitals; an explicitly saved null
// is corrupt (and would reset HP or teleport to map origin). Zero HP is valid.
function safeHeroVitals(player){
 if(!player||typeof player!=='object'||Array.isArray(player))return false;
 for(const key of ['hp','max','speed','x','y']){
  if(!Object.prototype.hasOwnProperty.call(player,key))continue;
  const value=player[key];
  if(typeof value!=='number'||!Number.isFinite(value))return false;
  if((key==='max'||key==='speed')&&value<=0)return false;
  // Movement consumes restored player.speed without an upper clamp. A finite
  // but enormous value can jump across the entire map in one frame and break
  // meaningful movement/camera progression. Legitimate class speeds are below
  // 300; leave generous headroom for older and future boosts.
  if(key==='speed'&&value>2000)return false;
  if(key==='hp'&&value<0)return false;
  if((key==='x'||key==='y')&&!safeWorldCoord(value))return false;
 }
 // applySavedGame() clamps HP above the saved maximum, silently turning a
 // corrupt backup into a fully healed hero. Check only when both fields were
 // explicitly saved so older partial records remain importable.
 if(typeof player.hp==='number'&&typeof player.max==='number'&&player.hp>player.max)return false;
 return true;
}
// The game copies saved hero gear directly onto player before checking
// canUseItem(). Non-string gear values (such as {id:'short_sword'}) and empty
// strings are then silently reset to null, losing equipped equipment during a
// supposedly successful Cloud Save import. Accept genuine item-id strings,
// explicit empty slots (null), and missing gear fields from older versions.
function safeHeroGearSlots(player){
 return ['weapon','armor','shield','earrings','necklace','legs','boots'].every(slot=>{
  if(!Object.prototype.hasOwnProperty.call(player,slot)||player[slot]===null)return true;
  return typeof player[slot]==='string'&&!!player[slot].trim()&&!unsafeItemId(player[slot]);
 });
}
// The live grantXp() uses player.xp += amount, so a restored string such
// as '4' turns a 7-XP reward into '47' instead of 11. Historical missing
// or null XP is still accepted; reject nonnumeric or negative supplied XP.
function safeExperience(xp,level){
 if(xp==null)return true; // Old saves may not contain this optional field.
 if(typeof xp!=='number'||!Number.isFinite(xp)||xp<0)return false;
 // grantXp() processes every earned level synchronously. A finite but
 // impossibly large restored balance (e.g. 1e308) can monopolize the UI
 // thread on the next reward. Real saves normalize excess XP after leveling.
 // Allow a generous 1,000,000-XP historical buffer and ten level thresholds
 // at high levels so this does not introduce a level cap or reject old saves.
 const n=Math.max(0,level-1),threshold=40+10*n+2*n*n;
 return xp<=Math.max(1000000,10*threshold);
}
// The live gathering normalizer converts XP using Number(...), treating an
// invalid string as 0 or Infinity as unlimited skill progress. Similarly the
// forge loader silently clamps corrupted rank strings, potentially erasing
// paid upgrades or granting upgrades never earned. Current saves store
// nonnegative integer XP, levels 1-10 and item upgrade ranks 0-5. Older
// saves may omit the fields entirely, and unknown item ids are preserved for
// forward compatibility.
function safeGatheringForgeProgress(state){
 const skills=state.gatheringSkills;
 if(skills!=null){
  if(typeof skills!=='object'||Array.isArray(skills))return false;
  for(const id of ['mining','woodcutting','fishing']){
   const row=skills[id];
   if(row==null)continue;
   if(typeof row!=='object'||Array.isArray(row))return false;
   if(row.xp!=null&&(!Number.isSafeInteger(row.xp)||row.xp<0))return false;
   if(row.level!=null&&(!Number.isSafeInteger(row.level)||row.level<1||row.level>10))return false;
  }
 }
 const upgrades=state.gearUpgradeLevels;
 if(upgrades!=null){
  if(typeof upgrades!=='object'||Array.isArray(upgrades))return false;
  if(!Object.values(upgrades).every(rank=>Number.isSafeInteger(rank)&&rank>=0&&rank<=5))return false;
 }
 return true;
}
// The game applies !!value to quest milestones and home ownership when
// loading a character. Nonempty strings such as "false" therefore become true,
// incorrectly skipping quests or granting houses after a Cloud Save restore.
// Only validate explicitly supplied flags; missing/null legacy fields still
// receive the game's existing defaults without changing the save schema.
function safeProgressFlags(state){
 // The First Hunt uses `defeated=Number(save.defeated)||0` and increments
 // defeated before comparing it to three. Strings such as "Infinity" silently
 // complete the quest after one kill; fractional/negative values also change
 // legitimate combat progress. Missing/null historical counters default to 0.
 if(state.defeated!=null&&(!Number.isSafeInteger(state.defeated)||state.defeated<0))return false;
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
// Hearthstead normalizes restored settlement fields with Number(...) and !!.
// A corrupt string such as stock.wood:"Infinity" grants a full storehouse;
// founded:"false" founds the town, while claimed.hearth:"false" blocks a
// one-time reward. Keep missing/null historical fields but reject malformed
// explicitly supplied values before overwriting the player's current save.
function safeSettlementProgress(settlement){
 if(settlement==null)return true;
 if(typeof settlement!=='object'||Array.isArray(settlement))return false;
 if(settlement.founded!=null&&typeof settlement.founded!=='boolean')return false;
 if(settlement.kills!=null&&(!Number.isSafeInteger(settlement.kills)||settlement.kills<0))return false;
 if(settlement.lastTick!=null&&(!Number.isSafeInteger(settlement.lastTick)||settlement.lastTick<0))return false;
 for(const group of ['stock','pending','levels','claimed','gathers']){
  const values=settlement[group];
  if(values==null)continue;
  if(typeof values!=='object'||Array.isArray(values))return false;
  for(const [id,value] of Object.entries(values)){
   const supported=group==='levels'?['palisade','gate','tower','barracks','hall','mill','quarry','garden','forge','lodge']:
    group==='claimed'?['hearth','lumber','stone','roads','promise','home']:
    ['wood','stone','food'];
   // Unknown fields from future game versions must survive an older restore.
   if(!supported.includes(id)||value==null)continue;
   if(group==='claimed'){
    if(typeof value!=='boolean')return false;
   }else if(group==='levels'){
    if(!Number.isSafeInteger(value)||value<0||value>3)return false;
   }else if(group==='gathers'){
    if(!Number.isSafeInteger(value)||value<0)return false;
   }else if(typeof value!=='number'||!Number.isFinite(value)||value<0)return false;
  }
 }
 return true;
}
// The four town shops restore their supply and restock timers directly from
// _townStock. townStock() dereferences s.items[id] with no shape guard: a
// nonempty but malformed saved row can crash shopping. A text/century-long
// remaining timer can also prevent shops from restocking indefinitely.
// Historical missing/null whole towns are initialized on first visit; do not
// discard future towns' metadata that this release never interprets.
function safeTownStock(stock){
 if(stock==null)return true;
 if(typeof stock!=='object'||Array.isArray(stock))return false;
 for(const town of ['ashvale','brackenford','stonewatch','sunmere']){
  const row=stock[town];
  if(row==null)continue;
  if(typeof row!=='object'||Array.isArray(row))return false;
  if(!row.items||typeof row.items!=='object'||Array.isArray(row.items))return false;
  // Shop restocks every 900 seconds today. Preserve a full day's historical
  // timer headroom, while rejecting impossible timeouts that lock out buying.
  if(typeof row.remaining!=='number'||!Number.isFinite(row.remaining)||
    row.remaining<0||row.remaining>86400)return false;
  if(!Object.values(row.items).every(n=>Number.isSafeInteger(n)&&n>=0))return false;
 }
 return true;
}
// Slayer Hall reads its saved ledger and hunt terms directly. Restored text
// such as marks:'4' or coins:'30' concatenates during reward calculation;
// a non-array rankRewards crashes .includes()/push() when claiming a rank.
// Reject only malformed explicitly supplied values. Historical partial
// snapshots may omit newly added fields and retain their existing defaults.
function safeSlayerLedger(ledger){
 if(ledger==null)return true;
 if(typeof ledger!=='object'||Array.isArray(ledger))return false;
 const count=value=>Number.isSafeInteger(value)&&value>=0;
 if(['marks','completed'].some(key=>ledger[key]!=null&&!count(ledger[key])))return false;
 if(ledger.joined!=null&&typeof ledger.joined!=='boolean')return false;
 if(ledger.rankRewards!=null&&(!Array.isArray(ledger.rankRewards)||
  !ledger.rankRewards.every(name=>typeof name==='string')))return false;
 if(ledger.hunts!=null){
  if(typeof ledger.hunts!=='object'||Array.isArray(ledger.hunts))return false;
  for(const hunt of Object.values(ledger.hunts)){
   if(!hunt||typeof hunt!=='object'||Array.isArray(hunt))return false;
   if(['kills','completed','marks','coins','xp','acceptedAt'].some(key=>
    hunt[key]!=null&&!count(hunt[key])))return false;
   if(hunt.target!=null&&(!Number.isSafeInteger(hunt.target)||hunt.target<=0))return false;
   if(hunt.accepted!=null&&typeof hunt.accepted!=='boolean')return false;
  }
 }
 return true;
}
// Cloud backups include Google Play purchase receipts and unspent credits. The
// live delivery reducer refuses malformed receipt/credit ledgers; importing
// them would therefore leave a legitimate payment pending indefinitely (or
// lose already-paid boosts). Reject explicitly corrupt purchase state before
// replacing local characters. Historical saves without purchases still work.
function safePurchaseEntitlements(quests){
 const credits=quests._purchaseCredits;
 if(credits!=null){
  if(typeof credits!=='object'||Array.isArray(credits))return false;
  for(const id of ['xp','builder']){
   if(Object.prototype.hasOwnProperty.call(credits,id)&&
    (!Number.isSafeInteger(credits[id])||credits[id]<0))return false;
  }
 }
 const receipts=quests._playReceipts;
 if(receipts!=null){
  if(typeof receipts!=='object'||Array.isArray(receipts))return false;
  if(!Object.entries(receipts).every(([id,product])=>
   /^[a-f0-9]{64}$/.test(id)&&typeof product==='string'&&!!product))return false;
 }
 const styles=quests._paidStyles;
 if(styles!=null){
  if(typeof styles!=='object'||Array.isArray(styles))return false;
  if(!Object.values(styles).every(flag=>typeof flag==='boolean'))return false;
 }
 if(quests._purchaseProfile!=null&&
  (typeof quests._purchaseProfile!=='string'||
   !/^[a-f0-9]{64}$/.test(quests._purchaseProfile)))return false;
 return true;
}
// The Night Visitor reads quest flags as truthy values and increments hunts
// with `(s.hunts||0)+1`. A restored string hunts:'4' jumps to 6 kills
// after only one kill; text turned:'false' grants vampire combat effects.
// Invalid clue arrays also skip or block dialogue and the daylight cure.
// Validate supplied progress while retaining missing/null historical fields.
function safeVampireStory(story){
 if(story==null)return true;
 if(typeof story!=='object'||Array.isArray(story))return false;
 for(const key of ['accepted','complete','turned','cured','sanctuary']){
  if(story[key]!=null&&typeof story[key]!=='boolean')return false;
 }
 if(story.choice!=null&&!['hunt','ally'].includes(story.choice))return false;
 if(story.hunts!=null&&(!Number.isSafeInteger(story.hunts)||story.hunts<0||story.hunts>6))return false;
 if(story.clock!=null&&(typeof story.clock!=='number'||!Number.isFinite(story.clock)||story.clock<0||story.clock>600))return false;
 if(story.hunger!=null&&(typeof story.hunger!=='number'||!Number.isFinite(story.hunger)||story.hunger<0||story.hunger>100))return false;
 for(const [key,allowed] of [['clues',['whisperwood','redfen','mosslight']],
  ['cureClues',['mosslight','sunmere']]]){
  const list=story[key];
  if(list!=null&&(!Array.isArray(list)||list.length>allowed.length||
   !list.every((id,index)=>allowed.includes(id)&&list.indexOf(id)===index)))return false;
 }
 return true;
}
// Human companions are stored in quest state, separate from pet snapshots.
// A truthy but malformed party bypasses humanParty()'s default and the live
// companion menu then dereferences an absent roster, or silently drops an
// active companion. Refuse that backup *before* replacing existing saves.
function safeHumanParty(party){
 if(party==null)return true; // Backward-compatible with saves before companions.
 if(typeof party!=='object'||Array.isArray(party))return false;
 const roster=party.roster,known=['dalen','sylvi','corin','eryn'];
 if(!roster||typeof roster!=='object'||Array.isArray(roster))return false;
 if(party.active!=null&&(!known.includes(party.active)||
  !Object.prototype.hasOwnProperty.call(roster,party.active)))return false;
 for(const [id,c] of Object.entries(roster)){
  if(!known.includes(id)||!c||typeof c!=='object'||Array.isArray(c)||c.id!==id)return false;
  if(typeof c.hp!=='number'||!Number.isFinite(c.hp)||c.hp<0||
   typeof c.max!=='number'||!Number.isFinite(c.max)||c.max<=0||c.hp>c.max)return false;
  if(c.level!=null&&(!Number.isSafeInteger(c.level)||c.level<1))return false;
  if(c.class!=null&&!['warrior','rogue','mage','cleric'].includes(c.class))return false;
  if(c.name!=null&&(typeof c.name!=='string'||!c.name.trim()))return false;
  if(c.active!=null&&typeof c.active!=='boolean')return false;
  if(c.human!=null&&c.human!==true)return false;
  // Human companions are restored directly into the follow/combat AI.
  // A finite but far-off x/y can strand them; unbounded facing or negative
  // timers can break attacks or skill availability. Missing/null historical
  // fields remain supported, as they were before this validation.
  for(const key of ['x','y'])
   if(c[key]!=null&&!safeWorldCoord(c[key]))return false;
  for(const key of ['faceX','faceY'])
   if(c[key]!=null&&(typeof c[key]!=='number'||!Number.isFinite(c[key])||Math.abs(c[key])>1))return false;
  for(const key of ['cool','skillCool','attack','castTime'])
   if(c[key]!=null&&(typeof c[key]!=='number'||!Number.isFinite(c[key])||c[key]<0))return false;
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
   const settlementClaimLedger=path==='._settlement'&&key==='claimed'&&row&&typeof row==='object'&&!Array.isArray(row);
   if(['accepted','claimed','rescued'].includes(key)&&row!=null&&typeof row!=='boolean'&&!settlementClaimLedger)return false;
   // The live quest and slayer handlers increment kills with `kills + 1`.
   // Restored text such as '4' concatenates into '41' before Math.min(),
   // instantly completing quests that should still require combat.
   // Historical missing/null counters are initialized by the game.
   if(key==='kills'&&row!=null&&(!Number.isSafeInteger(row)||row<0))return false;
   if(!check(row,depth+1,path+'.'+key))return false;
  }
  return true;
 }
 // The Hearthstead chapter reads these flags directly as truthy values.
 // A restored string "false" silently skips rescuing Edda, welcoming
 // residents or unlocking the Bellkeeper recipe through legitimate play.
 // Sera's repair flag similarly controls the settlement food penalty.
 // Validate only the explicitly supplied fields, keeping old saves intact.
 for(const [key,fields] of [['_frontier',['home','complete','mystery','blueprint']],['npc_sera',['repaired']]]){
  const record=quests[key];
  if(record==null)continue;
  if(typeof record!=='object'||Array.isArray(record))return false;
  if(!fields.every(flag=>record[flag]==null||typeof record[flag]==='boolean'))return false;
 }
 // Briar Hollow's clue dialogue uses clues.includes()/push(), and Ada's
 // rescue uses a truthy plan. Restoring a non-array clues field can crash
 // exploration; an arbitrary truthy plan can skip preparing her escape.
 // Older backups may omit either field. Keep only the two plans the game writes
 // and the three unique clue ids its objects can actually produce.
 if(!safePurchaseEntitlements(quests))return false;
 if(!safeHumanParty(quests._humanParty))return false;
 if(!safeSettlementProgress(quests._settlement))return false;
 if(!safeTownStock(quests._townStock))return false;
 if(!safeSlayerLedger(quests._slayers))return false;
 if(!safeVampireStory(quests._vampire))return false;
 const briar=quests.briar_hollow;
 if(briar!=null){
  if(typeof briar!=='object'||Array.isArray(briar))return false;
  if(briar.plan!=null&&!['watch','ration'].includes(briar.plan))return false;
  if(briar.clues!=null){
   const known=new Set(['briar_bell','briar_clinic','briar_gate']);
   if(!Array.isArray(briar.clues)||briar.clues.length>known.size||
    !briar.clues.every((id,i)=>known.has(id)&&briar.clues.indexOf(id)===i))return false;
  }
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
  // The gathering loader converts saved timers using Number(...). A string
  // such as 'Infinity' becomes an infinite cooldown, making mining, chopping
  // or fishing permanently unavailable. Historical absent/null timers remain
  // valid, but supplied cooldowns must be finite nonnegative numbers.
  if(saved.gatherNodes!=null&&(!Array.isArray(saved.gatherNodes)||
   !saved.gatherNodes.every(safeDeadline)))return false;
  // Shrine load coerces runeProgress with Number(...), so a corrupt text
  // counter can silently advance/skip a puzzle or block the next rune.
  // Legitimate saves write a nonnegative integer; older saves may omit it.
  if(saved.runeProgress!=null&&
   (!Number.isSafeInteger(saved.runeProgress)||saved.runeProgress<0))return false;
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
   // Malformed but finite coordinates previously sent enemies far off-map
   // without any warning after a supposedly successful Cloud Save restore.
   ['x','y'].every(key=>e[key]===undefined||safeWorldCoord(e[key]))&&
   ['spawnX','spawnY'].every(key=>e[key]==null||safeWorldCoord(e[key]))&&
   // Reject invalid attributes before applySavedGame copies them to live
   // enemies. A nonnumeric respawnAt silently prevents future respawns.
   // An explicit null is NOT an omitted legacy field: Number(null) becomes
   // zero HP, respawnAt||0 discards a timer, and null alive/lootClaimed
   // changes enemy and loot state. Preserve truly absent historical fields.
   ['hp','maxHp','respawnAt'].every(key=>
    e[key]===undefined||(key==='respawnAt'?safeDeadline(e[key]):
    (typeof e[key]==='number'&&Number.isFinite(e[key])&&e[key]>=0)))&&
   // applySavedGame rescales HP as savedHp/savedMax * regional max HP.
   // A damaged saved overmax ratio would resurrect a monster with far more
   // health than the region permits; refuse that import instead of changing
   // enemy difficulty. Missing historical maxima remain compatible.
   (e.hp==null||e.maxHp==null||e.hp<=e.maxHp)&&
   ['alive','lootClaimed'].every(key=>e[key]===undefined||typeof e[key]==='boolean'));
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
  typeof p.id==='string'&&KNOWN_PET_IDS.has(p.id)&&!seen.has(p.id)&&!!seen.add(p.id)&&
  // normalizePets() treats any version other than numeric 1 as legacy and
  // refunds equipped pet gear into the hero's bag before deleting its slots.
  // A corrupt string or a newer, unsupported migration version would silently
  // alter equipment and can grant duplicate gear. Preserve genuine legacy 0
  // and absent versions, but refuse other explicitly supplied versions.
  (p.petVersion==null||(Number.isSafeInteger(p.petVersion)&&
   (p.petVersion===0||p.petVersion===1)))&&
  // Old pets can carry equipment in these slots for the one-time migration.
  // Only item ids or empty slots are meaningful; malformed objects would be
  // discarded, so importing them would falsely claim to preserve gear.
  ['weapon','armor','shield','earrings','necklace','legs','boots'].every(slot=>
   p[slot]==null||(typeof p[slot]==='string'&&!unsafeItemId(p[slot])))&&
  // normalizePets() treats explicit null health as zero or substitutes a
  // default maximum, potentially deactivating or healing a purchased pet.
  // Only missing historical health fields may inherit defaults.
  ['hp','max'].every(field=>p[field]===undefined||
   (typeof p[field]==='number'&&Number.isFinite(p[field])&&p[field]>=0))&&
  // Restored pets preserve their saved movement and attack timers. Text,
  // nulls or off-world coordinates are not repaired by normalizePets(), so a
  // malformed import can strand a purchased/quest pet or break its combat AI.
  // Missing historical movement fields still inherit makeCompanion defaults.
  ['x','y'].every(field=>p[field]===undefined||safeWorldCoord(p[field]))&&
  ['faceX','faceY'].every(field=>p[field]===undefined||
   (typeof p[field]==='number'&&Number.isFinite(p[field])&&Math.abs(p[field])<=1))&&
  ['cool','skillCool','attack','castTime'].every(field=>p[field]===undefined||
   (typeof p[field]==='number'&&Number.isFinite(p[field])&&p[field]>=0))&&
  // A string like 'false' is truthy in normalizePets(), activating pets
  // that were inactive in the backup. Keep missing historical flags valid.
  (p.active==null||typeof p.active==='boolean')&&
  // normalizePets() clamps hp/max to a 0..1 ratio. If the saved pet reports
  // more health than its max, import would silently treat it as fully healed.
  // Retain compatibility with old saves missing either field and dead zero/zero pets.
  (p.hp==null||p.max==null||p.hp<=p.max));
}
function safeInventory(items){
 if(!Array.isArray(items))return false;
 // Live bagCount() reads the first matching stack but removeItem() deletes
 // every matching stack when it reaches zero. Duplicate IDs therefore cause
 // silent item loss (including forged or paid gear) after Cloud Save import.
 // Reject these before replacing local saves; unique historical stacks remain
 // compatible, including the legacy Brackenford home-chest format.
 const seen=new Set();
 return items.every(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||
   typeof row.id!=='string'||!row.id||unsafeItemId(row.id)||
   !Number.isSafeInteger(row.count)||row.count<=0||seen.has(row.id))return false;
  seen.add(row.id);
  return true;
 });
}
// Older saves may omit houseStorage, use legacy top-level chest arrays, or
// include ignored home metadata. Validate every explicitly present chest.
// The game silently drops non-array chest values during normalization; reject
// these backups rather than reporting success while discarding stored gear.
// Null/missing chests retain historical "empty chest" compatibility.
// Future/home-specific containers can contain item stacks that this release
// does not know how to load. Never silently discard those stacks when importing
// a backup from another version. Harmless unknown metadata remains supported.
function hasUnrecognizedItemRows(value){
 if(Array.isArray(value))return value.some(row=>
  (row&&typeof row==='object'&&!Array.isArray(row)&&
   typeof row.id==='string'&&Object.prototype.hasOwnProperty.call(row,'count'))||
  hasUnrecognizedItemRows(row));
 return !!(value&&typeof value==='object'&&
  Object.values(value).some(hasUnrecognizedItemRows));
}
function safeHouseStorage(saved){
 if(saved==null)return true;
 if(typeof saved!=='object'||Array.isArray(saved))return false;
 // normalizeHouseStorage() only visits the four current home IDs. A backup
 // from a newer version could contain a future home's populated chests; the
 // older loader would silently discard that gear on the next character save.
 // Reject only actual stored items in unknown homes, not harmless metadata or
 // empty historical structures, to preserve backward compatibility.
 for(const [id,home] of Object.entries(saved)){
  if(['ashvale','brackenford','stonewatch','sunmere','front_chest','side_chest'].includes(id))continue;
  if(hasUnrecognizedItemRows(home))return false;
 }
 for(const id of ['ashvale','brackenford','stonewatch','sunmere']){
  const home=saved[id];
  // An explicitly supplied town chest must be a keyed container. The game
  // silently resets string/array town storage to an empty chest on import.
  // Keep missing/null legacy houses compatible, but refuse lossy shapes.
  if(home==null)continue;
  if(typeof home!=='object'||Array.isArray(home))return false;
  // Unknown chests from newer versions are otherwise dropped by the loader.
  for(const [field,contents] of Object.entries(home)){
   if(!['front_chest','side_chest'].includes(field)&&
    hasUnrecognizedItemRows(contents))return false;
  }
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
  // Like imported backups, local selector headings must reflect the real
  // saved hero. Otherwise do not treat a damaged row as a safe overwrite.
  (row.name==null||row.name===p.name)&&
  (row.class==null||row.class===p.class)&&
  (row.level==null||row.level===p.level)&&
  ['warrior','rogue','mage','cleric'].includes(p.class)&&
  Number.isSafeInteger(p.level)&&p.level>=1&&Number.isFinite(p.coins)&&p.coins>=0&&
  KNOWN_MAP_IDS.has(state.mapId)&&Array.isArray(state.companions)&&
  state.mapStates&&typeof state.mapStates==='object'&&!Array.isArray(state.mapStates)&&
  Object.keys(state.mapStates).every(id=>KNOWN_MAP_IDS.has(id))&&
  state.townQuestState&&typeof state.townQuestState==='object'&&!Array.isArray(state.townQuestState)&&
  safeExperience(p.xp,p.level)&&safeHeroVitals(p)&&safeHeroGearSlots(p)&&safeGatheringForgeProgress(state)&&safeInventory(p.inventory)&&safeCompanions(state.companions)&&safeEnemySnapshots(state.mapStates)&&
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
// A timestamp is not a unique save revision: two devices can have equal
// millisecond update times but different character progress. Never silently
// replace different state at the same timestamp without the extra approval.
function conflicts(incoming,current){return Object.keys(current).filter(id=>{
 const incomingRow=incoming.slots[id],localRow=current[id];
 if(!incomingRow)return true;
 if(incomingRow.updated<localRow.updated)return true;
 return incomingRow.updated===localRow.updated&&JSON.stringify(incomingRow)!==JSON.stringify(localRow);
});}
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

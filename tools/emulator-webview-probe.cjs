#!/usr/bin/env node
// Connect to the *actual emulator Android WebView* via its forwarded DevTools
// socket. QA workflow patches WebView debugging on in disposable DEBUG builds
// only. Production MainActivity and all signed release artifacts are untouched.
'use strict';
const assert=require('node:assert/strict');
const phase=process.argv[2];
assert(['create','preupgrade','verify','picker-save','picker-load','picker-cancel','picker-saved','picker-reviewed','picker-prepare-restore','picker-commit','picker-restored','lifecycle-stage','lifecycle-check','town-edge-entry','touch-controls','orientation-controls','control-preferences'].includes(phase),'Usage: node emulator-webview-probe.cjs create|preupgrade|verify|picker-save|picker-load|picker-cancel');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function target(){
  let last='';
  for(let i=0;i<30;i++){
    try{
      const r=await fetch('http://127.0.0.1:9222/json',{signal:AbortSignal.timeout(2500)});
      const all=await r.json();
      const page=all.find(x=>x.type==='page'&&x.url?.startsWith('file:///android_asset/index.html')&&x.webSocketDebuggerUrl);
      if(page)return page;
      last='Targets: '+all.map(x=>x.url).join(', ');
    }catch(e){last=e.message}
    await sleep(1000);
  }
  throw Error('Game DevTools target not found: '+last);
}

async function session(url){
  const endpoint=new URL(url);endpoint.hostname='127.0.0.1';endpoint.port='9222';
  const ws=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('DevTools socket timeout')),10000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('DevTools connection failed'))},{once:true});
  });
  let id=0;
  async function evaluate(expression){
    const seq=++id;
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('DevTools eval timeout'))},15000);
      function onMessage(e){
        let msg;try{msg=JSON.parse(e.data.toString())}catch{return}
        if(msg.id!==seq)return;
        clearTimeout(timer);ws.removeEventListener('message',onMessage);
        if(msg.error)return reject(Error(JSON.stringify(msg.error)));
        if(msg.result?.exceptionDetails)return reject(Error(msg.result.exceptionDetails.exception?.description||msg.result.exceptionDetails.text));
        resolve(msg.result?.result?.value);
      }
      ws.addEventListener('message',onMessage);
      ws.send(JSON.stringify({id:seq,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true,userGesture:true}}));
    });
  }
  return {ws,evaluate};
}

const create=String.raw`(async()=>{
  const ids=['ashvale','brackenford','stonewatch','sunmere'];
  if(typeof setMap!=='function'||typeof frame!=='function'||typeof saveGame!=='function')
    throw Error('Actual WebView game functions unavailable');
  hasStarted=true;titleMenuActive=false;window.jarvisPaused=false;
  // On-device rendering can catch exceptions internally and only log a warning.
  // Observe those failures and require the actual requestAnimationFrame loop to
  // keep rendering each town; mapId changes alone do not prove no freeze.
  if(typeof renderScene!=='function')throw Error('Native game renderer unavailable');
  const runtimeFaults=[];
  window.addEventListener('error',e=>runtimeFaults.push('uncaught: '+String(e.message||e.error)));
  window.addEventListener('unhandledrejection',e=>runtimeFaults.push('unhandled: '+String(e.reason)));
  const originalConsoleError=console.error;
  console.error=function(...args){
    const message=args.map(x=>String(x)).join(' ');
    if(/Map rendering error|Thornhaven save failed/i.test(message))runtimeFaults.push(message);
    return originalConsoleError.apply(this,args);
  };
  const originalRenderScene=renderScene;
  let renderedFrames=0;
  renderScene=function(...args){renderedFrames++;return originalRenderScene.apply(this,args)};
  document.getElementById('gameView').hidden=false;
  const observed=[];
  for(const id of ids){
    const before=renderedFrames;
    if(!setMap(id,480,320,false))throw Error('Town transition rejected: '+id);
    // Require real Android WebView rendering to continue, not just mapId updates.
    await new Promise(resolve=>setTimeout(resolve,750));
    if(mapId!==id||!activeMap.town||!activeMap.npcs.length)throw Error('Town unusable: '+id);
    if(renderedFrames<=before)throw Error('Town renderer stopped: '+id);
    if(renderErrorShown||runtimeFaults.length)throw Error('Town runtime fault: '+id+' '+runtimeFaults.join(' | '));
    saveGame();
    const snap=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!snap||snap.mapId!==id||document.getElementById('saveFailureWarning'))
      throw Error('Town save failed: '+id);
    observed.push({id,npcs:activeMap.npcs.length,renderedFrames:renderedFrames-before});
  }
  // Persist real inventory and gathering progression, not just identity/coins.
  player.name='EmulatorUpgradeQA';player.coins=173;player.level=7;player.xp=83;
  // health_tonic exists in the audited 1.0.57 catalog; reset only the QA hero bag.
  player.inventory=[];
  if(!addItem('health_tonic',2))throw Error('Historical inventory fixture failed');
  gatheringSkills.mining.xp=150;gatheringSkills.mining.level=4;
  saveGame();
  const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  if(saved?.player?.name!=='EmulatorUpgradeQA'||saved.player.coins!==173||
     saved.player.level!==7||saved.player.xp!==83||
     !saved.player.inventory.some(x=>x.id==='health_tonic'&&x.count>=2)||
     saved.gatheringSkills?.mining?.xp!==150||
     !slots||!slots[activeSlotId])throw Error('Character/progression/slot save failed');
  // Create a *distinct* valid historical 1.0.57 secondary character record.
  // Active slot1 still owns SAVE_KEY; slot2 is preserved separately in SLOTS_KEY.
  const secondary=JSON.parse(JSON.stringify(saved));
  Object.assign(secondary.player,{name:'BackupUpgradeQA',class:'cleric',level:3,xp:21,coins:441});
  secondary.player.inventory=[{id:'health_tonic',count:3}];
  secondary.mapId='stonewatch';
  secondary.gatheringSkills.fishing={xp:120,level:3};
  saveSlots.slot2={id:'slot2',name:'BackupUpgradeQA',class:'cleric',level:3,
    updated:Date.now(),state:secondary};
  localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(saveSlots));
  localStorage.setItem('thornhaven_emulator_upgrade_qa',
    JSON.stringify({name:saved.player.name,coins:saved.player.coins,map:saved.mapId,
      slot:activeSlotId,level:7,xp:83,miningXp:150,inventoryCount:2,
      secondary:{name:'BackupUpgradeQA',map:'stonewatch',coins:441,
        level:3,xp:21,fishingXp:120,inventoryCount:3}}));
  return JSON.stringify({towns:observed,savedName:saved.player.name,
    coins:saved.player.coins,map:saved.mapId,secondary:'BackupUpgradeQA'});
})()`;
const verify=String.raw`(()=>{
  const key='thornhaven_emulator_upgrade_qa';
  const expected=JSON.parse(localStorage.getItem(key)||'null');
  const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  if(!expected)throw Error('QA sentinel disappeared during -r upgrade');
  if(!save||save.player?.name!==expected.name||save.player?.coins!==expected.coins||
     save.mapId!==expected.map||save.player?.level!==expected.level||
     save.player?.xp!==expected.xp||save.gatheringSkills?.mining?.xp!==expected.miningXp||
     !save.player?.inventory?.some(x=>x.id==='health_tonic'&&x.count>=expected.inventoryCount))
    throw Error('Primary character, inventory or mining progression changed during restart/upgrade');
  if(!slots?.[expected.slot]||slots[expected.slot].state?.player?.name!==expected.name)
    throw Error('Primary character save slot disappeared after -r upgrade');
  const second=slots?.slot2?.state;
  if(!second||second.player?.name!==expected.secondary.name||
     second.player?.coins!==expected.secondary.coins||
     second.mapId!==expected.secondary.map||
     second.player?.level!==expected.secondary.level||
     second.player?.xp!==expected.secondary.xp||
     second.gatheringSkills?.fishing?.xp!==expected.secondary.fishingXp||
     !second.player?.inventory?.some(x=>x.id==='health_tonic'&&x.count>=expected.secondary.inventoryCount))
    throw Error('Secondary character save slot/progression disappeared during restart/upgrade');
  if(localStorage.getItem(ACTIVE_SLOT_KEY)!==expected.slot)
    throw Error('Active character slot changed after -r upgrade');
  return JSON.stringify({name:save.player.name,coins:save.player.coins,map:save.mapId,
    slot:expected.slot,level:save.player.level,inventory:save.player.inventory.length,
    miningXp:save.gatheringSkills.mining.xp,secondary:second.player.name,
    secondaryCoins:second.player.coins,secondaryFishingXp:second.gatheringSkills.fishing.xp});
})()`;


// Probe real Android WebView inventory rendering after historical saves upgrade.
// Never persist the deliberately unknown fixture; restore live memory even on failure.
const legacyInventory=String.raw`(()=>{
 if(typeof bagUnits!=='function'||typeof renderInventory!=='function')throw Error('Inventory runtime unavailable');
 const originalBag=player.inventory,originalWeapon=player.weapon,originalFilter=inventoryFilter;
 try{
  player.inventory=[{id:'__legacy_qa_removed_item__',count:99},{id:'health_tonic',count:2}];
  player.weapon='__legacy_qa_removed_weapon__';inventoryFilter='all';renderInventory();
  const space=bagUnits(),tiles=document.getElementById('inventoryList')?.textContent||'';
  const gear=document.getElementById('inventoryGearSlots')?.textContent||'';
  if(space!==2)throw Error('Unusable legacy item prevents bag pickups: '+space+' items');
  if(!tiles.includes('Unavailable legacy item (preserved)'))throw Error('Unknown legacy item was silently hidden');
  if(!tiles.includes('Health Tonic')&&!tiles.toLowerCase().includes('health tonic'))throw Error('Known item no longer visible');
  if(!gear.includes('Unavailable legacy gear'))throw Error('Unknown equipped gear misrepresented as empty');
  if(player.inventory[0].count!==99||player.weapon!=='__legacy_qa_removed_weapon__')throw Error('Legacy save state mutated');
  return JSON.stringify({bagCapacity:space,unknownItemVisible:true,oldEquipmentVisible:true,preserved:true});
 }finally{player.inventory=originalBag;player.weapon=originalWeapon;inventoryFilter=originalFilter;renderInventory();}
})()`;
// Live Android WebView merchant regression: preserve unknown historical IDs.
const legacyShop=String.raw`(()=>{
 if(typeof renderShop!=='function'||typeof shopSellAvailable!=='function')throw Error('Merchant runtime missing');
 const inventory=player.inventory,weapon=player.weapon,mode=shopMode,shop=activeShopId;
 const stock=townQuestState._townStock;
 try{
  player.inventory=[{id:'__legacy_qa_removed_item__',count:11},{id:'potion_25',count:3},{id:'short_sword',count:1}];
  player.weapon='short_sword';shopMode='sell';activeShopId='ashvale_market';
  renderShop();
  const html=document.getElementById('shopList')?.innerHTML||'';
  if(!html.includes('Small Healing Potion')||!html.includes('Short Sword'))throw Error('Known items missing in Sell tab');
  if(html.includes('__legacy_qa_removed_item__'))throw Error('Unknown legacy item incorrectly offered for sale');
  if(shopSellAvailable('short_sword')!==0||shopSellAvailable('potion_25')!==3)throw Error('Equipped-copy or quantity regression');
  if(!html.includes('Equipped copy protected'))throw Error('Equipped-copy label absent');
  if(player.inventory[0].id!=='__legacy_qa_removed_item__'||player.inventory[0].count!==11)throw Error('Legacy item modified');
  return JSON.stringify({rendered:true,legacyItemPreserved:true,equippedCopyProtected:true,knownStockVisible:true});
 }finally{
  player.inventory=inventory;player.weapon=weapon;shopMode=mode;activeShopId=shop;
  renderShop();
  if(stock===undefined)delete townQuestState._townStock;else townQuestState._townStock=stock;
 }
})()`;

// Android lifecycle regression: change *live* character data without directly
// saving it, then send the disposable emulator Home and kill the process.
// This checks the real Activity.onPause / document visibility backup path,
// not the periodic autosave or a test calling saveGame() explicitly.
const lifecycleStage=String.raw`(()=>{
  const prior=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  if(!prior?.player||!saveSlots?.[activeSlotId])
    throw Error('No prior saved primary character for lifecycle test');
  if(player.name!==prior.player.name||player.coins!==prior.player.coins)
    throw Error('Current in-memory hero does not match disk before background test');
  const before=prior.player.coins,after=before+91;
  if(!Number.isSafeInteger(after))throw Error('Invalid lifecycle coin fixture');
  hasStarted=true;titleMenuActive=false;
  if(switchingCharacter)throw Error('Character switch blocks lifecycle save');
  // Defeat the frame's 2-second autosave during this test; pagehide or
  // visibilitychange must persist the change when Android backgrounds it.
  saveClock=-600;
  player.coins=after;
  localStorage.setItem('thornhaven_lifecycle_qa',JSON.stringify({
    before,after,slot:activeSlotId,hero:prior.player.name
  }));
  if(JSON.parse(localStorage.getItem(SAVE_KEY)).player.coins!==before)
    throw Error('Progress was already saved; lifecycle gate would be vacuous');
  return JSON.stringify({previousCoins:before,unsavedCoins:after,activeSlot:activeSlotId});
})()`;
const lifecycleCheck=String.raw`(()=>{
  const marker=JSON.parse(localStorage.getItem('thornhaven_lifecycle_qa')||'null');
  const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  if(!marker||!save||!slots)throw Error('Lifecycle QA marker/saves disappeared');
  if(save.player?.coins!==marker.after||save.player?.name!==marker.hero)
    throw Error('Android background event did not persist unsaved active hero');
  if(slots[marker.slot]?.state?.player?.coins!==marker.after)
    throw Error('Background save failed to persist active character slot');
  if(localStorage.getItem(ACTIVE_SLOT_KEY)!==marker.slot)
    throw Error('Background save lost active slot selection');
  return JSON.stringify({persistedCoins:save.player.coins,activeSlot:marker.slot,
    backedUpSlot:slots[marker.slot].name,backgroundSaveVerified:true});
})()`;

const pickerSave=String.raw`(()=>{
  if(typeof ThornhavenCloudSave?.save!=='function')throw Error('Android SAF Save bridge absent');
  const button=document.getElementById('titleCloudSave');
  if(!button)throw Error('Cloud Save menu entry absent');
  button.click();
  if(document.getElementById('cloudSavePanel').hidden)throw Error('Cloud Save panel failed to open');
  document.getElementById('cloudSaveExport').click();
  if(!document.getElementById('cloudSaveExport').disabled)throw Error('Save action did not start picker request');
  return JSON.stringify({action:'save',pickerRequest:'started'});
})()`;
const pickerLoad=String.raw`(()=>{
  if(typeof ThornhavenCloudSave?.load!=='function')throw Error('Android SAF Load bridge absent');
  document.getElementById('cloudSaveImport').click();
  if(!document.getElementById('cloudSaveImport').disabled)throw Error('Load action did not start picker request');
  return JSON.stringify({action:'load',pickerRequest:'started'});
})()`;
const pickerSaved=String.raw`(()=>{
  const status=document.getElementById('cloudSaveStatus')?.textContent||'';
  if(!status.includes('Backup written to the selected provider.'))
    throw Error('Android document export completion callback missing: '+status);
  if(document.getElementById('cloudSaveExport').disabled)
    throw Error('Export button remained disabled');
  return JSON.stringify({exportCompleted:true,localProgressIntact:true});
})()`;
const pickerReviewed=String.raw`(()=>{
  const review=document.getElementById('cloudSaveReview');
  const summary=document.getElementById('cloudSaveSummary')?.textContent||'';
  if(!review||review.hidden||
      !summary.includes('EmulatorUpgradeQA')||!summary.includes('BackupUpgradeQA'))
    throw Error('Android document import did not reach two-character backup review: '+summary);
  // Review only: never automatically replace progress, even in this disposable QA.
  document.getElementById('cloudSaveCancel').click();
  if(!review.hidden)throw Error('Cancel did not close backup review');
  return JSON.stringify({importRead:true,twoCharactersReviewed:true,restoreCancelled:true});
})()`;
const pickerCancel=String.raw`(()=>{
  const status=document.getElementById('cloudSaveStatus')?.textContent||'';
  if(!status.includes('Cancelled. Local progress is unchanged.'))
    throw Error('Cancelled picker did not restore local UI state: '+status);
  for(const id of ['cloudSaveExport','cloudSaveImport','cloudSaveClose'])
    if(document.getElementById(id).disabled)throw Error('Picker cancellation left '+id+' disabled');
  return JSON.stringify({cancelConfirmed:true,localSaveUnchanged:true});
})()`;


const pickerPrepareRestore=String.raw`(()=>{
  // Deliberately make newer LOCAL progress after exporting the real document.
  // The imported backup is now older and requires a second explicit approval.
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  if(!slots?.slot1||!slots?.slot2)throw Error('Historical slots missing before restore rehearsal');
  if(slots.slot1.state?.player?.coins!==173)throw Error('Original slot1 coins already changed');
  slots.slot1.state.player.coins=999;
  slots.slot1.updated=Math.max(Date.now()+86400000,Number(slots.slot1.updated)+10000);
  // Prevent game lifecycle autosave from overwriting this deliberate QA fixture.
  switchingCharacter=true;
  localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(slots));
  if(JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)).slot1.state.player.coins!==999)
    throw Error('Newer local progress did not persist');
  return JSON.stringify({newerLocalCoins:999,backupCoins:173,restoreNeedsOlderApproval:true});
})()`;
const pickerCommit=String.raw`(()=>{
  const review=document.getElementById('cloudSaveReview');
  const warning=document.getElementById('cloudSaveOlderLabel');
  if(!review||review.hidden||!warning||warning.hidden)
    throw Error('Older native backup was not reviewed with overwrite warning');
  const summary=document.getElementById('cloudSaveSummary')?.textContent||'';
  if(!summary.includes('EmulatorUpgradeQA')||!summary.includes('BackupUpgradeQA'))
    throw Error('Imported native document did not contain both characters');
  const current=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'{}');
  if(current.slot1?.state?.player?.coins!==999)
    throw Error('Newer local progress disappeared before consent');
  document.getElementById('cloudSaveOlder').checked=true;
  // Disposable emulator only: accept the normal second confirmation dialog.
  window.confirm=()=>true;
  // Schedule click AFTER DevTools has returned; the application immediately
  // reloads the WebView when restore is committed.
  setTimeout(()=>document.getElementById('cloudSaveConfirm').click(),300);
  return JSON.stringify({reviewed:true,explicitOlderApproval:true,confirmationScheduled:true});
})()`;
const pickerRestored=String.raw`(()=>{
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  const recovery=JSON.parse(localStorage.getItem('thornhaven.restore-recovery.v1')||'null');
  if(!slots?.slot1||!slots?.slot2)throw Error('Restored two-slot save absent');
  const primary=slots.slot1.state,secondary=slots.slot2.state;
  if(primary.player?.name!=='EmulatorUpgradeQA'||primary.player.coins!==173||
     primary.gatheringSkills?.mining?.xp!==150||
     !primary.player.inventory.some(i=>i.id==='health_tonic'&&i.count>=2))
    throw Error('Primary character failed native document restore');
  if(secondary.player?.name!=='BackupUpgradeQA'||secondary.player.coins!==441||
     secondary.gatheringSkills?.fishing?.xp!==120||
     !secondary.player.inventory.some(i=>i.id==='health_tonic'&&i.count>=3))
    throw Error('Secondary character failed native document restore');
  if(recovery?.format!=='thornhaven-recovery'||typeof recovery.slots!=='string')
    throw Error('Recovery copy missing after native document restore');
  const previous=JSON.parse(recovery.slots);
  if(previous.slot1?.state?.player?.coins!==999)
    throw Error('Recovery copy did not retain newer local progress');
  if(localStorage.getItem(ACTIVE_SLOT_KEY)!=='slot1'||player.coins!==173)
    throw Error('Game did not reload restored active character');
  return JSON.stringify({restoredCoins:primary.player.coins,secondCoins:secondary.player.coins,
    newerCoinsInRecovery:previous.slot1.state.player.coins,activeSlot:'slot1',
    restoredAfterReload:true});
})()`;

// QA uses real Android requestAnimationFrame edge detection to enter towns.
// Unlike setMap(town), this covers mapConnections -> takeMapExit -> save/UI.
const townEdgeEntry=String.raw`(async()=>{
  if(typeof edgeSideAt!=='function'||typeof mapPlacementBlocked!=='function'||
     typeof takeMapExit!=='function'||typeof renderScene!=='function')
    throw Error('Town edge-transition runtime unavailable');
  hasStarted=true;titleMenuActive=false;window.jarvisPaused=false;
  document.getElementById('adventureScreen').hidden=true;
  document.getElementById('gameView').hidden=false;
  const faults=[],priorError=console.error,priorRender=renderScene;
  let renders=0;
  window.addEventListener('error',e=>faults.push(String(e.message||e.error)));
  window.addEventListener('unhandledrejection',e=>faults.push(String(e.reason)));
  console.error=function(...args){
    const msg=args.map(v=>String(v)).join(' ');
    if(/Map rendering error|Thornhaven save failed/i.test(msg))faults.push(msg);
    return priorError.apply(this,args);
  };
  renderScene=function(...args){renders++;return priorRender.apply(this,args)};
  // The 9x9 world regenerates its reciprocal compass exits at startup.
  // Legacy static connection declarations are deliberately replaced, so
  // derive each town's real neighboring entry routes from the live worldGrid.
  if(!Array.isArray(worldGrid))throw Error('World grid missing from game');
  const origins=[['north',0,1],['south',0,-1],['east',-1,0],['west',1,0]];
  const offsets=[0,90,-90,180,-180,300,-300,450,-450,600,-600];
  const observations=[];
  for(const destination of ['ashvale','sunmere','brackenford','stonewatch']){
    const ty=worldGrid.findIndex(row=>row.includes(destination));
    if(ty<0)throw Error('Town absent from 9x9 worldGrid: '+destination);
    const tx=worldGrid[ty].indexOf(destination);
    let route=null;
    for(const [side,dx,dy] of origins){
      const origin=worldGrid[ty+dy]?.[tx+dx];
      if(!origin)continue;
      const edge=mapConnections[origin]?.exits.find(e=>
        e.trigger==='edge'&&e.side===side&&e.to===destination);
      if(!edge||!canUseMapExit(edge))continue;
      if(!setMap(origin,480,315,false))throw Error('Cannot stage '+origin);
      const b=worldBounds(origin),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
      for(const offset of offsets){
        const x=side==='east'?b.maxX-20:side==='west'?b.minX+20:cx+offset;
        const y=side==='south'?b.maxY-20:side==='north'?b.minY+20:cy+offset;
        if(edgeSideAt(x,y,b)===side&&!mapPlacementBlocked(origin,x,y,player.r)){
          route={origin,side,point:{x,y}};break;
        }
      }
      if(route)break;
    }
    if(!route)throw Error('No walkable adjacent edge route to '+destination);
    const {origin,side,point}=route;
    // Place the QA hero at an unobstructed exit trigger. The running game
    // frame, NOT a direct takeMapExit call, must perform the transition.
    Object.assign(player,point);updateCamera();
    const before=renders;
    await new Promise(resolve=>setTimeout(resolve,900));
    if(mapId!==destination)throw Error('Actual edge traversal failed: '+origin+' -> '+destination+' (at '+mapId+')');
    if(renders-before<3)throw Error('Town rendering stopped after edge entry: '+destination);
    if(!activeMap.town||activeMap.npcs.length<1||activeMap.enemies.length)
      throw Error('Town NPCs/monster safety invalid after edge entry: '+destination);
    if(renderErrorShown||faults.length)
      throw Error('Town renderer/runtime exception: '+destination+' '+faults.join(' | '));
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
    if(saved?.mapId!==destination||slots?.[activeSlotId]?.state?.mapId!==destination)
      throw Error('Town transition did not persist active character: '+destination);
    observations.push({from:origin,to:destination,frames:renders-before,npcs:activeMap.npcs.length,saved:true});
  }
  return JSON.stringify({edgeEntries:observations,realFrameTransitions:true,originalSigner:false});
})()`;

// Exercise the LIVE Android WebView movement-pad event handlers, not just CSS.
// One held synthetic pointer must steer right -> up -> southwest without a
// lift, recenter to neutral, and leave no stuck movement after release/cancel.
// These programmatic DOM events are QA probes, not physical touchscreen input.
const touchControls=String.raw`(async()=>{
  if(typeof movementAxes!=='function'||
     typeof movementTouches==='undefined'||typeof PointerEvent!=='function')
    throw Error('Movement-pad runtime or PointerEvent unavailable');
  const pad=document.querySelector('.controls'),actions=document.querySelector('.actions');
  const row=document.getElementById('controlRow'),game=document.getElementById('gameView');
  if(!pad||!actions||!row||!game)throw Error('Movement controls missing');
  const formerHidden=row.hidden;
  hasStarted=true;titleMenuActive=false;window.jarvisPaused=false;
  game.hidden=false;row.hidden=false;
  document.getElementById('adventureScreen').hidden=true;
  const r=pad.getBoundingClientRect(),a=actions.getBoundingClientRect();
  const overlapWidth=Math.max(0,Math.min(r.right,a.right)-Math.max(r.left,a.left));
  const overlapHeight=Math.max(0,Math.min(r.bottom,a.bottom)-Math.max(r.top,a.top));
  if(r.width<100||r.height<100||getComputedStyle(pad).display==='none')
    throw Error('Joystick/D-pad invisible or undersized');
  if(overlapWidth*overlapHeight>1)
    throw Error('Joystick overlaps action controls: '+overlapWidth+'x'+overlapHeight);
  if(r.left<-.5||r.right>innerWidth+.5||a.right>innerWidth+.5)
    throw Error('Controls outside viewport: '+innerWidth);
  if(pad.querySelectorAll('[data-key]').length!==8)
    throw Error('Eight direction buttons missing');
  if(!combatReady())throw Error('Town gameplay not accepting movement input');
  const cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
  const id=8675309;
  function fire(type,x,y,pointerId=id){
    const target=type==='pointerdown' ? pad.querySelector('[data-key="ArrowRight"]') : pad;
    target.dispatchEvent(new PointerEvent(type,{
      bubbles:true,cancelable:true,pointerId,pointerType:'touch',
      isPrimary:pointerId===id,button:0,buttons:type==='pointerup'?0:1,
      clientX:x,clientY:y
    }));
  }
  function expect(key,label){
    const held=[...keys].filter(k=>k.startsWith('Touch:'));
    const axis=movementAxes();
    if(key===null ? held.length!==0 : held.length!==1||held[0]!=='Touch:'+key)
      throw Error(label+' held '+held.join(','));
    return {held,axis};
  }
  const seen=[];
  try{
    keys.clear();clearPadTouches();
    const right=pad.querySelector('[data-key="ArrowRight"]').getBoundingClientRect();
    const rightX=(right.left+right.right)/2,rightY=(right.top+right.bottom)/2;
    fire('pointerdown',rightX,rightY);
    seen.push({phase:'hold-right',...expect('ArrowRight','right')});
    if(movementTouches.size!==1)throw Error('First touch not held');
    fire('pointermove',cx,cy-42);
    seen.push({phase:'drag-up',...expect('ArrowUp','up')});
    fire('pointermove',cx,cy);
    seen.push({phase:'neutral',...expect(null,'center')});
    fire('pointermove',cx-42,cy+42);
    seen.push({phase:'drag-southwest',...expect('DiagonalSW','southwest')});
    fire('pointerup',cx-42,cy+42);
    seen.push({phase:'released',...expect(null,'release')});
    if(movementTouches.size!==0)throw Error('Release left held pointer behind');
    fire('pointerdown',rightX,rightY);
    expect('ArrowRight','second press');
    fire('pointercancel',rightX,rightY);
    seen.push({phase:'cancelled',...expect(null,'cancel')});
    if(movementTouches.size!==0)throw Error('Cancel left held pointer behind');
    return JSON.stringify({joystickHoldDrag:seen,padWidth:r.width,
      actionOverlapPx:overlapWidth*overlapHeight,
      syntheticPointerEvents:true,physicalDeviceTest:false,hasVirtualJoystick:false});
  }finally{
    clearPadTouches();keys.clear();
    row.hidden=formerHidden;
  }
})()`;


// Validate native rotation, save slots and controls in BOTH orientations on
// disposable Android 14. This is automated geometry, not physical touch.

// Verify the actual MENU preference choices (not only direct JS helpers) on
// Android WebView, across BOTH physical orientations. A joystick option that
// silently fails or overlaps the action buttons is a release regression.
// These are synthetic DOM clicks/geometry checks, not human finger input.
const controlPreferences=String.raw`(async()=>{
  if(typeof setMovementMode!=='function'||typeof setControlSide!=='function'||
     !window.ThornhavenDevice||
     typeof ThornhavenDevice.setOrientationPreference!=='function')
    throw Error('Android control preference APIs unavailable');
  const menu=document.getElementById('optionsMenu');
  const menuButton=document.getElementById('optionsToggle');
  const pad=document.querySelector('.controls');
  const actions=document.querySelector('.actions');
  const game=document.getElementById('gameView');
  const row=document.getElementById('controlRow');
  if(!menu||!menuButton||!pad||!actions||!game||!row)
    throw Error('Game settings or thumb controls missing');
  const originalMode=document.body.dataset.movementMode;
  const originalSide=document.body.dataset.controlSide;
  const originalOrientation=ThornhavenDevice.getOrientationPreference();
  const originalRowHidden=row.hidden;
  const oldActive=localStorage.getItem(ACTIVE_SLOT_KEY);
  const originalHero=JSON.stringify({
    name:player.name,coins:player.coins,level:player.level,xp:player.xp
  });
  const originalSlots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'{}');
  const originalSecondary=JSON.stringify(['slot1','slot2'].map(id=>({
    name:originalSlots[id]?.state?.player?.name,
    coins:originalSlots[id]?.state?.player?.coins,
    level:originalSlots[id]?.state?.player?.level
  })));
  const measurements=[];
  hasStarted=true;titleMenuActive=false;window.jarvisPaused=false;
  game.hidden=false;row.hidden=false;
  document.getElementById('adventureScreen').hidden=true;
  function choose(attribute,value){
    if(menu.hidden)menuButton.click();
    if(menu.hidden||menu.dataset.page!=='main')
      throw Error('Game main MENU did not open');
    // Test the actual visible Settings -> Movement & controls navigation.
    // Calling .click() on a hidden option would be a meaningless false pass.
    const category=[...document.querySelectorAll('#menuCategories button')].find(
      button=>button.textContent.trim().startsWith('Settings'));
    if(!category||!category.getClientRects().length){
      const cats=document.getElementById('menuCategories');
      throw Error('Settings category absent from opened MENU: '+JSON.stringify({
        menuHidden:menu.hidden,menuPage:menu.dataset.page,
        menuDisplay:getComputedStyle(menu).display,menuRects:menu.getClientRects().length,
        catsPresent:!!cats,catsHidden:cats?.hidden,
        catsDisplay:cats?getComputedStyle(cats).display:null,
        catsRects:cats?.getClientRects().length,
        buttons:[...(cats?.querySelectorAll('button')||[])].map(b=>({
          text:b.textContent,hidden:b.hidden,rects:b.getClientRects().length,
          display:getComputedStyle(b).display})),
        active:document.activeElement?.id,titleMenuActive
      }));
    }
    category.click();
    if(menu.dataset.page!=='settings')
      throw Error('Settings category did not open');
    const controls=document.getElementById('controlSettings');
    if(!controls||controls.hidden)throw Error('Movement & controls section hidden');
    if(!controls.open)controls.querySelector('summary').click();
    if(!controls.open)throw Error('Movement & controls section did not expand');
    const button=controls.querySelector('['+attribute+'="'+value+'"]');
    if(!button||!button.getClientRects().length)
      throw Error('Visible settings option missing: '+attribute+'='+value);
    button.click();
    if(!menu.hidden)throw Error('MENU did not close after '+attribute+'='+value);
    if(button.getAttribute('aria-pressed')!=='true')
      throw Error('Selected option not reflected in aria-pressed');
  }
  function rectInView(rect,label){
    if(rect.width<35||rect.height<35||rect.left<-.5||rect.top<-.5||
       rect.right>innerWidth+.5||rect.bottom>innerHeight+.5)
      throw Error(label+' clipped/offscreen at '+innerWidth+'x'+innerHeight+
        ': '+JSON.stringify([rect.left,rect.top,rect.right,rect.bottom]));
  }
  try{
    for(const orientation of ['portrait','landscape']){
      ThornhavenDevice.setOrientationPreference(orientation);
      let ready=false;
      for(let i=0;i<24;i++){
        await new Promise(resolve=>setTimeout(resolve,400));
        if(ThornhavenDevice.getOrientationPreference()===orientation &&
           (orientation==='portrait'?innerHeight>innerWidth:innerWidth>innerHeight)){
          ready=true;break;
        }
      }
      if(!ready)throw Error('Native Android '+orientation+' orientation never applied');
      for(const side of ['right','left']){
        choose('data-side-choice',side);
        if(document.body.dataset.controlSide!==side||
           localStorage.getItem(CONTROL_PREF)!==side)
          throw Error('MENU side preference did not persist: '+side);
        for(const mode of ['touch','arrows']){
          choose('data-movement-choice',mode);
          if(document.body.dataset.movementMode!==mode||
             localStorage.getItem(MOVEMENT_PREF)!==mode)
            throw Error('MENU movement preference did not persist: '+mode);
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const ar=actions.getBoundingClientRect();
          rectInView(ar,'action buttons '+orientation+'/'+side+'/'+mode);
          const padVisible=getComputedStyle(pad).display!=='none';
          if(padVisible!==(mode==='arrows'))
            throw Error('Joystick visibility wrong: '+orientation+'/'+side+'/'+mode);
          let overlapPx=0,px=null;
          if(padVisible){
            const pr=pad.getBoundingClientRect();
            rectInView(pr,'joystick '+orientation+'/'+side+'/'+mode);
            overlapPx=Math.max(0,Math.min(pr.right,ar.right)-Math.max(pr.left,ar.left))*
              Math.max(0,Math.min(pr.bottom,ar.bottom)-Math.max(pr.top,ar.top));
            if(overlapPx>1)throw Error('Joystick overlaps action controls in '+orientation+
              '/'+side+': '+overlapPx+' px');
            const padCenter=(pr.left+pr.right)/2,actionsCenter=(ar.left+ar.right)/2;
            if(side==='right' && !(padCenter<actionsCenter))
              throw Error('Right-handed layout did not keep joystick to left of actions');
            if(side==='left' && !(padCenter>actionsCenter))
              throw Error('Left-handed layout did not move joystick to right of actions');
            px=[Math.round(pr.left),Math.round(pr.right)];
          }
          measurements.push({orientation,side,mode,viewport:[innerWidth,innerHeight],
            padVisible,joystickX:px,actionX:[Math.round(ar.left),Math.round(ar.right)],
            overlapPx});
        }
      }
    }
    const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'{}');
    const secondary=JSON.stringify(['slot1','slot2'].map(id=>({
      name:slots[id]?.state?.player?.name,
      coins:slots[id]?.state?.player?.coins,
      level:slots[id]?.state?.player?.level
    })));
    if(JSON.stringify({name:player.name,coins:player.coins,level:player.level,xp:player.xp})!==
       originalHero||secondary!==originalSecondary||
       localStorage.getItem(ACTIVE_SLOT_KEY)!==oldActive)
      throw Error('MENU movement/side choices replaced character progression');
    return JSON.stringify({menuOptionsPassed:measurements.length,measurements,
      savePreserved:true,physicalDeviceTest:false});
  }finally{
    if(!menu.hidden)menuButton.click();
    setMovementMode(originalMode);
    setControlSide(originalSide);
    ThornhavenDevice.setOrientationPreference(originalOrientation);
    row.hidden=originalRowHidden;
  }
})()`;

const orientationControls=String.raw`(async()=>{
  if(!window.ThornhavenDevice ||
     typeof ThornhavenDevice.setOrientationPreference!=='function' ||
     typeof ThornhavenDevice.getOrientationPreference!=='function')
    throw Error('Native orientation bridge missing');
  const pad=document.querySelector('.controls'),actions=document.querySelector('.actions');
  const row=document.getElementById('controlRow'),game=document.getElementById('gameView');
  if(!pad||!actions||!row||!game)throw Error('Orientation QA controls missing');
  const oldHidden=row.hidden,original=ThornhavenDevice.getOrientationPreference();
  const oldActive=localStorage.getItem(ACTIVE_SLOT_KEY);
  // Compare character progression instead of raw JSON: the running game may
  // legitimately autosave updated timestamps while the screen rotates.
  function stableCharacters(){
    const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
    return JSON.stringify(['slot1','slot2'].map(id=>{
      const st=slots?.[id]?.state,p=st?.player;
      return {name:p?.name,coins:p?.coins,level:p?.level,xp:p?.xp,
        inventory:p?.inventory,miningXp:st?.gatheringSkills?.mining?.xp,
        fishingXp:st?.gatheringSkills?.fishing?.xp};
    }));
  }
  const oldCharacters=stableCharacters();
  hasStarted=true;titleMenuActive=false;window.jarvisPaused=false;
  row.hidden=false;game.hidden=false;
  document.getElementById('adventureScreen').hidden=true;
  const measurements=[];
  try{
    for(const mode of ['portrait','landscape']){
      ThornhavenDevice.setOrientationPreference(mode);
      let oriented=false;
      for(let attempt=0;attempt<24;attempt++){
        await new Promise(resolve=>setTimeout(resolve,400));
        const dimensionsMatch=mode==='portrait' ? innerHeight>innerWidth : innerWidth>innerHeight;
        if(ThornhavenDevice.getOrientationPreference()===mode && dimensionsMatch){
          oriented=true;break;
        }
      }
      if(!oriented)throw Error('Android did not reach '+mode+' orientation: '+
        innerWidth+'x'+innerHeight+' preference='+ThornhavenDevice.getOrientationPreference());
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
      const p=pad.getBoundingClientRect(),a=actions.getBoundingClientRect();
      const overlapX=Math.max(0,Math.min(p.right,a.right)-Math.max(p.left,a.left));
      const overlapY=Math.max(0,Math.min(p.bottom,a.bottom)-Math.max(p.top,a.top));
      const overlapPx=overlapX*overlapY;
      if(p.width<100||p.height<100||getComputedStyle(pad).display==='none')
        throw Error(mode+' eight-way D-pad missing/undersized');
      if(p.left<-.5||p.right>innerWidth+.5||
         a.left<-.5||a.right>innerWidth+.5||
         p.top<-.5||p.bottom>innerHeight+.5||
         a.top<-.5||a.bottom>innerHeight+.5)
        throw Error(mode+' controls outside viewport '+innerWidth+'x'+innerHeight);
      if(overlapPx>1)throw Error(mode+' D-pad overlaps action buttons '+overlapPx+'px');
      if(pad.querySelectorAll('[data-key]').length!==8)
        throw Error(mode+' D-pad directions missing');
      measurements.push({mode,viewport:[innerWidth,innerHeight],
        pad:[Math.round(p.width),Math.round(p.height)],
        actions:[Math.round(a.width),Math.round(a.height)],overlapPx});
    }
    if(stableCharacters()!==oldCharacters ||
       localStorage.getItem(ACTIVE_SLOT_KEY)!==oldActive)
      throw Error('Orientation change unexpectedly replaced QA character slot data');
    return JSON.stringify({measurements,saveKeysPreserved:true,syntheticGeometry:true,
      physicalDeviceTest:false});
  }finally{
    ThornhavenDevice.setOrientationPreference(original);
    row.hidden=oldHidden;
  }
})()`;

(async()=>{
  const page=await target();const {ws,evaluate}=await session(page.webSocketDebuggerUrl);
  try{
    let ready=false;
    for(let i=0;i<30;i++){
      ready=await evaluate("typeof saveGame==='function' && typeof localStorage!=='undefined'");
      if(ready)break;
      await sleep(1000);
    }
    assert(ready,'Game JavaScript did not initialize in native Android WebView');
    const scripts={create,preupgrade:verify,verify,'lifecycle-stage':lifecycleStage,'lifecycle-check':lifecycleCheck,'town-edge-entry':townEdgeEntry,'touch-controls':touchControls,'orientation-controls':orientationControls,'control-preferences':controlPreferences,'picker-save':pickerSave,'picker-load':pickerLoad,'picker-cancel':pickerCancel,'picker-saved':pickerSaved,'picker-reviewed':pickerReviewed,'picker-prepare-restore':pickerPrepareRestore,'picker-commit':pickerCommit,'picker-restored':pickerRestored};
    const result=JSON.parse(await evaluate(scripts[phase]));
    // Only the current candidate has Android's SAF backup bridge. The historical
    // 1.0.57 source deliberately did not expose it.
    if(phase==='verify'){
      const check=await evaluate("typeof window.ThornhavenCloudSave==='object' && typeof window.ThornhavenCloudSave.save==='function' && typeof window.ThornhavenCloudSave.load==='function' && typeof window.ThornhavenCloudSave.manage==='function' && !!document.getElementById('titleCloudSave') && document.getElementById('cloudSaveHelp').textContent.includes('Google Drive')");
      assert(check,'Android WebView save backup bridge/menu is unavailable');
      console.log('PASS native Android WebView legacy inventory: '+await evaluate(legacyInventory));
      console.log('PASS native Android WebView merchant Sell tab: '+await evaluate(legacyShop));
    }
    console.log('PASS native Android WebView '+phase+': '+JSON.stringify(result));
  }finally{ws.close()}
})().catch(e=>{console.error('FAIL native Android WebView '+phase,e);process.exitCode=1});

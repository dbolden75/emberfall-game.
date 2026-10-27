#!/usr/bin/env node
// Connect to the *actual emulator Android WebView* via its forwarded DevTools
// socket. QA workflow patches WebView debugging on in disposable DEBUG builds
// only. Production MainActivity and all signed release artifacts are untouched.
'use strict';
const assert=require('node:assert/strict');
const phase=process.argv[2];
assert(['create','preupgrade','verify','picker-save','picker-load','picker-cancel'].includes(phase),'Usage: node emulator-webview-probe.cjs create|preupgrade|verify|picker-save|picker-load|picker-cancel');
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
const pickerCancel=String.raw`(()=>{
  const status=document.getElementById('cloudSaveStatus')?.textContent||'';
  if(!status.includes('Cancelled. Local progress is unchanged.'))
    throw Error('Cancelled picker did not restore local UI state: '+status);
  for(const id of ['cloudSaveExport','cloudSaveImport','cloudSaveClose'])
    if(document.getElementById(id).disabled)throw Error('Picker cancellation left '+id+' disabled');
  return JSON.stringify({cancelConfirmed:true,localSaveUnchanged:true});
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
    const scripts={create,preupgrade:verify,verify,'picker-save':pickerSave,'picker-load':pickerLoad,'picker-cancel':pickerCancel};
    const result=JSON.parse(await evaluate(scripts[phase]));
    // Only the current candidate has Android's SAF backup bridge. The historical
    // 1.0.57 source deliberately did not expose it.
    if(phase==='verify'){
      const check=await evaluate("typeof window.ThornhavenCloudSave==='object' && typeof window.ThornhavenCloudSave.save==='function' && typeof window.ThornhavenCloudSave.load==='function' && typeof window.ThornhavenCloudSave.manage==='function' && !!document.getElementById('titleCloudSave') && document.getElementById('cloudSaveHelp').textContent.includes('Google Drive')");
      assert(check,'Android WebView save backup bridge/menu is unavailable');
    }
    console.log('PASS native Android WebView '+phase+': '+JSON.stringify(result));
  }finally{ws.close()}
})().catch(e=>{console.error('FAIL native Android WebView '+phase,e);process.exitCode=1});

#!/usr/bin/env node
// Connect to the *actual emulator Android WebView* via its forwarded DevTools
// socket. QA workflow patches WebView debugging on in disposable DEBUG builds
// only. Production MainActivity and all signed release artifacts are untouched.
'use strict';
const assert=require('node:assert/strict');
const phase=process.argv[2];
assert(['create','preupgrade','verify'].includes(phase),'Usage: node emulator-webview-probe.cjs create|preupgrade|verify');
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
  document.getElementById('gameView').hidden=false;
  const observed=[];
  for(const id of ids){
    if(!setMap(id,480,320,false))throw Error('Town transition rejected: '+id);
    // Let Android's real requestAnimationFrame loop advance naturally.
    await new Promise(resolve=>setTimeout(resolve,500));
    if(mapId!==id||!activeMap.town||!activeMap.npcs.length)throw Error('Town unusable: '+id);
    saveGame();
    const snap=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(!snap||snap.mapId!==id)throw Error('Town save failed: '+id);
    observed.push({id,npcs:activeMap.npcs.length});
  }
  player.name='EmulatorUpgradeQA';player.coins=173;saveGame();
  const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  if(saved?.player?.name!=='EmulatorUpgradeQA'||saved.player.coins!==173||
     !slots||!slots[activeSlotId])throw Error('Character/slot save failed');
  localStorage.setItem('thornhaven_emulator_upgrade_qa',
    JSON.stringify({name:saved.player.name,coins:saved.player.coins,map:saved.mapId,slot:activeSlotId}));
  return JSON.stringify({towns:observed,savedName:saved.player.name,coins:saved.player.coins,map:saved.mapId});
})()`;
const verify=String.raw`(()=>{
  const key='thornhaven_emulator_upgrade_qa';
  const expected=JSON.parse(localStorage.getItem(key)||'null');
  const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  const slots=JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)||'null');
  if(!expected)throw Error('QA sentinel disappeared during -r upgrade');
  if(!save||save.player?.name!==expected.name||save.player?.coins!==expected.coins||
     save.mapId!==expected.map)throw Error('Player progression changed after -r upgrade');
  if(!slots?.[expected.slot]||slots[expected.slot].state?.player?.name!==expected.name)
    throw Error('Character save slot disappeared after -r upgrade');
  if(localStorage.getItem(ACTIVE_SLOT_KEY)!==expected.slot)
    throw Error('Active character slot changed after -r upgrade');
  return JSON.stringify({name:save.player.name,coins:save.player.coins,map:save.mapId,slot:expected.slot});
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
    const result=JSON.parse(await evaluate(phase==='create'?create:verify));
    console.log('PASS native Android WebView '+phase+': '+JSON.stringify(result));
  }finally{ws.close()}
})().catch(e=>{console.error('FAIL native Android WebView '+phase,e);process.exitCode=1});

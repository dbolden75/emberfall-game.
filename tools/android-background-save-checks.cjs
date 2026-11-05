#!/usr/bin/env node
// Execute the real background save confirmation JavaScript extracted from
// MainActivity and check its Android lifecycle guards. No phone is involved.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const java = fs.readFileSync('app/src/main/java/com/emberfall/ashvale/MainActivity.java', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const between = (start, end) => {
  const a=java.indexOf(start), b=java.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Missing Android lifecycle section: '+start);
  return java.slice(a,b);
};
const pause=between('protected void onPause()','protected void onResume()');
const resume=between('protected void onResume()','protected void onDestroy()');
assert(html.includes("window.addEventListener('pagehide',()=>{if(!switchingCharacter)saveGame()})"),
  'The existing pagehide save must still run');
assert(java.includes('game.loadUrl("file:///android_asset/index.html")'),
  'Keep the historical WebView save origin');
assert(java.includes('settings.setDomStorageEnabled(true)'),
  'Do not disable durable localStorage');
const call=pause.match(/pausedView\.evaluateJavascript\(\s*([\s\S]*?),\s*result\s*->/);
assert(call,'Android onPause must evaluate a save verification');
const script=Function('return '+call[1])();
for(const term of ["window.dispatchEvent(new Event('pagehide'))",
  'snapshotGameState()', 'SAVE_SLOTS_KEY', 'activeSlotId',
  'JSON.stringify(row.state)===JSON.stringify(expected)']) {
  assert(script.includes(term),'Missing authoritative save check: '+term);
}
function simulate({write=true,throwSave=false,hasStarted=true,titleMenuActive=false,
  switchingCharacter=false,previous=false,malformed=false}={}) {
  const state={player:{name:'Background Tester',level:8},townQuestState:{patrol:2}};
  let stored=previous ? JSON.stringify({one:{state:{player:{name:'Old Tester'}}}}) : null;
  if(malformed)stored='{broken json';
  let events=0;
  const env={JSON,hasStarted,titleMenuActive,switchingCharacter,activeSlotId:'one',
    SAVE_SLOTS_KEY:'slots',
    snapshotGameState:()=>JSON.parse(JSON.stringify(state)),
    saveGame:()=>{if(throwSave)throw Error('quota exceeded');
      if(write)stored=JSON.stringify({one:{state}});},
    localStorage:{getItem:key=>key==='slots'?stored:null},
    Event:class Event{constructor(type){this.type=type;}}};
  env.window={dispatchEvent:event=>{assert.equal(event.type,'pagehide');
    events++;if(!switchingCharacter)env.saveGame();}};
  const result=vm.runInNewContext(script,env);
  assert.equal(events,1,'Must dispatch pagehide exactly once');
  return result;
}
assert.equal(simulate(),true,'Committed character save confirmed');
assert.equal(simulate({write:false}),false,'Silent storage refusal detected');
assert.equal(simulate({write:false,previous:true}),false,'Stale slot is not confirmation');
assert.equal(simulate({throwSave:true}),false,'Thrown quota failure detected');
assert.equal(simulate({malformed:true,write:false}),false,'Corrupt slot JSON detected');
assert.equal(simulate({hasStarted:false}),true,'Title startup requires no character slot');
assert.equal(simulate({titleMenuActive:true}),true,'Title menu may background');
assert.equal(simulate({switchingCharacter:true}),true,'Character switching does not overwrite old slot');
assert(pause.includes('if (!"true".equals(result)) backgroundSaveFailed(pausedView, epoch)'),
  'Failed JS verification must be recorded');
assert(pause.includes('backgroundSaveFailed(pausedView, epoch)')&&pause.includes('if (!answered[0])'),
  'Missing callback must be recorded and guarded against duplicate completion');
assert(pause.includes('pausedView.onPause()')&&pause.includes('pausedView.pauseTimers()'),
  'WebView and timers eventually pause');
assert(!pause.includes('game.onPause()')&&!pause.includes('game.pauseTimers()'),
  'Do not pause WebView before async save callback');
assert(resume.includes('lifecyclePaused = false')&&resume.includes('++pauseEpoch'),
  'Resuming must invalidate callbacks from earlier pause');
assert(resume.includes('game.onResume()')&&resume.includes('game.resumeTimers()'),
  'WebView and timers must resume');
assert(resume.includes('if (backgroundSaveUnverified)')&&resume.includes('Toast.makeText'),
  'On resume notify player of unconfirmed background save');
assert(java.includes('if (game != view || pauseEpoch != epoch) return;'),
  'Stale WebView/Activity callback must never mark a new session failed');
const destroy=java.slice(java.indexOf('protected void onDestroy()'));
assert(destroy.includes('++pauseEpoch'),'Destroy must invalidate stale callbacks');
console.log('PASS: 8 production background-save JavaScript scenarios and native lifecycle guards. Mocked storage, not device testing.');

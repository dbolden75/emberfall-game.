#!/usr/bin/env node
// Static lifecycle regression guard. Android emulator remains the actual
// WebView save-upgrade test; this check never claims physical-device coverage.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const java = fs.readFileSync('app/src/main/java/com/emberfall/ashvale/MainActivity.java', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const between = (start, end) => {
  const a = java.indexOf(start), b = java.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Missing Android lifecycle section: ' + start);
  return java.slice(a, b);
};
const pause = between('protected void onPause()', 'protected void onResume()');
const resume = between('protected void onResume()', 'protected void onDestroy()');
assert(html.includes("window.addEventListener('pagehide',()=>{if(!switchingCharacter)saveGame()})"),
       'The game must still commit character saves on pagehide');
assert(java.includes('game.loadUrl("file:///android_asset/index.html")'),
       'Keep the historical WebView save origin');
assert(java.includes('settings.setDomStorageEnabled(true)'),
       'Do not disable durable localStorage');
assert(pause.includes('evaluateJavascript("window.dispatchEvent(new Event(\'pagehide\'))"'),
       'Android onPause must request the game save');
assert(pause.includes('ignored -> finishPause.run()'),
       'Do not pause JS before the save evaluation completes');
assert(pause.includes('pausedView.postDelayed(finishPause, 1000)'),
       'Always bound the background-processing fallback');
assert(pause.includes('pauseEpoch != epoch') && pause.includes('game != pausedView'),
       'Ignore stale completion callbacks after orientation/Activity destruction');
assert(pause.includes('pausedView.onPause()') && pause.includes('pausedView.pauseTimers()'),
       'The WebView must eventually pause its work');
assert(!pause.includes('game.onPause()') && !pause.includes('game.pauseTimers()'),
       'Never pause the WebView immediately after scheduling an asynchronous save');
assert(resume.includes('lifecyclePaused = false') && resume.includes('++pauseEpoch'),
       'On resume, invalidate a late onPause callback to avoid freezing gameplay');
assert(resume.includes('game.onResume()') && resume.includes('game.resumeTimers()'),
       'Resume both WebView and timers');
const destroy = java.slice(java.indexOf('protected void onDestroy()'));
assert(destroy.includes('++pauseEpoch'), 'Invalidate pending callbacks on destroy');
console.log('PASS (static): Android pagehide save is scheduled before WebView pause, with a bounded fallback, stale callback guard, and unchanged save origin.');
console.log('NOT VERIFIED: JavaScript callback timing under Android process death; use the emulator and a real-device update for that.');

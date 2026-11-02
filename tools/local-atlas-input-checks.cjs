'use strict';
// Regression for stuck movement/auto-walk when opening the in-game local map.
// This is an isolated VM test, not an Android-device or Play Store test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/src/main/assets/playtest-update.js', 'utf8');
const match = source.match(/function open\(\)\{[^\n]*\}/);
assert(match, 'Local atlas open handler must exist');

function scenario(started, previouslyPaused) {
  const events = [];
  const ctx = {
    hasStarted: started,
    panel: {hidden: true},
    window: {jarvisPaused: previouslyPaused},
    priorPause: false,
    attackHeld: true,
    zoom: 3, panX: 50, panY: -20,
    tapTarget: {x: 10, y: 10},
    keys: new Set(['ArrowRight', 'KeyW']),
    stopWorldTouch: () => events.push('stopWorldTouch'),
    clearPadTouches: () => events.push('clearPadTouches'),
    reveal: () => events.push('reveal'),
    paint: () => events.push('paint')
  };
  vm.createContext(ctx);
  vm.runInContext(match[0] + '\nthis.openLocalMap=open;', ctx);
  ctx.openLocalMap();
  if (!started) {
    assert.equal(ctx.panel.hidden, true, 'Pre-game map must remain closed');
    assert.equal(ctx.keys.size, 2, 'Pre-game inputs must be unchanged');
    assert.deepEqual(events, []);
    return;
  }
  assert.equal(ctx.panel.hidden, false, 'Map opens');
  assert.equal(ctx.window.jarvisPaused, true, 'Simulation pauses');
  assert.equal(ctx.priorPause, previouslyPaused, 'Existing pause state remains available');
  assert.equal(ctx.attackHeld, false, 'Held attack must clear');
  assert.equal(ctx.tapTarget, null, 'Autowalk must clear');
  assert.equal(ctx.keys.size, 0, 'Held keyboard movement must clear');
  assert.deepEqual(events,
    ['stopWorldTouch', 'clearPadTouches', 'reveal', 'paint'],
    'Touch steering must be cancelled before map is painted');
  assert.equal(ctx.zoom, 1);
  assert.equal(ctx.panX, 0);
  assert.equal(ctx.panY, 0);
}

scenario(false, false);
scenario(true, false);
scenario(true, true);
console.log('PASS: local-map opening releases movement/touch/attack/autowalk input and retains pause state. Mocked state only.');

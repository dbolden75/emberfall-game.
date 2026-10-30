#!/usr/bin/env node
'use strict';
// Static safety gate for the two Android 14 emulator legs. This cannot replace
// native tests: it prevents accidental loss of native orientation/UI assertions
// when splitting a flaky hosted-emulator run into independent jobs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const probe=fs.readFileSync('tools/emulator-webview-probe.cjs','utf8');
const shell=fs.readFileSync('tools/emulator-control-matrix-qa.sh','utf8');
const workflow=fs.readFileSync('.github/workflows/thornhaven-emulator-smoke.yml','utf8');
const match=probe.match(/const controlPreferences=String\.raw`([\s\S]*?)`;/);
assert(match,'Native Android WebView control-preferences probe missing');
const expression=match[1],needle="['portrait','landscape']";
assert.equal(expression.split(needle).length,3,'Both native orientation loops must remain');
assert.match(expression,/for\(const side of \['right','left'\]\)/,'Both control sides required');
assert.match(expression,/for\(const mode of \['touch','arrows'\]\)/,'Both movement modes required');
for(const assertion of ['rectInView(', 'overlapPx>1','Touch-mode actions ignored Left side',
                        'MENU movement preference did not persist',
                        'MENU side preference did not persist',
                        'MENU movement/side choices replaced character progression']){
  assert(expression.includes(assertion),'Lost control/save assertion: '+assertion);
}
assert.match(probe,/'control-preferences-portrait':controlPreferencesFor\('portrait'\)/);
assert.match(probe,/'control-preferences-landscape':controlPreferencesFor\('landscape'\)/);
assert.match(workflow,/orientation: \[portrait, landscape\]/);
assert.match(workflow,/fail-fast: false/);
assert(workflow.includes('script: bash tools/emulator-control-matrix-qa.sh ${{ matrix.orientation }}'));
assert(workflow.includes('name: thornhaven-164-android-control-matrix-${{ matrix.orientation }}-evidence'));
assert(shell.includes('control-preferences-$orientation'),'Native matrix must select its orientation');
assert(shell.includes('shell -T run-as "$PKG" tee shared_prefs/com.emberfall.ashvale.MainActivity.xml'), 'Native portrait startup preference must be seeded with an app-UID write before WebView');
// Android Activity.getLocalClassName() strips the application package only
// when it is an actual prefix; this app deliberately retains a legacy namespace.
const pkg=shell.match(/^PKG=(.+)$/m)[1],activity=shell.match(/^ACTIVITY=(.+)$/m)[1];
const localClass=activity.startsWith(pkg+'.')?activity.slice(pkg.length+1):activity;
assert.equal(localClass,'com.emberfall.ashvale.MainActivity');
assert(shell.includes('cat shared_prefs/'+localClass+'.xml'), 'Read back the exact Android Activity preference file');
assert(!shell.includes('shared_prefs/MainActivity.xml'), 'Wrong short preference filename would not seed this activity');
assert(shell.indexOf('initial-native-preference.xml')<shell.indexOf('am start -n'), 'Native pref must be seeded before app launch');
assert(expression.includes("const already=ThornhavenDevice.getOrientationPreference()===orientation"), 'Orientation must be verified before avoiding redundant rotation');
for(const orientation of ['portrait','landscape']){
  const scoped=expression.replaceAll(needle,"['"+orientation+"']")
    .replace('ThornhavenDevice.setOrientationPreference(originalOrientation);',
             '/* no return rotation on disposable emulator */');
  // Parse both resulting real Android WebView expressions; never execute
  // them here since the DOM/native bridge exists only on the Android emulator.
  new Function('return '+scoped);
}
const check=spawnSync('bash',['-n','tools/emulator-control-matrix-qa.sh'],{encoding:'utf8'});
assert.equal(check.status,0,'Shell syntax invalid: '+check.stderr);
console.log('PASS: Android 14 CI requires 2 native orientations x 2 sides x 2 movement modes; all geometry, save and setting assertions retained. This is static, NOT emulator/device testing.');

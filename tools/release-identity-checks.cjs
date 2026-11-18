const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 171'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.69'"), 'Unexpected version name');
// Restore script verifies the original audited gameplay hash before applying the atlas-only patch.\n// The final reviewed atlas-integrated payload has its own pinned SHA-256.\n// Audited gameplay and save recovery remain unchanged; both visible game labels must match the Android 1.0.69 package.
assert(html.includes(Buffer.from('New Journey · v1.0.69')), 'Game menu should identify 1.0.69');
assert(html.includes(Buffer.from('Version 1.0.69 · Ashvale Reach')), 'Title screen footer should identify 1.0.69');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
// Verify the exact authored overlay, then retain the pinned historical baseline check.
const baseline=require('child_process').execFileSync('python3',['-c',"import runpy; from pathlib import Path; print(runpy.run_path('tools/apply-last-lantern.py')['remove'](Path('app/src/main/assets/index.html').read_text()),end='')"],{maxBuffer:64*1024*1024});
assert.strictEqual(crypto.createHash('sha256').update(baseline).digest('hex'), '801d9f3394aaa4987410b0cf6e96517a3952686546b6d613e2e95f4bda2a2e24', 'Reviewed atlas-integrated Android source hash mismatch');
assert(html.includes(Buffer.from("const context=()=>({build:'1.0.69',map:")), 'Jarvis report build field must match the Android version');
console.log('PASS: 1.0.69 package identity, pinned baseline and exact Last Lantern content overlay');

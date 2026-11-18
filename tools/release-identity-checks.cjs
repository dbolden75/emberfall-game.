const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 172'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.70'"), 'Unexpected version name');
// Restore script verifies the original audited gameplay hash before applying the atlas-only patch.\n// The final reviewed atlas-integrated payload has its own pinned SHA-256.\n// Audited gameplay and save recovery remain unchanged; both visible game labels must match the Android 1.0.70 package.
assert(html.includes(Buffer.from('New Journey · v1.0.70')), 'Game menu should identify 1.0.70');
assert(html.includes(Buffer.from('Version 1.0.70 · Ashvale Reach')), 'Title screen footer should identify 1.0.70');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
require('child_process').execFileSync('python3',['tools/verify-release-candidate-169.py'],{stdio:'inherit'});
assert(html.includes(Buffer.from("const context=()=>({build:'1.0.70',map:")), 'Jarvis report build field must match the Android version');
console.log('PASS: 1.0.70 package identity, pinned baseline and exact Last Lantern content overlay');

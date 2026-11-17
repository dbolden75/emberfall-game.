const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 170'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.68'"), 'Unexpected version name');
// Restore script verifies the original audited gameplay hash before applying the atlas-only patch.\n// The final reviewed atlas-integrated payload has its own pinned SHA-256.\n// Audited gameplay and save recovery remain unchanged; both visible game labels must match the Android 1.0.68 package.
assert(html.includes(Buffer.from('New Journey · v1.0.68')), 'Game menu should identify 1.0.68');
assert(html.includes(Buffer.from('Version 1.0.68 · Ashvale Reach')), 'Title screen footer should identify 1.0.68');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex'), '9fa2d220141f329467e7d1978ca628f78dc2a6975c46eb7f2d55221e701cec88', 'Reviewed atlas-integrated Android source hash mismatch');
assert(html.includes(Buffer.from("const context=()=>({build:'1.0.68',map:")), 'Jarvis report build field must match the Android version');
console.log('PASS: 1.0.68 Android package identity and audited save-recovery game payload hash');

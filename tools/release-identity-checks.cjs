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
assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex'), '22d4d109078cbcedc7973c205dc8ea3064c4a02ebbf40ca495fbc87aa13e147c', 'Reviewed atlas-integrated Android source hash mismatch');
assert(html.includes(Buffer.from("const context=()=>({build:'1.0.69',map:")), 'Jarvis report build field must match the Android version');
console.log('PASS: 1.0.69 Android package identity and audited save-recovery game payload hash');

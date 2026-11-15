const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 169'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.67'"), 'Unexpected version name');
// Restore script verifies the original audited gameplay hash before applying the atlas-only patch.\n// The final reviewed atlas-integrated payload has its own pinned SHA-256.\n// Audited gameplay and save recovery remain unchanged; both visible game labels must match the Android 1.0.67 package.
assert(html.includes(Buffer.from('New Journey · v1.0.67')), 'Game menu should identify 1.0.67');
assert(html.includes(Buffer.from('Version 1.0.67 · Ashvale Reach')), 'Title screen footer should identify 1.0.67');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex'), '8d1dba7c1a1cf37417d0f2e8ac8aa25615cbc13d00258f062eea01a23493e09f', 'Reviewed atlas-integrated Android source hash mismatch');
assert(html.includes(Buffer.from("const context=()=>({build:'1.0.67',map:")), 'Jarvis report build field must match the Android version');
console.log('PASS: 1.0.67 Android package identity and audited save-recovery game payload hash');

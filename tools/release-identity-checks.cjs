const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 169'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.67'"), 'Unexpected version name');
// Audited gameplay and save recovery remain unchanged; both visible game labels must match the Android 1.0.67 package.
assert(html.includes(Buffer.from('New Journey · v1.0.67')), 'Game menu should identify 1.0.67');
assert(html.includes(Buffer.from('Version 1.0.67 · Ashvale Reach')), 'Title screen footer should identify 1.0.67');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex'), '12f8a29e6e1973b3d580a9f0f5b108e2564470f50993963a0c2e688c91dbf123');
console.log('PASS: 1.0.67 Android package identity and audited save-recovery game payload hash');

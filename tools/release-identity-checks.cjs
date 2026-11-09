const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 169'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.67'"), 'Unexpected version name');
// The Android version remains 1.0.67; generated game HTML includes the reviewed save-recovery fix and retains the in-game 1.0.64 display label.
assert(html.includes(Buffer.from('New Journey · v1.0.64')), 'Game menu should identify 1.0.64');
assert(html.includes(Buffer.from('Version 1.0.64 · Ashvale Reach')), 'Title screen footer should identify 1.0.64');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex'), 'db2b079172a26bad3a4604fc99957f00009b50d4e973f96d63a318988bcaa809');
console.log('PASS: 1.0.67 Android package identity and audited save-recovery game payload hash');

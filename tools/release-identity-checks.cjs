const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const gradle = fs.readFileSync('app/build.gradle', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html');
assert(gradle.includes("applicationId 'com.vaelbrink.ashvale.newjourney'"), 'App package identity changed');
assert(gradle.includes('versionCode 168'), 'Unexpected Android version code');
assert(gradle.includes("versionName '1.0.66'"), 'Unexpected version name');
// The version bump changes Android package metadata only; the audited game HTML remains v1.0.64 byte-for-byte.
assert(html.includes(Buffer.from('New Journey · v1.0.64')), 'Game menu should identify 1.0.64');
assert(html.includes(Buffer.from('Version 1.0.64 · Ashvale Reach')), 'Title screen footer should identify 1.0.64');
assert(!html.includes(Buffer.from('Version 1.0.62 · Ashvale Reach')), 'Stale title screen footer remains');
assert.strictEqual(crypto.createHash('sha256').update(html).digest('hex'), 'f57cc406c3c027cf12803d4711d6522c23ad079a217147e3732485404e4a3c6d');
console.log('PASS: 1.0.66 Android package identity with unchanged audited 1.0.64 game payload hash');

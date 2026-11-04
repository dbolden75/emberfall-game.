#!/usr/bin/env node
'use strict';
// Source guard for request-code wiring. The separate native callback harness
// executes production onActivityResult in Java; this checks picker creation.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/CloudSaveDocuments.java','utf8');
const start=src.indexOf('boolean onActivityResult(int requestCode, int resultCode, Intent data)');
const end=src.indexOf('private void finishDocument(',start);
assert(start>=0&&end>start,'Missing Android picker result handler');
const handler=src.slice(start,end);
const requested=handler.indexOf('Pending request = pending;');
const mismatch=handler.indexOf('if (request != null && requestCode != request.requestCode) return true;');
const cleared=handler.indexOf('pending = null;');
const uri=handler.indexOf('Uri uri = data.getData();');
assert(requested>=0&&mismatch>requested&&cleared>mismatch&&uri>cleared,
  'A stale callback must not consume the pending request or its document URI');
assert(handler.includes('requestCode < CREATE_DOCUMENT_REQUEST')
  &&handler.includes('requestCode > OPEN_DOCUMENT_REQUEST + 2 * (REQUEST_CODE_GENERATIONS - 1)'),
  'Unrelated Activity results must be forwarded; late picker results must be consumed');
assert(src.includes('new Pending(id, "save", bytes, allocateRequestCode(CREATE_DOCUMENT_REQUEST))')
  &&src.includes('new Pending(id, "load", null, allocateRequestCode(OPEN_DOCUMENT_REQUEST))'),
  'Both picker types must allocate per-operation codes');
assert.equal((src.match(/startActivityForResult\(intent, pending\.requestCode\);/g)||[]).length,2,
  'Both Android pickers must pass the unique pending code to Activity');
assert(handler.includes('result(request.id, request.action, false, true, null, null);'),
  'A matching cancelled picker must still notify the game');
assert(handler.includes('documentIoActive = true;')&&handler.includes('io.execute('),
  'A matching picker must still perform asynchronous document I/O');
console.log('PASS (source gate): unique SAVE/LOAD request-code routing and stale-result isolation');
console.log('NOT VERIFIED: real out-of-order document provider callbacks on Samsung.');

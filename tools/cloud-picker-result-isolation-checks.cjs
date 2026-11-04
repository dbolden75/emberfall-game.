#!/usr/bin/env node
'use strict';
// This is a source guard; Android CI compiles the real Activity and emulator QA
// covers actual document picker behaviour. No phone/provider test is claimed.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/CloudSaveDocuments.java','utf8');
const start=src.indexOf('boolean onActivityResult(int requestCode, int resultCode, Intent data)');
const end=src.indexOf('private void finishDocument(',start);
assert(start>=0&&end>start,'Missing Android picker result handler');
const handler=src.slice(start,end);
const requested=handler.indexOf('Pending request = pending;');
const expected=handler.indexOf('int expectedCode = "save".equals(request.action)');
const mismatch=handler.indexOf('if (requestCode != expectedCode) return true;');
const cleared=handler.indexOf('pending = null;');
const uri=handler.indexOf('Uri uri = data.getData();');
assert(requested>=0&&expected>requested&&mismatch>expected&&cleared>mismatch&&uri>cleared,
  'A stale picker callback must return before consuming the current pending request or writing a document');
assert(handler.includes('CREATE_DOCUMENT_REQUEST : OPEN_DOCUMENT_REQUEST'),
  'Match the picker code with save/load rather than trusting any Thornhaven picker result');
assert(handler.includes('if (requestCode != CREATE_DOCUMENT_REQUEST && requestCode != OPEN_DOCUMENT_REQUEST) return false;'),
  'Unrelated Android Activity results must still reach the parent Activity');
assert(handler.includes('result(request.id, request.action, false, true, null, null);'),
  'Cancel from the correct picker must still clear pending and notify the game');
assert(handler.includes('documentIoActive = true;')&&handler.includes('io.execute('),
  'A matching result must still perform asynchronous document I/O');
console.log('PASS (source gate): stale SAVE/LOAD picker callbacks cannot consume opposite pending document request');
console.log('NOT VERIFIED: out-of-order callback on a real Android document provider or Samsung phone.');

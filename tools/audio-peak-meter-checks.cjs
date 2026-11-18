/* Independent bounded-memory native decoder regression; no licensed media required. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {nativeDecodedPeak}=require('./audio-assets-checks.cjs');
function wave(file,amplitude){
  const samples=44100,pcm=Buffer.alloc(samples*4),header=Buffer.alloc(44);
  for(let i=0;i<samples;i++)pcm.writeFloatLE(Math.sin(i*2*Math.PI*440/44100)*amplitude,i*4);
  header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);
  header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
  header.writeUInt16LE(3,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(44100,24);header.writeUInt32LE(176400,28);
  header.writeUInt16LE(4,32);header.writeUInt16LE(32,34);
  header.write('data',36);header.writeUInt32LE(pcm.length,40);
  fs.writeFileSync(file,Buffer.concat([header,pcm]));
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-audio-meter-'));
try {
  const valid=path.join(dir,'valid.wav');wave(valid,.25);
  assert(Math.abs(nativeDecodedPeak(valid)-.25)<.001);
  const silent=path.join(dir,'silent.wav');wave(silent,0);
  assert.throws(()=>nativeDecodedPeak(silent),/silent\/clipped/);
  const clipped=path.join(dir,'clipped.wav');wave(clipped,1.2);
  assert.throws(()=>nativeDecodedPeak(clipped),/silent\/clipped/);
  const corrupt=path.join(dir,'corrupt.wav');fs.writeFileSync(corrupt,'not audio');
  assert.throws(()=>nativeDecodedPeak(corrupt),/FFmpeg failed/);
  console.log('PASS: decoded audio peaks accept safe samples and reject silence, overshoot and corrupt files');
} finally {fs.rmSync(dir,{recursive:true,force:true});}

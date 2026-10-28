'use strict';
// Regression for historical saves that omit one or both enemy coordinates.
// Test expressions from the reconstructed game, not a duplicate helper.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
for(const [scenario,suffix] of [
 ['per-map enemy snapshot','spawnX:'],
 ['older top-level enemy list','hp:']
]){
 const expression=new RegExp('Object\\\\.assign\\\\(enemy,\\\\{x:([^,]+),y:([^,]+),'+suffix);
 const match=html.match(expression);
 assert(match,'Missing coordinate restoration expression for '+scenario);
 const coordinate=new Function('e','enemy','return {x:('+match[1]+'),y:('+match[2]+')};');
 for(const [saved,expected] of [
  [{alive:false},{x:145,y:268}],
  [{x:7},{x:7,y:268}],
  [{y:9},{x:145,y:9}],
  [{x:0,y:0},{x:0,y:0}],
  [{x:-20,y:423},{x:-20,y:423}]
 ]){
  const restored=coordinate(saved,{x:145,y:268});
  assert.deepEqual(restored,expected,scenario+' must retain valid positions');
  assert(Number.isFinite(restored.x)&&Number.isFinite(restored.y),scenario+' must never produce undefined/NaN');
 }
}
console.log('PASS: historical enemy snapshots preserve valid enemy coordinates.');

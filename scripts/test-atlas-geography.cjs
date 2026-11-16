// Nonbreaking atlas geography regression: run with node scripts/test-atlas-geography.cjs
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const packaged=fs.readFileSync('app/src/main/assets/index.html','utf8');
// The root web page is NOT the Android game. Enforce the same reviewed overlay
// in the reconstructed Android WebView payload before considering this PR shippable.
const overlayStart=' // Fictionalized Alabama-inspired geography:';
const overlayEnd=' // Dirt roads connect exactly';
function geographyOverlay(source){
 const start=source.indexOf(overlayStart);
 assert(start!==-1,'Alabama-inspired geography absent from source');
 const end=source.indexOf(overlayEnd,start);
 assert(end>start,'Geography block missing preserved roads');
 return source.slice(start,end);
}
assert.equal(geographyOverlay(packaged),geographyOverlay(html),
 'Android APK will not contain the same atlas shown by web preview');
for(const key of ['emberfall_character_slots_v1','emberfall_active_character_slot_v1','emberfall_singleplayer_v1']){
 assert(packaged.includes(key),'Historical save identity missing from Android source: '+key);
}
const atlas=html.slice(html.indexOf('function drawThemedWorldMap(){'),html.indexOf('function paintExplorationFog(){'));
assert(atlas.startsWith('function drawThemedWorldMap(){'),'atlas renderer exists');
assert(atlas.includes('worldGrid.forEach'),'atlas still uses gameplay region grid');
assert(atlas.includes('atlasBiome(id)'),'existing biome assignment preserved');
assert(atlas.includes('Fictionalized Alabama-inspired geography'),'new geography layer exists');
for(const token of ['Main river:','Western tributary','Foothill ridges','Southern marsh clusters','Dirt roads connect exactly']){
 assert(atlas.includes(token),'missing atlas layer: '+token);
}
assert(html.includes('worldPositions[id]=['),'map markers still derive from worldGrid');
assert(html.includes("links.exits.push({trigger:'edge',side,to,...gate})"),'cardinal travel topology still generated');
assert(html.includes("paintExplorationFog();const focus="),'atlas initialization still executes');
const scripts=[...html.matchAll(new RegExp('<script(?:\\s[^>]*)?>([\\s\\S]*?)</script>','gi'))].map(m=>m[1]).filter(Boolean);
assert(scripts.length>0,'game scripts exist');
for(const script of scripts)new vm.Script(script,{filename:'game-inline.js'});
console.log('PASS: atlas geography present; map topology hooks retained; inline JS parses');

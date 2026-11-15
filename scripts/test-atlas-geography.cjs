// Nonbreaking atlas geography regression: run with node scripts/test-atlas-geography.cjs
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
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

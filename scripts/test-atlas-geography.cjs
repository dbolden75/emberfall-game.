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

// Preserve the existing 9×9 save-addressable world layout until an intentional
// region migration is designed. The atlas may change appearance but cannot
// silently rearrange legacy map IDs, quest destinations or compass routes.
function parseWorldGrid(source){
 const match=source.match(/const worldGrid\s*=\s*(\[[\s\S]*?\]);/);
 assert(match,'worldGrid not found in game source');
 return JSON.parse(match[1]);
}
const grid=parseWorldGrid(html),androidGrid=parseWorldGrid(packaged);
assert.deepEqual(androidGrid,grid,'Android and browser world-grid mappings differ');
assert.equal(grid.length,9,'Historical 9-row world layout changed');
assert(grid.every(row=>row.length===9),'Historical 9-column world layout changed');
const ids=grid.flat();
assert.equal(new Set(ids).size,81,'World grid contains missing or duplicate region IDs');
const baselineGridSha256='e85017316443bc93d5db86c5ce3f6c893e9e2d49284ee07eaa3539908044464e';
const gridHash=require('node:crypto').createHash('sha256').update(JSON.stringify(grid)).digest('hex');
assert.equal(gridHash,baselineGridSha256,'Existing saved-region coordinates changed without a migration');
const questLine=html.split('\n').find(line=>line.startsWith('const townQuestDefs='));
assert(questLine,'Town quest definitions not found');
const questAreas=[...questLine.matchAll(/area:'([^']+)'/g)].map(match=>match[1]);
assert(questAreas.length>=8,'Expected established four-town quest destinations');
const required=new Set(['ashvale','sunmere','brackenford','stonewatch',...questAreas]);
for(const id of required)assert(ids.includes(id),'Town or quest region missing from world grid: '+id);
// A new game must be able to reach each town and early town quest without
// crossing either the Fourfold Key shrine or the Ember Sigil dungeon.
const sealed=new Set(['mosslight','emberdeep']);
const positions=new Map(grid.flatMap((row,y)=>row.map((id,x)=>[id,[x,y]])));
const queue=['ashvale'],visited=new Set(queue);
for(let i=0;i<queue.length;i++){
 const [x,y]=positions.get(queue[i]);
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const next=grid[y+dy]?.[x+dx];
  if(next&&!sealed.has(next)&&!visited.has(next)){visited.add(next);queue.push(next);}
 }
}
assert.equal(visited.size,79,'One or more ordinary regions are isolated by gated maps');
for(const id of required)assert(visited.has(id),'Quest/town cannot be reached before shrine unlock: '+id);
assert(packaged.includes("links.exits=links.exits.filter(e=>e.trigger!=='edge');"),
 'Android source must rebuild compass exits from the current grid');

console.log('PASS: atlas geography, 81 stable region IDs, quest/town reachability, save coordinates and inline JS');

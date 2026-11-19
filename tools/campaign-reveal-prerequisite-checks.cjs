'use strict';
// Dependency audit, NOT a normal-speed campaign playthrough. Inspect the real
// game definitions/runtime to catch circular prerequisites introduced by hiding
// vampire encounters before the later reveal. No quest completion is simulated.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const fixture=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8').split('const probe=')[0];
const root=new Function('require',fixture+'return root;')(require);
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(m[1].includes('application/'))continue;
 const src=m[1].match(/src="([^"]+)"/);
 vm.runInContext(src?fs.readFileSync('app/src/main/assets/'+src[1],'utf8'):m[2],root);
}
root.assert=assert;
const result=vm.runInContext(`(()=>{
 assert(!vampireRevealKnown());
 const reachable=new Set(['wayfarers_camp']),queue=['wayfarers_camp'];
 while(queue.length){const id=queue.shift();for(const exit of mapConnections[id]?.exits||[]){
  if(['veilhaven','last_lantern'].includes(exit.to)||reachable.has(exit.to))continue;
  reachable.add(exit.to);queue.push(exit.to);
 }}
 const quests=[];
 for(const [town,arc] of Object.entries(townRelicQuestSets)){
  assert(reachable.has(town),'Town route needs revealed content: '+town);
  for(const id of arc.quests){
   const q=townQuestDefs[id];assert(q,'Missing prerequisite '+id);
   assert(!q.requires||arc.quests.includes(q.requires),'Unexpected cross-arc prerequisite '+id);
   assert(reachable.has(q.area),'Quest region needs revealed content: '+id);
   const sources=maps[q.area].enemies.filter(e=>e.alive&&!enemyStoryHidden(e)&&(q.kind==='any'||e.kind===q.kind)&&(!q.drop||getRegionalDropIds(q.area,e).includes(q.drop)));
   assert(sources.length,'No unrevealed enemy/drop source for '+id);
   quests.push({id,area:q.area,enemySources:sources.length,drop:q.drop});
  }
 }
 assert.equal(quests.length,8);
 for(const id of ['mosslight','shrine_rootmaze','shrine_heart','emberdeep']){
  assert(reachable.has(id),'Dungeon route depends on revealed content: '+id);
  const bosses=maps[id].enemies.filter(e=>e.boss);
  for(const e of bosses)assert(e.alive&&!enemyStoryHidden(e),'Required boss hidden before reveal: '+id);
 }
 assert(maps.emberdeep.enemies.some(e=>e.boss&&e.alive),'Cinder Warden missing');
 assert.equal(canUseMapExit({requires:'fourfold_key'}),false);
 assert.equal(canUseMapExit({requires:'ember_sigil'}),false);
 return {quests,scope:'Runtime dependency audit only; route geometry, combat, quest completion and normal campaign pacing are not replayed'};
})()`,root);
console.log('PASS campaign reveal prerequisites: '+JSON.stringify(result));

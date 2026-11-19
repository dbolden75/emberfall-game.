'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Reuse the full-game DOM/canvas fixture, not a substitute quest implementation.
const fixture=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8').split('const probe=')[0];
const root=new Function('require',fixture+`return root;`)(require);
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(m[1].includes('application/'))continue;
 const src=m[1].match(/src="([^"]+)"/);
 vm.runInContext(src?fs.readFileSync('app/src/main/assets/'+src[1],'utf8'):m[2],root);
}
root.assert=assert;root.TextEncoder=TextEncoder;
vm.runInContext(`
 hasStarted=true;titleMenuActive=false;companions=[];player.name='SunmereChoicesQA';
 const initial=snapshotGameState(),core=ThornhavenCloudSaveCore;
 const choose=label=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c&&!c.disabled,'Missing choice '+label);c.action();return c.action;};
 const camp=()=>setMap('wayfarers_camp',700,340,false);
 const giver=id=>{const n=maps.sunmere.npcs.find(n=>n.questId===id);setMap('sunmere',n.x,n.y,false);player.x=n.x;player.y=n.y;interactQuest(n);};
 const use=id=>{const area=id==='sunmere_beacon_work'?'sunmere':'frostmarch',o=maps[area].worldObjects.find(o=>o.id===id);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;worldObjectInteract(o);return o;};
 const reload=()=>applySavedGame(structuredClone(snapshotGameState()));
 const validate=()=>{const row={id:'slot1',updated:100,state:snapshotGameState()};assert(core.assertRestorableMapLayout(core.parse(core.encode({slot1:row},'slot1',100)),maps));return row;};
 const paused=(id,label)=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c);pauseJournalQuest(id);const before=JSON.stringify(townQuestState[id]),coins=player.coins;c.action();assert.equal(JSON.stringify(townQuestState[id]),before);assert.equal(player.coins,coins);resumeJournalQuest(id);c.action();return c.action;};
 assert(detailedFrames.environment.lamp&&detailedFrames.environment.crate);
 for(const [area,id,r] of [['sunmere','sunmere_beacon_work',32],['frostmarch','sunmere_shutter_mount',28]]){const o=maps[area].worldObjects.find(o=>o.id===id);assert(!mapPlacementBlocked(area,o.x,o.y,r));assert(findWalkingPath(area,{x:area==='sunmere'?480:55,y:area==='sunmere'?340:315},o,14));}
 camp();recruitHuman('eryn');selectHuman('eryn');recordQuestKill('frostmarch',{kind:'spider'});recordQuestKill('frostmarch',{kind:'skeleton'});openHumanStory('eryn');choose('Complete the summons');assert(townQuestState.recruit_eryn.claimed);
 const prepared=snapshotGameState();
 for(const method of ['reinforce','vent'])for(const repair of ['weave','shutters']){
  applySavedGame(structuredClone(prepared));const coins=player.coins;
  giver('sunmere_weavers');assert(!townQuestState.sunmere_weavers);
  camp();openHumanStory('eryn');choose('Begin: Pass Watch');const stale=adventureChoices[0].action;reload();stale();assert(!townQuestState.sunmere_hunt);giver('sunmere_hunt');paused('sunmere_hunt',method==='vent'?'Vent the':'Reinforce with');
  if(method==='reinforce'){
   pauseJournalQuest('sunmere_hunt');recordQuestKill('frostmarch',{kind:'skeleton'});assert.equal(townQuestState.sunmere_hunt.kills,0);resumeJournalQuest('sunmere_hunt');for(let i=0;i<4;i++)recordQuestKill('frostmarch',{kind:'skeleton'});addItem('frost_shard',4);
  }else{
   use('sunmere_beacon_work');choose('Test the pressure');assert(!townQuestState.sunmere_hunt.vented);use('sunmere_beacon_work');const dial=adventureChoices[0].action;humanParty().active=null;dial();assert.equal(townQuestState.sunmere_hunt.harbor,0);humanParty().active='eryn';paused('sunmere_hunt','Turn harbor');validate();reload();assert.equal(townQuestState.sunmere_hunt.harbor,1);
   use('sunmere_beacon_work');choose('Turn harbor');choose('Turn pass');const test=adventureChoices.find(c=>c.label.includes('Test')).action;setMap('wayfarers_camp',700,340,false);test();assert(!townQuestState.sunmere_hunt.vented);use('sunmere_beacon_work');const vent=paused('sunmere_hunt','Test the');vent();assert(townQuestState.sunmere_hunt.vented);recordQuestKill('frostmarch',{kind:'skeleton'});assert.equal(townQuestState.sunmere_hunt.kills,0);
  }
  giver('sunmere_hunt');const finish=paused('sunmere_hunt','Record Eryn');finish();assert.equal(player.coins,coins+(method==='vent'?40:55));assert(!townRelicState.sunmere);validate();reload();
  camp();openHumanStory('eryn');choose('Begin: Cold Silk');choose(repair==='weave'?'Rebind the lens':'Convert to manual');
  if(repair==='weave'){
   const need=method==='vent'?1:2;for(let i=0;i<2;i++)recordQuestKill('frostmarch',{kind:'spider'});giver('sunmere_weavers');assert(!townQuestState.sunmere_weavers.claimed);addItem('ice_silk',need);assert(questGuide({id:'sunmere_weavers'}).progress.endsWith(need+'/'+need+' silk'));
  }else{
   use('sunmere_shutter_mount');assert(!townQuestState.sunmere_weavers.mounted);
   use('sunmere_beacon_work');const convert=paused('sunmere_weavers','Dismantle the');convert();assert(townQuestState.sunmere_weavers.converted);validate();reload();assert(!townQuestState.sunmere_weavers.mounted);
   use('sunmere_shutter_mount');const stale=adventureChoices[0].action;reload();stale();assert(!townQuestState.sunmere_weavers.mounted);use('sunmere_shutter_mount');const mount=paused('sunmere_weavers','Fit and test');mount();assert(townQuestState.sunmere_weavers.mounted);recordQuestKill('frostmarch',{kind:'spider'});assert.equal(townQuestState.sunmere_weavers.kills,0);
  }
  giver('sunmere_weavers');const finishRepair=paused('sunmere_weavers','Record Eryn');finishRepair();assert.equal(player.coins,coins+(method==='vent'?40:55)+(repair==='shutters'?24:36));assert(townRelicState.sunmere);assert.equal(bagCount('sunmere_seal'),1);assert(!hasFourfoldKey);assert(!townQuestState._lastLanternAccess?.revealed);
  assert(npcLocalNews(maps.sunmere.npcs.find(n=>n.name==='Neri the Netmaker')).includes(repair==='shutters'?'mechanical':'bound the lens'));
  validate();reload();giver('sunmere_weavers');assert.equal(bagCount('sunmere_seal'),1);assert.equal(townQuestState.sunmere_weavers.method,repair);assert.equal(bagCount('ice_silk'),0);
  for(const [id,d] of Object.entries(townQuestDefs))if(d.town!=='Sunmere')townQuestState[id]={claimed:true};refreshTownRelics();assert(hasFourfoldKey);assert(!townQuestState._lastLanternAccess?.revealed);
 }
 applySavedGame(structuredClone(prepared));const oldCoins=player.coins;townQuestState.sunmere_hunt={accepted:true,kills:3,claimed:false};recordQuestKill('frostmarch',{kind:'skeleton'});addItem('frost_shard',4);giver('sunmere_hunt');townQuestState.sunmere_weavers={accepted:true,kills:1,claimed:false};recordQuestKill('frostmarch',{kind:'spider'});addItem('ice_silk',2);giver('sunmere_weavers');assert(townRelicState.sunmere);assert.equal(player.coins,oldCoins+91);assert(!townQuestState.sunmere_weavers.method);
 const good=validate();for(const [id,field,value] of [['sunmere_hunt','method','shutters'],['sunmere_hunt','harbor',4],['sunmere_hunt','pass',1.5],['sunmere_hunt','vented','false'],['sunmere_weavers','mounted','true']]){const bad=structuredClone(good);bad.state.townQuestState[id][field]=value;assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){applySavedGame(structuredClone(prepared));player.class=cls;player.gender=gender;giver('sunmere_hunt');choose('Vent the');assert.equal(townQuestState.sunmere_hunt.method,'vent');}
 applySavedGame(structuredClone(initial));giver('sunmere_hunt');assert(!townQuestState.sunmere_hunt);assert(!townQuestState._lastLanternAccess?.revealed);
`,root);
console.log('PASS Sunmere: four route combinations, pressure puzzle/failed tests, reduced silk cost, field linkage sequence, pause and stale callbacks, active Eryn, legacy and intermediate/cloud saves, unique rewards/seal, class/gender and unchanged late reveal.');

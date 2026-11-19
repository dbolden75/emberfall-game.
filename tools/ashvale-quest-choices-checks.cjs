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
 hasStarted=true;titleMenuActive=false;companions=[];player.name='AshvaleChoicesQA';
 const initial=snapshotGameState(),core=ThornhavenCloudSaveCore;
 const choose=label=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c,'Missing '+label+' / '+adventureChoices.map(c=>c.label));c.action();return c.action;};
 const camp=()=>setMap('wayfarers_camp',700,340,false);
 const giver=id=>{const area=id==='ashvale_watch'?'ashvale':'whisperwood',n=maps[area].npcs.find(n=>n.questId===id);setMap(area,n.x,n.y,false);player.x=n.x;player.y=n.y;interactQuest(n);return n;};
 const refuge=()=>{const o=maps.whisperwood.worldObjects.find(o=>o.id==='ashvale_refuge');setMap('whisperwood',o.x,o.y,false);player.x=o.x;player.y=o.y;worldObjectInteract(o);return o;};
 const reload=()=>applySavedGame(structuredClone(snapshotGameState()));
 const validate=()=>{const row={id:'slot1',updated:100,state:snapshotGameState()};assert(core.assertRestorableMapLayout(core.parse(core.encode({slot1:row},'slot1',100)),maps));return row;};
 const pauseCallback=(id,label)=>{const fn=adventureChoices.find(c=>c.label.includes(label)).action;pauseJournalQuest(id);const before=JSON.stringify(townQuestState[id]),coins=player.coins,xp=player.xp;fn();assert.equal(JSON.stringify(townQuestState[id]),before);assert.equal(player.coins,coins);assert.equal(player.xp,xp);resumeJournalQuest(id);fn();return fn;};
 camp();recruitHuman('dalen');selectHuman('dalen');recordQuestKill('whisperwood',{kind:'slime'});recordQuestKill('whisperwood',{kind:'slime'});openHumanStory('dalen');choose('Complete the summons');assert(townQuestState.recruit_dalen.claimed);
 const prepared=snapshotGameState();
 // Both independently chosen chapters must combine into the same Ashvale seal.
 for(const watch of ['clear','shelter'])for(const scout of ['recover','accounts']){
  applySavedGame(structuredClone(prepared));const coins=player.coins;
  giver('ashvale_scout');assert(!townQuestState.ashvale_scout,'Chapter two skipped prerequisite');
  camp();openHumanStory('dalen');choose('Begin: Whisperwood Watch');assert(adventureChoices.some(c=>c.label.includes('Establish a refuge')),'Companion menu swallowed choice');
  const stale=adventureChoices[0].action;reload();stale();assert(!townQuestState.ashvale_watch);giver('ashvale_watch');const moved=adventureChoices[0].action;camp();moved();assert(!townQuestState.ashvale_watch,'Stale choice crossed contact maps');giver('ashvale_watch');choose(watch==='clear'?'Clear the threats':'Establish a refuge');
  const s=townQuestState.ashvale_watch;
  pauseJournalQuest('ashvale_watch');recordQuestKill('whisperwood',{kind:'slime'});assert.equal(s.kills,0);resumeJournalQuest('ashvale_watch');
  if(watch==='clear'){
   for(let i=0;i<3;i++)recordQuestKill('whisperwood',{kind:'slime'});addItem('ash_mote',3);
  }else{
   const o=refuge();assert(!mapPlacementBlocked('whisperwood',o.x,o.y,70),'Refuge footprint overlaps scenery');assert(findWalkingPath('whisperwood',{x:160,y:300},o,14));
   choose('Build with');assert(!s.built);addItem('wood_log',2);refuge();choose('Build with');assert.equal(bagCount('wood_log'),2,'Partial costs were consumed');addItem('field_ration',1);
   refuge();const build=adventureChoices[0].action;humanParty().active=null;build();assert(!s.built);humanParty().active='dalen';pauseCallback('ashvale_watch','Build with');build();assert(s.built);assert.equal(bagCount('wood_log'),0);assert.equal(bagCount('field_ration'),0);
   recordQuestKill('whisperwood',{kind:'slime'});assert.equal(s.kills,0,'Alternative counted combat');
  }
  validate();reload();giver('ashvale_watch');const claim=pauseCallback('ashvale_watch','Record the result');claim();assert(townQuestState.ashvale_watch.claimed);assert.equal(player.coins,coins+(watch==='clear'?36:24));assert(!townRelicState.ashvale);assert(!hasFourfoldKey);
  if(watch==='shelter'){
   const o=refuge(),states=maps.whisperwood.enemies.map(e=>({e,alive:e.alive,x:e.x,y:e.y}));for(const {e} of states){e.x=1500;e.y=1500;}player.hp=10;refuge();assert.equal(player.hp,30);refuge();assert.equal(player.hp,30,'Repeated healing bypassed cooldown');reload();player.hp=10;refuge();assert.equal(player.hp,10,'Reload reset cooldown');townQuestState.ashvale_watch.restAt=0;const threat=maps.whisperwood.enemies.find(e=>e.kind==='slime');threat.x=o.x;threat.y=o.y;threat.alive=true;refuge();assert.equal(player.hp,10,'Rest ignored a nearby threat');for(const row of states)Object.assign(row.e,{alive:row.alive,x:row.x,y:row.y});
  }
  giver('ashvale_scout');choose(scout==='recover'?'Recover the patrol signal':'Compare the two');
  if(scout==='recover'){for(let i=0;i<2;i++)recordQuestKill('whisperwood',{kind:'slime'});addItem('ash_mote',2);}
  else{
   camp();openHumanStory('dalen');assert(!adventureChoices.some(c=>c.label==='Compare Dalen’s gate account'),'Compared before field log');giver('ashvale_scout');pauseCallback('ashvale_scout','Record Rowan');validate();reload();assert(townQuestState.ashvale_scout.fieldRead);
   camp();openHumanStory('dalen');const account=adventureChoices[0].action;setMap('ashvale',300,300,false);account();assert(!townQuestState.ashvale_scout.accountRead);camp();openHumanStory('dalen');pauseCallback('ashvale_scout','Compare Dalen');recordQuestKill('whisperwood',{kind:'slime'});assert.equal(townQuestState.ashvale_scout.kills,0);
  }
  giver('ashvale_scout');const done=pauseCallback('ashvale_scout','Record the result');done();assert(townQuestState.ashvale_scout.claimed);assert(townRelicState.ashvale);assert.equal(player.coins,coins+(watch==='clear'?36:24)+16);assert.equal(bagCount('ashvale_seal'),1);assert(!townQuestState._lastLanternAccess?.revealed);assert(!hasFourfoldKey);
  validate();reload();giver('ashvale_scout');assert.equal(bagCount('ashvale_seal'),1);assert.equal(townQuestState.ashvale_scout.method,scout);
  // Other towns' completion still combines with either Ashvale route; no new gate.
  for(const [id,d] of Object.entries(townQuestDefs))if(d.town!=='Ashvale')townQuestState[id]={claimed:true};refreshTownRelics();assert(hasFourfoldKey);assert.equal(bagCount('fourfold_key'),1);assert(!townQuestState._lastLanternAccess?.revealed);
 }
 // Accepted legacy objectives and reward totals remain unchanged.
 applySavedGame(structuredClone(prepared));townQuestState.ashvale_watch={accepted:true,kills:2,claimed:false};recordQuestKill('whisperwood',{kind:'slime'});addItem('ash_mote',3);const oldCoins=player.coins;giver('ashvale_watch');assert(townQuestState.ashvale_watch.claimed);assert.equal(player.coins,oldCoins+24);assert(!townQuestState.ashvale_watch.method);
 townQuestState.ashvale_scout={accepted:true,kills:2,claimed:false};addItem('ash_mote',2);giver('ashvale_scout');assert(townRelicState.ashvale);assert.equal(player.coins,oldCoins+40);assert(!townQuestState.ashvale_scout.method);
 const valid=validate();for(const [key,field,value] of [['ashvale_watch','method','accounts'],['ashvale_scout','method','shelter'],['ashvale_watch','built','false'],['ashvale_watch','restAt',-1],['ashvale_scout','accountRead',1],['ashvale_scout','fieldRead','true']]){const bad=structuredClone(valid);bad.state.townQuestState[key][field]=value;assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){applySavedGame(structuredClone(prepared));player.class=cls;player.gender=gender;giver('ashvale_watch');choose('Establish a refuge');assert.equal(townQuestState.ashvale_watch.method,'shelter');}
 applySavedGame(structuredClone(initial));giver('ashvale_watch');assert(!townQuestState.ashvale_watch,'Unbonded character accepted quest');assert(!townQuestState._lastLanternAccess?.revealed);assert(!townQuestState.ashvale_scout);
`,root);
console.log('PASS Ashvale branches: four combinations, companion menu, prerequisites, active companion, pause/stale callbacks, shelter atomic costs/cooldown, legacy rewards, per-character saves/cloud rejection, seal/Keystone progression, class/gender independence and unchanged reveal gate.');

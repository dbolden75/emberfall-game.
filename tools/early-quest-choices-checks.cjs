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
 hasStarted=true;titleMenuActive=false;companions=[];player.name='ChoiceQA';
 const initial=snapshotGameState();
 for(const area of ['wayfarers_camp','whisperwood'])for(const o of maps[area].worldObjects.filter(o=>o.id==='camp_waymark'||o.id.startsWith('camp_patrol_marker_'))){assert(!mapPlacementBlocked(area,o.x,o.y,14),o.id+' collision');assert(findWalkingPath(area,{x:300,y:450},o,14),o.id+' unreachable');}

 const choose=label=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c,'Missing '+label);c.action();return c.action;};
 const use=(area,id)=>{const o=maps[area].worldObjects.find(o=>o.id===id);assert(o);setMap(area,o.x,o.y,false);player.x=o.x;player.y=o.y;return o;};
 const camp=id=>campInteract(use('wayfarers_camp',id));
 const board=()=>{camp('camp_board');choose('Road Warden patrols');};
 const reload=()=>applySavedGame(structuredClone(snapshotGameState()));
 const validate=()=>{const row={id:'slot1',updated:100,state:snapshotGameState()},core=ThornhavenCloudSaveCore;const parsed=core.parse(core.encode({slot1:row},'slot1',100));assert(core.assertRestorableMapLayout(parsed,maps));return row;};
 const start=()=>{applySavedGame(structuredClone(initial));townQuestState._camp={stage:0,claimed:false,notes:[]};camp('camp_fire');camp('camp_letter');};
 for(const method of ['tracks','seal']){
  start();assert.equal(townQuestState._camp.method,'pending');const stale=adventureChoices[0].action;reload();stale();assert.equal(townQuestState._camp.method,'pending');camp('camp_letter');choose(method==='tracks'?'Follow the footprints':'Compare the public');const coins=player.coins;reload();
  if(method==='tracks')camp('camp_tracks');else{camp('camp_tracks');assert(!campState().claimed);camp('camp_board');assert(!campState().claimed);camp('camp_waymark');reload();assert(campState().compared);camp('camp_board');}
  assert(campState().claimed);assert.equal(player.coins,coins+20);const after=player.coins;camp('camp_tracks');camp('camp_waymark');camp('camp_board');assert.equal(player.coins,after);validate();assert(!townQuestState._lastLanternAccess?.revealed);
 }
 // Legacy stage-two save retains the footprint route with no new decision.
 applySavedGame(structuredClone(initial));townQuestState._camp={stage:2,claimed:false,notes:[]};camp('camp_tracks');assert(campState().claimed);assert(!campState().method);
 // Two repeat cycles, different objectives. Stale callbacks cannot collect twice.
 let oldClaim;
 for(const method of ['repair','clear']){
  board();choose(method==='repair'?'Repair the road':'Clear threats');const s=townQuestState._campPatrol,coins=player.coins;
  if(oldClaim){oldClaim();assert(s.accepted);}
  if(method==='repair'){
   for(let i=0;i<3;i++)recordQuestKill('whisperwood',{kind:'slime'});assert.equal(s.kills,0);assert.equal(s.markers.length,0);
   const o=use('whisperwood','camp_patrol_marker_0');campInteract(o);assert.equal(s.markers.length,0);addItem('wood_log',3);
   pauseJournalQuest('camp_patrol');campInteract(o);assert.equal(s.markers.length,0);resumeJournalQuest('camp_patrol');
   for(let i=0;i<3;i++){const o=use('whisperwood','camp_patrol_marker_'+i);campInteract(o);campInteract(o);}assert.equal(s.markers.length,3);assert.equal(bagCount('wood_log'),0);
  }else{pauseJournalQuest('camp_patrol');recordQuestKill('whisperwood',{kind:'slime'});assert.equal(s.kills,0);resumeJournalQuest('camp_patrol');for(let i=0;i<3;i++)recordQuestKill('whisperwood',{kind:'slime'});assert.equal(s.kills,3);}
  validate();reload();board();const action=adventureChoices.find(c=>c.label.includes('Collect')).action;pauseJournalQuest('camp_patrol');action();assert.equal(player.coins,coins);resumeJournalQuest('camp_patrol');action();action();assert.equal(player.coins,coins+20);oldClaim=action;
 }
 assert.equal(townQuestState._campPatrol.completed,2);
 // Already-accepted legacy patrol preserves its two kills.
 townQuestState._campPatrol={accepted:true,kills:2,completed:4};recordQuestKill('whisperwood',{kind:'slime'});board();choose('Collect');assert.equal(townQuestState._campPatrol.completed,5);
 for(const method of ['return','rehang']){
  applySavedGame(structuredClone(initial));const o=use('willowfen','regional_willowfen');regionalInteract(o);choose(method==='return'?'Return the lanterns':'Rehang the lanterns');const coins=player.coins;
  if(method==='rehang')addItem('wood_log',3);
  for(let i=0;i<3;i++){const piece=use('willowfen','regional_piece_willowfen_'+i);pauseJournalQuest('regional_willowfen');regionalInteract(piece);assert.equal(regionalState('willowfen').found.length,i);resumeJournalQuest('regional_willowfen');regionalInteract(piece);regionalInteract(piece);reload();}
  assert.equal(regionalState('willowfen').found.length,3);assert.equal(bagCount('wood_log'),0);regionalInteract(use('willowfen','regional_willowfen'));assert(regionalState('willowfen').claimed);assert.equal(player.coins,coins+30);regionalInteract(use('willowfen','regional_willowfen'));assert.equal(player.coins,coins+30);validate();reload();assert.equal(regionalState('willowfen').method,method);drawWayfarerCamp();
 }
 // An old partially collected lantern quest keeps its collection route.
 applySavedGame(structuredClone(initial));townQuestState.regional_willowfen={accepted:true,found:[0],progress:0};for(const i of [1,2])regionalInteract(use('willowfen','regional_piece_willowfen_'+i));regionalInteract(use('willowfen','regional_willowfen'));assert(regionalState('willowfen').claimed);assert(!regionalState('willowfen').method);
 // New choice callbacks cannot cross a character/reload boundary.
 applySavedGame(structuredClone(initial));regionalInteract(use('willowfen','regional_willowfen'));const staleLantern=adventureChoices[1].action;reload();staleLantern();assert(!regionalState('willowfen').method);
 regionalInteract(use('willowfen','regional_willowfen'));choose('Rehang');regionalInteract(use('willowfen','regional_piece_willowfen_0'));assert.equal(regionalState('willowfen').found.length,0,'Missing log must not repair');
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){start();player.class=cls;player.gender=gender;choose('Compare the public');camp('camp_waymark');camp('camp_board');assert(campState().claimed);assert(!townQuestState._lastLanternAccess?.revealed);}
 const good=validate();for(const [key,field,value] of [['_camp','method','bad'],['_campPatrol','method','bad'],['_campPatrol','markers',[0,0]],['regional_willowfen','method','bad']]){const bad=structuredClone(good);bad.state.townQuestState[key]??={};bad.state.townQuestState[key][field]=value;assert.throws(()=>ThornhavenCloudSaveCore.parse(ThornhavenCloudSaveCore.encode({slot1:bad},'slot1',100)));}
 applySavedGame(structuredClone(initial));assert(!townQuestState.regional_willowfen?.method);assert(!townQuestState._campPatrol?.method);
`,root);
console.log('PASS early choices: both caller paths, both repeat patrol cycles, both lantern paths, costs, pause guards, stale callbacks, legacy progress, duplicate rewards, partial/completed save reloads, cloud validation, no reveal grant.');

const inventory=JSON.parse(fs.readFileSync('docs/quest-choice-inventory.json','utf8'));
root.inventoryIds=inventory.entries.map(q=>q.id);
assert.equal(new Set(root.inventoryIds).size,inventory.entries.length);
vm.runInContext(`
 townQuestState._camp={stage:3,claimed:true,notes:[]};townQuestState._lastLanternAccess={revealed:true};townQuestState.last_lantern={claimed:true,bell:true,register:true,inventory:true};frontierState().complete=true;
 for(const id of Object.keys(npcStoryDefs))townQuestState[id]={accepted:true};
 for(const q of questCatalog())assert(inventoryIds.includes(q.id),'Inventory missing '+q.id);
 for(const id of Object.keys(slayerContracts))assert(inventoryIds.includes('slayer_'+id));
 for(const q of settlementTasks())assert(inventoryIds.includes('settlement_'+q.id));
 for(const id of Object.keys(storyDungeons))assert(inventoryIds.includes('challenge_'+id));
`,root);
assert(fs.readFileSync('app/src/main/assets/early-quest-choices.js','utf8').includes('Willowfen’s trees yield Hardwood Logs'));
console.log('PASS inventory: catalog including conditional late quests, all hunt templates, small settlement tasks and sanctum replays accounted for.');

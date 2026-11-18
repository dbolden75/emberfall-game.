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
 hasStarted=true;titleMenuActive=false;player.name='CounselQA';companions=[];
 const initial=snapshotGameState(),core=ThornhavenCloudSaveCore;
 const find=who=>maps.veilhaven.npcs.find(n=>n.vampireId===who);
 const talkTo=who=>{const n=find(who);setMap('veilhaven',n.x,n.y,false);player.x=n.x;player.y=n.y;openNpcConversation(n);};
 const choose=label=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c,'Missing choice '+label+' '+JSON.stringify({choices:adventureChoices.map(c=>c.label),s:townQuestState.veil_counsel,access:townQuestState._lastLanternAccess,l:townQuestState.last_lantern,mapId}));c.action();};
 const pausedChoice=label=>{
  const c=adventureChoices.find(c=>c.label.includes(label));assert(c,'Missing '+label);
  const before=JSON.stringify(townQuestState.veil_counsel),coins=player.coins,xp=player.xp,beforeChoices=adventureChoices;
  pauseJournalQuest('veil_counsel');assert(journalPaused('veil_counsel'));c.action();
  assert.equal(JSON.stringify(townQuestState.veil_counsel),before,'Paused callback mutated '+label);
  assert.equal(player.coins,coins);assert.equal(player.xp,xp);assert.equal(adventureChoices,beforeChoices,'Paused callback replaced dialogue '+label);
  resumeJournalQuest('veil_counsel');assert(!journalPaused('veil_counsel'));c.action();
 };
 const available=()=>questCatalog().some(q=>q.id==='veil_counsel');
 assert(!available());townQuestState.last_lantern={claimed:true,bell:true,register:true,inventory:true};assert(!available());
 talkTo('vaelis');assert(!adventureChoices.some(c=>/secured evidence/.test(c.label)));
 townQuestState._lastLanternAccess={revealed:true};delete townQuestState.last_lantern.inventory;assert(!available());
 townQuestState.last_lantern.inventory=true;assert(available());
 const prepared=snapshotGameState(),coins=player.coins,xp=player.xp;
 pauseJournalQuest('veil_counsel');const pausedBefore=JSON.stringify(townQuestState.veil_counsel);
 for(const who of ['mirelle','orven','vaelis']){talkTo(who);assert.deepEqual(adventureChoices.map(c=>c.label).join('|'),'Other matters|Leave');choose('Other matters');assert.equal(npcConversation.npc.vampireId,who);}
 assert.equal(JSON.stringify(townQuestState.veil_counsel),pausedBefore,'Paused entry created state');
 const pausedSave=snapshotGameState();applySavedGame(structuredClone(initial));applySavedGame(structuredClone(pausedSave));assert(journalPaused('veil_counsel'));talkTo('vaelis');assert(!adventureChoices.some(c=>/Review|Prepare|Hear/.test(c.label)));resumeJournalQuest('veil_counsel');assert(!journalPaused('veil_counsel'));

 for(const choice of ['refuge','testimony','watch']){
  applySavedGame(structuredClone(prepared));talkTo('mirelle');pausedChoice('Review the secured evidence');choose('Hear this resident');pausedChoice('Hear Mirelle');choose('Continue');
  pauseJournalQuest('veil_counsel');const partial=snapshotGameState();applySavedGame(structuredClone(initial));assert(!townQuestState.veil_counsel);applySavedGame(structuredClone(partial));assert(townQuestState.veil_counsel.mirelle);assert(journalPaused('veil_counsel'));resumeJournalQuest('veil_counsel');assert(!journalPaused('veil_counsel'));
  talkTo('vaelis');assert(!adventureChoices.some(c=>c.label.startsWith('Prepare')));pausedChoice('Hear Vaelis');choose('Continue');
  talkTo('orven');pausedChoice('Hear Orven');choose('Continue');talkTo('vaelis');
  pausedChoice(choice==='refuge'?'Prepare a refuge':choice==='testimony'?'Prepare a witness':'Prepare a road');
  const confirm=adventureChoices.find(c=>c.label==='Confirm this recommendation').action;
  const access=townQuestState._lastLanternAccess;delete townQuestState._lastLanternAccess;confirm();assert(!townQuestState.veil_counsel.choice);assert(!available());
  townQuestState._lastLanternAccess=access;delete townQuestState.last_lantern.inventory;confirm();assert(!townQuestState.veil_counsel.choice);townQuestState.last_lantern.inventory=true;applySavedGame(structuredClone(snapshotGameState()));confirm();assert(!townQuestState.veil_counsel.choice,'stale character callback');setMap('ashvale',480,320,false);confirm();assert(!townQuestState.veil_counsel.choice);
  talkTo('vaelis');pausedChoice(choice==='refuge'?'Prepare a refuge':choice==='testimony'?'Prepare a witness':'Prepare a road');pausedChoice('Confirm this');
  assert.equal(townQuestState.veil_counsel.choice,choice);confirm();assert.equal(townQuestState.veil_counsel.choice,choice);
  assert.equal(player.coins,coins);assert.equal(player.xp,xp);assert(!questCatalog().find(q=>q.id==='veil_counsel').done);talkTo(choice==='refuge'?'orven':choice==='testimony'?'mirelle':'vaelis');pausedChoice('Record the unresolved concern');assert(townQuestState.veil_counsel.response);assert(questCatalog().find(q=>q.id==='veil_counsel').done);
  const complete=snapshotGameState(),row={id:'slot1',updated:100,state:complete};
  const parsed=core.parse(core.encode({slot1:row},'slot1',100));assert(core.assertRestorableMapLayout(parsed,maps));
  for(const key of ['reviewed','mirelle','vaelis','orven','response','choice']){const bad=structuredClone(row);bad.state.townQuestState.veil_counsel[key]='invalid';assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
  applySavedGame(structuredClone(initial));applySavedGame(structuredClone(complete));assert.equal(townQuestState.veil_counsel.choice,choice);assert(townQuestState.last_lantern.claimed);
  for(const who of ['mirelle','orven','vaelis']){talkTo(who);assert(!adventureChoices.some(c=>c.label.startsWith('Prepare')));choose('Other matters');assert.equal(npcConversation.npc.vampireId,who);}
 }
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){applySavedGame(structuredClone(prepared));player.class=cls;player.gender=gender;talkTo('vaelis');pausedChoice('Review the secured evidence');assert(townQuestState.veil_counsel.reviewed);}
 applySavedGame(structuredClone(initial));assert(!available());assert(!townQuestState.veil_counsel);assert(!maps.veilhaven.enemies.length);
`,root);
console.log('PASS counsel: prerequisite/gate, three positions, all choices, callback guards, no rewards, per-character partial/completed saves, cloud validation, ordinary dialogue, class/gender independence.');

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
 hasStarted=true;titleMenuActive=false;companions=[];player.name='StonewatchChoicesQA';
 const initial=snapshotGameState(),core=ThornhavenCloudSaveCore;
 const choose=label=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c&&!c.disabled,'Missing choice '+label);c.action();return c.action;};
 const camp=()=>setMap('wayfarers_camp',700,340,false);
 const giver=id=>{const n=maps.stonewatch.npcs.find(n=>n.questId===id);setMap('stonewatch',n.x,n.y,false);player.x=n.x;player.y=n.y;interactQuest(n);};
 const use=id=>{const o=maps.highmoor.worldObjects.find(o=>o.id===id);setMap('highmoor',o.x,o.y,false);player.x=o.x;player.y=o.y;worldObjectInteract(o);return o;};
 const reload=()=>applySavedGame(structuredClone(snapshotGameState()));
 const validate=()=>{const row={id:'slot1',updated:100,state:snapshotGameState()};assert(core.assertRestorableMapLayout(core.parse(core.encode({slot1:row},'slot1',100)),maps));return row;};
 const paused=(id,label)=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c);pauseJournalQuest(id);const before=JSON.stringify(townQuestState[id]),coins=player.coins,xp=player.xp;c.action();assert.equal(JSON.stringify(townQuestState[id]),before);assert.equal(player.coins,coins);assert.equal(player.xp,xp);resumeJournalQuest(id);c.action();return c.action;};
 for(const id of ['stonewatch_warning','stonewatch_memory','stonewatch_watch']){const o=maps.highmoor.worldObjects.find(o=>o.id===id);assert(!mapPlacementBlocked('highmoor',o.x,o.y,id==='stonewatch_warning'?28:24));assert(findWalkingPath('highmoor',{x:55,y:315},o,14));}
 assert(shopDefs.stonewatch_weapons.stock.includes('buckler'));assert(detailedFrames.items.shield&&detailedFrames.environment.lamp&&detailedFrames.environment.runestone);
 camp();recruitHuman('corin');selectHuman('corin');recordQuestKill('highmoor',{kind:'spider'});recordQuestKill('highmoor',{kind:'skeleton'});openHumanStory('corin');choose('Complete the summons');assert(townQuestState.recruit_corin.claimed);
 const prepared=snapshotGameState();
 for(const method of ['iron','gong'])for(const vigil of ['cloth','open_vigil']){
  applySavedGame(structuredClone(prepared));const coins=player.coins;
  giver('stonewatch_silk');assert(!townQuestState.stonewatch_silk);
  camp();openHumanStory('corin');choose('Begin: Clear the Moor');const stale=adventureChoices[0].action;reload();stale();assert(!townQuestState.stonewatch_sweep);giver('stonewatch_sweep');paused('stonewatch_sweep',method==='gong'?'Give a spare':'Recover Grave');
  if(method==='iron'){
   pauseJournalQuest('stonewatch_sweep');recordQuestKill('highmoor',{kind:'skeleton'});assert.equal(townQuestState.stonewatch_sweep.kills,0);resumeJournalQuest('stonewatch_sweep');for(let i=0;i<3;i++)recordQuestKill('highmoor',{kind:'skeleton'});addItem('grave_iron',3);
  }else{
   use('stonewatch_warning');choose('Permanently hang');assert(!townQuestState.stonewatch_sweep.hung);addItem('buckler',1);player.shield='buckler';use('stonewatch_warning');choose('Permanently hang');assert(!townQuestState.stonewatch_sweep.hung);assert.equal(bagCount('buckler'),1);assert.equal(player.shield,'buckler');
   addItem('buckler',1);use('stonewatch_warning');const hang=adventureChoices[0].action;humanParty().active=null;hang();assert.equal(bagCount('buckler'),2);humanParty().active='corin';const act=paused('stonewatch_sweep','Permanently hang');act();assert(townQuestState.stonewatch_sweep.hung);assert.equal(bagCount('buckler'),1);assert.equal(player.shield,'buckler');validate();reload();assert(townQuestState.stonewatch_sweep.hung);assert.equal(bagCount('buckler'),1);recordQuestKill('highmoor',{kind:'skeleton'});assert.equal(townQuestState.stonewatch_sweep.kills,0);
  }
  giver('stonewatch_sweep');const finish=paused('stonewatch_sweep','Record the vigil');finish();assert.equal(player.coins,coins+42);assert(!townRelicState.stonewatch);validate();reload();
  camp();openHumanStory('corin');choose('Begin: A Weaver');choose(vigil==='cloth'?'Prepare the shrine':'Accompany an open');
  if(vigil==='cloth'){
   for(let i=0;i<2;i++)recordQuestKill('highmoor',{kind:'spider'});giver('stonewatch_silk');assert(!townQuestState.stonewatch_silk.claimed);addItem('ruin_silk',2);
  }else{
   use('stonewatch_warning');assert(!townQuestState.stonewatch_silk.closed);
   const order=method==='gong'?['watch','memory']:['memory','watch'];use('stonewatch_'+order[1]);assert.equal(townQuestState.stonewatch_silk.steps,0);
   for(let i=0;i<2;i++){
    use('stonewatch_'+order[i]);const stale=adventureChoices[0].action;reload();stale();assert.equal(townQuestState.stonewatch_silk.steps,i);use('stonewatch_'+order[i]);const action=paused('stonewatch_silk','Witness');action();assert.equal(townQuestState.stonewatch_silk.steps,i+1);validate();reload();assert.equal(townQuestState.stonewatch_silk.steps,i+1);
   }
   use('stonewatch_warning');const end=adventureChoices[0].action;camp();end();assert(!townQuestState.stonewatch_silk.closed);use('stonewatch_warning');const close=paused('stonewatch_silk','Close the vigil');close();assert(townQuestState.stonewatch_silk.closed);recordQuestKill('highmoor',{kind:'spider'});assert.equal(townQuestState.stonewatch_silk.kills,0);
  }
  giver('stonewatch_silk');const finishVigil=paused('stonewatch_silk','Record the vigil');finishVigil();assert.equal(player.coins,coins+42+(vigil==='open_vigil'?18:28));assert(townRelicState.stonewatch);assert.equal(bagCount('stonewatch_seal'),1);assert(!hasFourfoldKey);assert(!townQuestState._lastLanternAccess?.revealed);
  assert(npcLocalNews(maps.stonewatch.npcs.find(n=>n.name==='Mara the Herbalist')).includes(vigil==='open_vigil'?'no witness':'shrine cloth'));
  validate();reload();giver('stonewatch_silk');assert.equal(bagCount('stonewatch_seal'),1);assert.equal(townQuestState.stonewatch_silk.method,vigil);assert.equal(bagCount('ruin_silk'),0);
  for(const [id,d] of Object.entries(townQuestDefs))if(d.town!=='Stonewatch')townQuestState[id]={claimed:true};refreshTownRelics();assert(hasFourfoldKey);assert(!townQuestState._lastLanternAccess?.revealed);
 }
 applySavedGame(structuredClone(prepared));const oldCoins=player.coins;townQuestState.stonewatch_sweep={accepted:true,kills:2,claimed:false};recordQuestKill('highmoor',{kind:'skeleton'});addItem('grave_iron',3);giver('stonewatch_sweep');townQuestState.stonewatch_silk={accepted:true,kills:1,claimed:false};recordQuestKill('highmoor',{kind:'spider'});addItem('ruin_silk',2);giver('stonewatch_silk');assert(townRelicState.stonewatch);assert.equal(player.coins,oldCoins+70);assert(!townQuestState.stonewatch_silk.method);
 const good=validate();for(const [id,field,value] of [['stonewatch_sweep','method','open_vigil'],['stonewatch_sweep','hung','false'],['stonewatch_silk','steps',3],['stonewatch_silk','steps',1.5],['stonewatch_silk','closed','true']]){const bad=structuredClone(good);bad.state.townQuestState[id][field]=value;assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){applySavedGame(structuredClone(prepared));player.class=cls;player.gender=gender;giver('stonewatch_sweep');choose('Give a spare');activeShopId='stonewatch_weapons';const funds=player.coins;buyItem('buckler');assert.equal(bagCount('buckler'),1);assert.equal(player.coins,funds-12);player.shield=null;use('stonewatch_warning');choose('Permanently hang');assert(townQuestState.stonewatch_sweep.hung);assert.equal(bagCount('buckler'),0);}
 applySavedGame(structuredClone(initial));giver('stonewatch_sweep');assert(!townQuestState.stonewatch_sweep);assert(!townQuestState._lastLanternAccess?.revealed);
`,root);
console.log('PASS Stonewatch: four combinations, spare versus equipped shield protection, two vigil orders, intermediate/legacy/cloud saves, wrong-order/pause/stale callbacks, active Corin, unique rewards/seal, class/gender and unchanged late reveal.');

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
 hasStarted=true;titleMenuActive=false;companions=[];player.name='BrackenChoicesQA';
 const initial=snapshotGameState(),core=ThornhavenCloudSaveCore;
 const choose=label=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c&&!c.disabled,'Missing/enabled '+label);c.action();return c.action;};
 const camp=()=>setMap('wayfarers_camp',700,340,false);
 const giver=id=>{const n=maps.brackenford.npcs.find(n=>n.questId===id);assert(n);setMap('brackenford',n.x,n.y,false);player.x=n.x;player.y=n.y;interactQuest(n);};
 const use=id=>{const o=maps.redfen.worldObjects.find(o=>o.id===id);setMap('redfen',o.x,o.y,false);player.x=o.x;player.y=o.y;worldObjectInteract(o);return o;};
 const reload=()=>applySavedGame(structuredClone(snapshotGameState()));
 const play=()=>{closePanel('adventureScreen');refreshPanelState();assert(combatReady());};
 const tick=n=>{for(let i=0;i<n;i++)updateCompanions(.25);};
 const validate=()=>{const row={id:'slot1',updated:100,state:snapshotGameState()};assert(core.assertRestorableMapLayout(core.parse(core.encode({slot1:row},'slot1',100)),maps));return row;};
 const paused=(id,label)=>{const c=adventureChoices.find(c=>c.label.includes(label));assert(c);pauseJournalQuest(id);const before=JSON.stringify(townQuestState[id]),coins=player.coins,stock=townStock('brackenford').items.potion_25;c.action();assert.equal(JSON.stringify(townQuestState[id]),before);assert.equal(player.coins,coins);assert.equal(townStock('brackenford').items.potion_25,stock);resumeJournalQuest(id);c.action();return c.action;};
 camp();recruitHuman('sylvi');selectHuman('sylvi');recordQuestKill('redfen',{kind:'spider'});recordQuestKill('redfen',{kind:'slime'});openHumanStory('sylvi');choose('Complete the summons');assert(townQuestState.recruit_sylvi.claimed);
 const prepared=snapshotGameState();
 for(const route of ['clear_route','diversion'])for(const medicine of ['brew','reserve']){
  applySavedGame(structuredClone(prepared));const coins=player.coins;
  giver('bracken_herbs');assert(!townQuestState.bracken_herbs);
  camp();openHumanStory('sylvi');choose('Begin: Redfen Patrol');const stale=adventureChoices[0].action;reload();stale();assert(!townQuestState.bracken_patrol);giver('bracken_patrol');choose(route==='clear_route'?'Clear the direct':'Cover the reed');
  const s=townQuestState.bracken_patrol;
  if(route==='clear_route'){pauseJournalQuest('bracken_patrol');recordQuestKill('redfen',{kind:'slime'});assert.equal(s.kills,0);resumeJournalQuest('bracken_patrol');for(let i=0;i<3;i++)recordQuestKill('redfen',{kind:'slime'});addItem('bog_resin',3);}
  else{
   const o=use('bracken_signal');assert(!mapPlacementBlocked('redfen',o.x,o.y,24));assert(findWalkingPath('redfen',{x:55,y:315},o,14));choose('Burn three');assert(!s.signal);addItem('bog_resin',3);use('bracken_signal');const burn=paused('bracken_patrol','Burn three');burn();assert(s.signal);assert.equal(bagCount('bog_resin'),0);
   for(const e of maps.redfen.enemies)e.alive=false;
   tick(12);assert.equal(s.held,0,'Dialog advanced timer');play();tick(16);assert.equal(s.held,4);
   pauseJournalQuest('bracken_patrol');tick(8);assert.equal(s.held,4);resumeJournalQuest('bracken_patrol');player.x+=200;tick(8);assert.equal(s.held,4);player.x=o.x;humanParty().active=null;tick(8);assert.equal(s.held,4);humanParty().active='sylvi';player.hp=0;tick(8);assert.equal(s.held,4);player.hp=player.max;
   validate();reload();assert.equal(townQuestState.bracken_patrol.held,4);use('bracken_signal');play();tick(32);assert.equal(townQuestState.bracken_patrol.held,12);recordQuestKill('redfen',{kind:'slime'});assert.equal(townQuestState.bracken_patrol.kills,0);
  }
  giver('bracken_patrol');const finish=paused('bracken_patrol','Finish this chapter');finish();assert.equal(player.coins,coins+30);assert(!townRelicState.brackenford);validate();reload();
  const stock=townStock('brackenford'),need=route==='diversion'?4:2,stockStart=stock.items.potion_25;
  if(medicine==='reserve'){
   camp();openHumanStory('sylvi');choose('Begin: Marsh Samples');assert(adventureChoices.find(c=>c.label.includes('Set aside')).disabled);
   giver('bracken_herbs');stock.items.potion_25=need-1;choose('Set aside');assert(!townQuestState.bracken_herbs);assert.equal(stock.items.potion_25,need-1);stock.items.potion_25=stockStart;
   giver('bracken_herbs');const reserve=paused('bracken_herbs','Set aside');reserve();assert.equal(stock.items.potion_25,stockStart-need);assert.equal(townQuestState.bracken_herbs.reserved,need);validate();reload();assert.equal(townStock('brackenford').items.potion_25,stockStart-need);
   giver('bracken_herbs');assert(!townQuestState.bracken_herbs.delivered);const o=use('bracken_medicine');assert(!mapPlacementBlocked('redfen',o.x,o.y,35));assert(findWalkingPath('redfen',{x:55,y:315},o,14));const deliver=adventureChoices[0].action;humanParty().active=null;deliver();assert(!townQuestState.bracken_herbs.delivered);humanParty().active='sylvi';paused('bracken_herbs','Deliver the sealed');deliver();recordQuestKill('redfen',{kind:'spider'});assert.equal(townQuestState.bracken_herbs.kills,0);
  }else{giver('bracken_herbs');choose('Distill');for(let i=0;i<2;i++)recordQuestKill('redfen',{kind:'spider'});addItem('fen_venom',2);}
  giver('bracken_herbs');const finishMedicine=paused('bracken_herbs','Finish this chapter');finishMedicine();assert.equal(player.coins,coins+52);assert(townRelicState.brackenford);assert.equal(bagCount('brackenford_seal'),1);assert(!hasFourfoldKey);assert(!townQuestState._lastLanternAccess?.revealed);
  validate();reload();giver('bracken_herbs');assert.equal(player.coins,coins+52);assert.equal(townQuestState.bracken_herbs.method,medicine);assert.equal(townStock('brackenford').items.potion_25,stockStart-(medicine==='reserve'?need:0));
  assert.equal(barterOffers('brackenford').some(o=>o.id==='iva_distillation'),medicine==='brew');assert(!barterOffers('ashvale').some(o=>o.id==='iva_distillation'));
  if(medicine==='brew'){addItem('fen_venom',2);assert(barterTrade('brackenford','iva_distillation'));assert.equal(bagCount('potion_25'),1);assert.equal(bagCount('fen_venom'),0);assert.equal(townStock('brackenford').items.potion_25,stockStart-1);assert(!barterTrade('brackenford','iva_distillation'));}
  for(const [id,d] of Object.entries(townQuestDefs))if(d.town!=='Brackenford')townQuestState[id]={claimed:true};refreshTownRelics();assert(hasFourfoldKey);assert(!townQuestState._lastLanternAccess?.revealed);
 }
 applySavedGame(structuredClone(prepared));const oldCoins=player.coins;townQuestState.bracken_patrol={accepted:true,kills:2,claimed:false};recordQuestKill('redfen',{kind:'slime'});addItem('bog_resin',3);giver('bracken_patrol');townQuestState.bracken_herbs={accepted:true,kills:1,claimed:false};recordQuestKill('redfen',{kind:'spider'});addItem('fen_venom',2);giver('bracken_herbs');assert(townRelicState.brackenford);assert.equal(player.coins,oldCoins+52);assert(!townQuestState.bracken_herbs.method);assert(!barterOffers('brackenford').some(o=>o.id==='iva_distillation'));
 const good=validate();for(const [id,field,value] of [['bracken_patrol','method','reserve'],['bracken_patrol','held',13],['bracken_patrol','signal','false'],['bracken_herbs','reserved',3],['bracken_herbs','delivered','true']]){const bad=structuredClone(good);bad.state.townQuestState[id][field]=value;assert.throws(()=>core.parse(core.encode({slot1:bad},'slot1',100)));}
 for(const cls of ['warrior','rogue','mage','cleric'])for(const gender of ['male','female']){applySavedGame(structuredClone(prepared));player.class=cls;player.gender=gender;giver('bracken_patrol');choose('Cover the reed');assert.equal(townQuestState.bracken_patrol.method,'diversion');}
 applySavedGame(structuredClone(initial));giver('bracken_patrol');assert(!townQuestState.bracken_patrol);assert(!townQuestState.bracken_herbs);assert(!townQuestState._lastLanternAccess?.revealed);
`,root);
console.log('PASS Brackenford: all four combinations, timed active cover with modal/pause/retreat/death/companion guards, atomic resin and stock, linked medicine cost, delivery and barter, legacy/current cloud saves, unique rewards, seal/Keystone access and unchanged reveal.');

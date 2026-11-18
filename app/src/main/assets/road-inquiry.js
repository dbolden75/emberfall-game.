/* Original later investigation. Composed inside the authenticated Last Lantern
 * overlay before freshCharacterState; no standalone script tag or QA unlock. */
function vampireRevealKnown(){return townQuestState?._lastLanternAccess?.revealed===true;}
function enemyStoryHidden(e){return !vampireRevealKnown()&&(e.kind==='vampire'||e.catalogType==='vampire_hunter');}
let openRoadInquiry;
(() => {
 'use strict';
 const id='road_inquiry',read=()=>townQuestState[id]||{};
 const state=()=>townQuestState[id]||(townQuestState[id]={version:1});
 const earned=()=>deepQuestDone===true&&townQuestState.briar_hollow?.claimed===true;
 const ready=()=>read().road===true&&read().harbor===true&&read().corroborated===true;
 const sister=()=>maps.stonewatch.npcs.find(n=>n.name==='Sister Elowen');
 const nearSister=()=>mapId==='stonewatch'&&Math.hypot(player.x-sister().x,player.y-sister().y)<=88;
 const records=[
  {id:'inquiry_road',map:'stonewatchroad',x:450,y:340,label:'ROAD FREIGHT RECORD'},
  {id:'inquiry_harbor',map:'sunharbor',x:450,y:340,label:'HARBOR ARRIVALS'},
  {id:'inquiry_copy',map:'stonewatchroad',x:560,y:340,label:'CARRIER’S COUNTERFOIL'},
  {id:'inquiry_account',map:'sunharbor',x:560,y:340,label:'SEALED WITNESS ACCOUNT'}
 ];
 for(const o of records)(maps[o.map].worldObjects||(maps[o.map].worldObjects=[])).push(o);
 journalMainOrder.splice(journalMainOrder.indexOf('main_vault')+1,0,id);
 const notes={
  road:'Road record: a covered wagon paid for six passengers. Its onward tally lists only two. The other four were transferred rather than recorded as arrivals. This is evidence of concealment, not an answer about Briar Hollow’s missing residents.',
  harbor:'Harbor record: six people boarded the same carrier before the road transfer. A clinic request describes recurring weakness after journeys, not an ordinary cargo loss. The two independent counts agree; the onward record does not.',
  copy:'Carrier’s counterfoil: a payment was altered from passenger care to livestock handling. You retained the alteration and both counts. A paper trail can expose a deliberate cover-up without making a frightened witness identify themself.',
  account:'Sealed account: a survivor describes a captor drinking from a wound, recovering from an injury and recoiling from sunrise. Another passenger helped them escape. You copied the observations without the survivor’s name or hiding place. One act does not establish guilt by ancestry.'
 };
 function detail(){
  const s=read();
  if(vampireRevealKnown())return 'The evidence and Stonewatch’s archive identify vampire raiders, not every vampire as an enemy. Last Lantern is a separate optional lead in Briar Hollow. Veilhaven can be reached by the free Worldsend ferry; its residents remain neutral. Night Visitor is also available. The larger mystery is unresolved.';
  if(!townQuestState.briar_hollow?.claimed)return 'Finish the opening camp clues, then investigate Briar Hollow, rescue Ada and record the missing names. Then finish the Fourfold Keystone, shrine floors and Beneath Ashvale. Return to Sister Elowen at Stonewatch’s aid stall.';
  if(!deepQuestDone)return 'Ada’s testimony is recorded. Follow the main journal through the four town stories, Fourfold Keystone, shrine floors and Beneath Ashvale. Sister Elowen can compare road evidence after that expedition.';
  if(!s.accepted)return 'Speak to Sister Elowen at Stonewatch’s aid stall about the mismatched passenger records.';
  if(!s.road||!s.harbor)return 'Inspect ROAD FREIGHT RECORD on Stonewatch Road and HARBOR ARRIVALS in Sunharbor. Both stand beside the central road. Compare the counts before choosing how to corroborate them.';
  if(!s.method)return 'Return to Sister Elowen in Stonewatch. Choose whether to trace the carrier’s paperwork or read a protected witness account.';
  if(!s.corroborated)return s.method==='paper'?'Return to Stonewatch Road and inspect CARRIER’S COUNTERFOIL.':'Return to Sunharbor and inspect SEALED WITNESS ACCOUNT. No witness name or hiding place is requested.';
  return 'Return to Sister Elowen in Stonewatch. Compare your corroboration with the shelter’s clinical archive.';
 }
 function journalText(){const s=read();return detail()+'\n\n'+[s.road?notes.road:'',s.harbor?notes.harbor:'',s.corroborated?notes[s.method==='paper'?'copy':'account']:'',s.revealed?'Archive: independent older accounts describe the same repeated injuries, recovery after feeding and aversion to sunrise. They call this condition vampirism. These records establish a threat, not the identity of Briar Hollow’s attackers, the stranger or a king.':'',s.legacy?'Earlier knowledge and choices retained from this character’s save. This does not invent an investigation they completed.':''].filter(Boolean).join('\n\n');}
 const catalogBefore=questCatalog;
 questCatalog=function(){const rows=catalogBefore().filter(q=>vampireRevealKnown()||q.id!=='night_visitor');rows.push({id,title:'The Uncounted Passengers',desc:journalText(),reward:'Earned knowledge · new routes of investigation',active:earned()&&!vampireRevealKnown(),done:vampireRevealKnown()});return rows;};
 const guideBefore=questGuide;
 questGuide=function(q){if(q.id===id)return {destination:!earned()?(townQuestState.briar_hollow?.claimed?'ashvale':'briarhollow'):!read().accepted||ready()||!read().method&&read().road&&read().harbor?'stonewatch':!read().road?'stonewatchroad':!read().harbor?'sunharbor':read().method==='paper'?'stonewatchroad':'sunharbor',detail:detail(),progress:[read().road,read().harbor,read().corroborated].filter(Boolean).length+'/3 records',ready:earned()&&ready()};if(q.id==='night_visitor'&&!vampireRevealKnown())return {destination:'stonewatch',detail:detail(),progress:'Investigation pending',ready:false};return guideBefore(q);};
 openRoadInquiry=function(){
  const s=state(),current=()=>read()===s&&earned()&&nearSister()&&!journalPaused(id);
  const choices=[];
  if(vampireRevealKnown())choices.push({label:'Review the Night Visitor',action:()=>{if(vampireRevealKnown())openVampireStory();}},{label:'Find the Last Lantern lead',action:()=>{townQuestState._tracking={id:'last_lantern'};saveGame();openQuestJournal();}});
  else if(earned()&&nearSister()){
   if(!s.accepted)choices.push({label:'Begin comparing the records',action:()=>{if(!current()||!journalCanAccept(id))return;s.accepted=true;saveGame();ui();openRoadInquiry();}});
   else if(s.road&&s.harbor&&!s.method)for(const [method,label] of [['paper','Trace the carrier’s paperwork'],['witness','Read a protected witness account']])choices.push({label,action:()=>{if(!current()||read().method)return;s.method=method;saveGame();ui();openRoadInquiry();}});
   else if(ready())choices.push({label:'Compare the clinical archive',action:()=>{
    if(!current()||!ready()||vampireRevealKnown())return;
    // The only production setter: earned campaign progress, three records and
    // an explicit in-person comparison. No level, visit or elapsed-time unlock.
    s.revealed=true;townQuestState._lastLanternAccess={revealed:true};syncRoutes();saveGame();ui();
    openAdventureDialog('A name for the threat','Sister Elowen lays your records beside older clinical accounts. The archive describes captors who fed on people, healed after feeding and could not endure sunrise. Those accounts call the condition vampirism. '+(s.method==='paper'?'Your counterfoil shows a deliberate attempt to disguise people as cargo. The clinical archive supplies the observations the freight records alone could not prove.':'Your protected account independently describes the same signs. Its author’s name and hiding place remain private.')+'\n\n“This is enough to recognize a threat, not to condemn everyone who shares it. The people who shelter travelers are not answerable for a raider’s crimes.”\n\nA recent road report marks a raider staging post at the Church of the Last Lantern near Briar Hollow. Across the eastern sea, Veilhaven offers neutral sanctuary and a free return ferry. Both are leads, not answers about the missing, the black-cloaked rescuer or the king.\n\nYour findings remain in the main journal. No faith, feeding or transformation is required.',[{label:'Record what we now know',action:openRoadInquiry}]);
   }});
  }
  choices.push({label:'Track the investigation',action:()=>{townQuestState._tracking={id};saveGame();openQuestJournal();}},{label:'Leave',action:()=>{}});
  openAdventureDialog('The Uncounted Passengers',journalText()+(earned()&&nearSister()&&!s.accepted?'\n\nSister Elowen: “Our shelter keeps records because someone must notice who fails to arrive. Compare the road and harbor counts. Bring evidence; a frightened rumor is not a verdict.”':''),choices);
 };
 const npcBefore=openNpcConversation;
 openNpcConversation=function(n){if(n===sister()){openAdventureDialog('Sister Elowen · Stonewatch', 'The aid stall is open. Elowen keeps bandages ready while comparing the shelter’s passenger records.',[{label:'Ask about the uncounted passengers',action:()=>{if(nearSister())openRoadInquiry();}},{label:'Usual conversation and supplies',action:()=>{if(nearSister())npcBefore(n);}},{label:'Leave',action:()=>{}}]);return;}if(n?.vampireId&&!vampireRevealKnown())return openRoadInquiry();return npcBefore(n);};
 const interactBefore=worldObjectInteract;
 worldObjectInteract=function(o){
  if(!o?.id?.startsWith('inquiry_'))return interactBefore(o);
  if(!records.includes(o)||mapId!==o.map||Math.hypot(player.x-o.x,player.y-o.y)>68)return false;
  if(!earned()||!read().accepted||journalPaused(id)){say('Compare passenger records with Sister Elowen in Stonewatch after the earlier investigations.');return true;}
  const s=state();let text;
  if(o.id==='inquiry_road'){s.road=true;text=notes.road;}else if(o.id==='inquiry_harbor'){s.harbor=true;text=notes.harbor;}
  else if(!s.method){say('First compare both counts, then choose an approach with Sister Elowen.');return true;}
  else if(o.id===(s.method==='paper'?'inquiry_copy':'inquiry_account')){s.corroborated=true;text=notes[s.method==='paper'?'copy':'account'];}
  else {say('Your chosen approach follows the other record. Its protected contents remain sealed.');return true;}
  saveGame();ui();openAdventureDialog(o.label,text,[{label:'Keep the finding in the journal',action:()=>{}}]);return true;
 };
 const drawBefore=drawBriarHollow;
 drawBriarHollow=function(){drawBefore();for(const o of records)if(mapId===o.map){standArt('scroll',o.x,o.y,34,'extras');if(Math.hypot(player.x-o.x,player.y-o.y)<180)drawLocationLabel(o.x,o.y-56,o.label);}};
 const oldBriar=briarDialog;
 briarDialog=function(title,text,...args){if(!vampireRevealKnown())text=text.replace('Vampires. There, I said it. They took my neighbors away breathing.','They took my neighbors away breathing. I cannot explain everything I saw.').replace('The raiders were vampires. The stranger in the black cloak opposed them.','The raiders took living people. The stranger in the black cloak opposed them.');return oldBriar(title,text,...args);};
 const oldBestiary=vampireBestiaryText;
 vampireBestiaryText=function(){return vampireRevealKnown()?oldBestiary():'';};
 const oldMystery=openClassMystery;
 openClassMystery=function(){return vampireRevealKnown()?oldMystery():openRoadInquiry();};
 const oldNight=openVampireStory;
 openVampireStory=function(){return vampireRevealKnown()?oldNight():openRoadInquiry();};
 const oldStart=startVampireStory,oldInvestigate=vampireInvestigate,oldChoice=chooseVampirePath,oldFinish=finishVampireStory;
 startVampireStory=function(){if(vampireRevealKnown())return oldStart();};vampireInvestigate=function(){if(vampireRevealKnown())return oldInvestigate();};chooseVampirePath=function(c){if(vampireRevealKnown())return oldChoice(c);};finishVampireStory=function(){if(vampireRevealKnown())return oldFinish();};
 const oldTick=tickVampire,oldHud=refreshVampireHud;
 tickVampire=function(dt){if(vampireRevealKnown())return oldTick(dt);};refreshVampireHud=function(){if(vampireRevealKnown())return oldHud();const el=document.getElementById('vampireStatus');if(el)el.hidden=true;};
 const veilPosition=worldPositions.veilhaven,veilHint=maps.veilhaven.hint;
 function syncRoutes(){if(vampireRevealKnown()){if(veilPosition)worldPositions.veilhaven=veilPosition;maps.veilhaven.hint=veilHint;}else{delete worldPositions.veilhaven;maps.veilhaven.hint='Passage awaits the road investigation. Ask Sister Elowen in Stonewatch.';}installEnemyGates();}
 const oldMap=setMap;
 setMap=function(to,...args){syncRoutes();if(to==='veilhaven'&&!vampireRevealKnown())return false;const result=oldMap(to,...args);installEnemyGates();return result;};
 const oldFerry=veilhavenInteract;
 veilhavenInteract=function(o){if(o?.id?.startsWith('veil_')&&!vampireRevealKnown()){openRoadInquiry();return true;}return oldFerry(o);};
 const oldTravel=travelTo,oldDetails=showAtlasDetails;
 travelTo=function(to){if(to==='veilhaven'&&!vampireRevealKnown())return openRoadInquiry();return oldTravel(to);};
 showAtlasDetails=function(to){syncRoutes();return oldDetails(to);};
 // Keep serialized enemy indices and canonical life/death intact. Every query of
 // alive/deathAnim hides unrevealed encounters; save serialization reads the
 // canonical values. No removed array entries or fabricated death rewards.
 let serializing=false;const gated=new WeakSet(),canonical=new WeakMap();
 function installEnemyGates(){for(const m of Object.values(maps))for(const e of m.enemies||[]){if(gated.has(e))continue;gated.add(e);const values={alive:e.alive,deathAnim:e.deathAnim};canonical.set(e,values);for(const key of ['alive','deathAnim'])Object.defineProperty(e,key,{enumerable:true,configurable:true,get(){return !serializing&&enemyStoryHidden(e)?(key==='alive'?false:0):values[key];},set(v){values[key]=v;}});}}
 // Scaling is state maintenance, not encounter exposure. Read canonical life
 // here so a dormant full-health enemy is not scaled as though it were dead.
 const oldScale=scaleEnemiesForRegion;
 scaleEnemiesForRegion=function(...args){const previous=serializing;serializing=true;try{return oldScale(...args);}finally{serializing=previous;}};
 const oldSnapshot=snapshotGameState;
 snapshotGameState=function(){serializing=true;try{const save=oldSnapshot();save.townQuestState[id]={...save.townQuestState[id],version:1};return save;}finally{serializing=false;}};
 const oldLoad=applySavedGame;
 applySavedGame=function(save){
  if(!save)return;
  save=structuredClone(save);const q=save.townQuestState||(save.townQuestState={}),v=q._vampire||{},l=q.last_lantern||{};
  if(q[id]?.version!==1){
   const alreadyKnown=v.clues?.includes('mosslight')||['hunt','ally'].includes(v.choice)||v.turned===true||v.cured===true||v.complete===true||l.accepted===true||l.register===true||l.claimed===true||save.mapId==='veilhaven'||q._visited?.veilhaven===true||q.briar_hollow?.claimed===true||['watch','ration'].includes(q.briar_hollow?.plan);
   q[id]={...q[id],version:1};if(alreadyKnown){q._lastLanternAccess={revealed:true};q[id].legacy=true;}
  }
  // Reset unsaved legacy encounters rather than inheriting another slot's kills.
  for(const [mid,m] of Object.entries(maps))for(const [i,e] of m.enemies.entries())if((e.kind==='vampire'||e.catalogType==='vampire_hunter')&&!save.mapStates?.[mid]?.enemies?.[i]){const v=canonical.get(e);if(v){v.alive=true;v.deathAnim=0;}e.respawnAt=0;}
  if(save.mapId==='veilhaven'&&q._lastLanternAccess?.revealed!==true){save.mapId='worldsend';save.player={...save.player,x:750,y:315};}
  oldLoad(save);syncRoutes();
 };
 syncRoutes();
})();

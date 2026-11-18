/* A Light Beneath the Ruins. Inserted before the first character snapshot by
 * apply-last-lantern.py; never load twice as an additional script tag.
 * Authored content is isolated here; solidAreas is the reusable geometry seam.
 */
(() => {
 'use strict';
 const id='last_lantern', quest='last_lantern';
 // Closed until an approved later-story reveal explicitly authorizes this hero.
 // road-inquiry.js grants earned access and preserves explicit legacy knowledge.
 const access=(quests=townQuestState)=>quests?._lastLanternAccess?.revealed===true;
 const entry={id:'lantern_road',x:650,y:315,label:'LAST LANTERN · RUINED CHURCH'};
 const objects=[
  {id:'lantern_return',x:80,y:490,label:'BRIAR HOLLOW · RETURN'},
  {id:'lantern_bell',x:145,y:155,label:'SEVERED BELL ROPE'},
  {id:'lantern_register',x:415,y:170,label:'REFUGE REGISTER'},
  {id:'lantern_inventory',x:825,y:440,label:'WAGON INVENTORY'},
  {id:'lantern_light',x:175,y:455,label:'ROAD LANTERN'}
 ];
 // A single cutaway map: churchyard, nave, then undercroft through broad doors.
 // Rectangles drive both visible masonry/benches and ordinary engine collision.
 const masonry=[
  [305,65,325,265],[305,365,325,545],
  [325,65,905,85],[325,525,905,545],[885,85,905,525],
  [625,85,645,265],[625,365,645,525]
 ];
 const benches=[[360,225,425,243],[510,225,580,243],[365,390,438,408],[515,410,585,428]];
 const freshEnemies=[['yard','bloodbound_scout',220,235],['nave','bloodbound_scout',475,315],['stalker','veil_stalker',745,350],['captain','crimson_elder',810,180]].map(([key,type,x,y],i)=>{
  const d=vampireMonsterDefs[type],boss=key==='captain',hp=boss?20:d.hp;
  return {kind:'vampire',vampireType:type,name:boss?'Captain Veyr · Lantern raiders':d.name,
   lanternRaider:key,combatLevel:13,combatBaseHp:hp,baseHp:hp,maxHp:hp,hp,alive:true,
   spawnX:x,spawnY:y,x,y,seed:980+i,boss,respawnAt:0,lootClaimed:false};
 });
 maps[id]={name:'Church of the Last Lantern',level:13,combatLevel:13,dungeon:true,
  trees:[],stones:[],npcs:[],enemies:structuredClone(freshEnemies),gatherNodes:[],
  arrival:[80,490],solidAreas:[...masonry,...benches],worldObjects:objects,
  hint:'A Light Beneath the Ruins · churchyard → nave → undercroft. Return southwest at any time.'};
 mapConnections[id]={entries:{default:[80,490]},exits:[{trigger:'interact',x:80,y:490,radius:44,to:'briarhollow',entry:'from_lantern'}]};
 mapConnections.briarhollow.entries.from_lantern=[650,315];
 const outward={trigger:'interact',x:650,y:315,radius:44,to:id,entry:'default'};
 // Atlas route placement only: this is a separate explorable map, not a grid town.
 const position=[(worldPositions.briarhollow?.[0]||50)+2,(worldPositions.briarhollow?.[1]||50)+2];
 function syncAccess(quests=townQuestState){
  const open=access(quests),objects=maps.briarhollow.worldObjects,exits=mapConnections.briarhollow.exits;
  if(open){if(!objects.includes(entry))objects.push(entry);if(!exits.includes(outward))exits.push(outward);worldPositions[id]=position;}
  else{const oi=objects.indexOf(entry),ei=exits.indexOf(outward);if(oi>=0)objects.splice(oi,1);if(ei>=0)exits.splice(ei,1);delete worldPositions[id];}
 }
 syncAccess();
 const mapBefore=setMap;
 setMap=function(destination,...args){syncAccess();if(destination===id&&!access())return false;return mapBefore(destination,...args);};
 const detailsBefore=showAtlasDetails,travelBefore=travelTo;
 showAtlasDetails=function(destination){if(destination===id&&!access()){document.getElementById('atlasSelection').textContent='This route is not available yet.';return false;}return detailsBefore(destination);};
 travelTo=function(destination){if(destination===id&&!access())return false;return travelBefore(destination);};
 const read=()=>townQuestState[quest]||{};
 const state=()=>townQuestState[quest]||(townQuestState[quest]={accepted:true});
 const cleared=()=>maps[id].enemies.every(e=>!e.alive);
 const evidence=s=>s.bell&&s.register&&s.inventory;
 const guide=()=>{
  const s=read();return {destination:s.accepted?id:'briarhollow',
   detail:s.claimed?'The road lantern burns again. The coded destinations remain an unresolved lead.':!s.accepted?'In Briar Hollow, follow the Last Lantern sign east of the remembrance stone.':!cleared()?'Search the churchyard, nave and undercroft. Defeat the four raiders; retreat southwest whenever needed.':!evidence(s)?'Secure the severed bell rope, refuge register and wagon inventory.':'Return to the churchyard and relight the road lantern.',
   progress:[s.bell,s.register,s.inventory].filter(Boolean).length+'/3 discoveries · '+maps[id].enemies.filter(e=>!e.alive).length+'/4 raiders',ready:cleared()&&evidence(s)&&!s.claimed};
 };
 const catalogBefore=questCatalog;
 questCatalog=function(){if(!access())return catalogBefore();const s=read();return [...catalogBefore(),{id:quest,title:'A Light Beneath the Ruins',desc:guide().detail,reward:'65 crowns · 70 XP · an unresolved wagon-route lead',active:!!s.accepted&&!s.claimed,done:!!s.claimed}];};
 const guideBefore=questGuide;
 questGuide=function(q){return q.id===quest?guide():guideBefore(q);};
 const killBefore=finishEnemy;
 finishEnemy=function(e,killerClass){
  if(e.alive&&mapId===id&&e.lanternRaider){const s=state();s[e.lanternRaider]=true;if(maps[id].enemies.every(other=>other===e||!other.alive))s.cleared=true;}
  return killBefore(e,killerClass);
 };
 // Reset this module's live enemies before *every* slot application. Historical
 // saves have no entry for this map; they must not inherit another hero's kills.
 const loadBefore=applySavedGame;
 applySavedGame=function(save){
  if(!save)return;
  maps[id].enemies.splice(0,maps[id].enemies.length,...structuredClone(freshEnemies));
  syncAccess(save.townQuestState);
  // A pre-gate development save cannot expose the lair without authorization.
  // Preserve its discoveries/clearance, but resume outside on the existing road.
  if(save.mapId===id&&!access(save.townQuestState))save={...save,mapId:'briarhollow',player:{...save.player,x:650,y:315}};
  loadBefore(save);
  syncAccess();
  const s=read();for(const e of maps[id].enemies)if(s[e.lanternRaider]||s.cleared||s.claimed){e.alive=false;e.hp=0;e.respawnAt=0;}
 };
 const interactBefore=worldObjectInteract;
 worldObjectInteract=function(o){
  if(!o?.id?.startsWith('lantern_'))return interactBefore(o);
  if(!access())return false;
  // Preserve normal proximity/map requirements even for delayed dialog callbacks.
  if(!(activeMap.worldObjects||[]).includes(o)||Math.hypot(player.x-o.x,player.y-o.y)>68)return false;
  if(o.id==='lantern_return')return takeMapExit(mapConnections[id].exits[0]);
  if(o.id==='lantern_road'){
   const prior=townQuestState.briar_hollow||{};
   openAdventureDialog('The Church of the Last Lantern','A roadside church once kept a lantern burning for boats and wagons. Its windows are boarded; hostile vampire raiders hold the ruins. This is an optional expedition, recommended for level 13+ with healing supplies. You may retreat at any time.\n\n'+(prior.claimed?'Ada is safe and the missing are remembered. This trail does not settle their fates.':prior.rescued?'Ada has reached safety. The church is a separate lead.':'Briar Hollow’s search for survivors remains separate; you can return to it at any time.'),[
    {label:'Enter the ruined church',action:()=>{if(!access()||mapId!=='briarhollow'||Math.hypot(player.x-entry.x,player.y-entry.y)>68)return;if(!journalCanAccept(quest))return;state().accepted=true;takeMapExit(mapConnections.briarhollow.exits.find(e=>e.to===id));}},
    {label:'Stay on the road',action:()=>{}}
   ]);return true;
  }
  if(mapId!==id)return false;
  if(!journalCanAccept(quest))return true;
  const s=state();
  const clues={
   lantern_bell:['bell','A warning silenced','The warning bell still hangs above the churchyard, but its rope was cut cleanly. A short end lies beneath the frame. It echoes a method recorded on other raided roads; it does not prove the same raiders attacked Briar Hollow.'],
   lantern_register:['register','A house for travelers','The refuge register records ordinary lives: a wagoner drying blankets, a boat crew sharing supper, a caretaker lending a lantern to a lost child. No declaration of belief was required for shelter.\n\nBenches have been dragged aside. Memorial plaques are scraped bare. These raiders have turned a place of welcome into a storehouse. The register deserves to survive them.'],
   lantern_inventory:['inventory','Only a staging point','Oil, blankets, bandages and spare wagon axles are tallied beside coded destinations: R-7 and the Third Mooring. There is no key to the codes and no list naming the missing residents.\n\nCaptain Veyr commands this small raiding party, not the vampire houses. The inventory points beyond this temporary staging post. It gives no answer about the black-cloaked stranger.']
  };
  const clue=clues[o.id];
  if(clue){s[clue[0]]=true;saveGame();ui();openAdventureDialog(clue[1],clue[2],[{label:'Keep the evidence in the journal',action:()=>{}}]);return true;}
  if(o.id==='lantern_light'){
   if(s.claimed){openAdventureDialog('The road lantern burns','The church is quiet. Travelers can see the road again. The coded wagon destinations remain a lead, not an ending.',[{label:'Leave the light burning',action:()=>{}}]);return true;}
   if(!cleared()||!evidence(s)){openAdventureDialog('A Light Beneath the Ruins',guide().detail+'\n\n'+guide().progress,[{label:'Continue searching',action:()=>{}}]);return true;}
   // One transition owns the reward and the light; never grant on map entry.
   s.cleared=true;s.claimed=true;player.coins+=65;grantXp(70);saveGame();ui();
   openAdventureDialog('A Light Beneath the Ruins · Complete','You secure the register, cut rope and inventory, then relight the road lantern. The ruined church is no longer a raider staging post.\n\n65 crowns · 70 XP\n\nR-7. The Third Mooring. Somewhere beyond this road, wagons are still moving. The larger story remains unresolved.',[{label:'Keep the road lit',action:()=>{}}]);return true;
  }
  return true;
 };
 // An optional, original disagreement inside the neutral sanctuary. The same
 // explicit reveal gate and secured evidence are required on every callback.
 const counselId='veil_counsel';
 const counselRead=()=>townQuestState[counselId]||{};
 const counselState=()=>townQuestState[counselId]||(townQuestState[counselId]={});
 const counselEligible=()=>access()&&read().claimed===true&&evidence(read());
 const positions={
  mirelle:'Refuge first. If we turn the clinic into an inquiry desk, frightened people may stop coming. I will prepare a private welcome note: care without testimony, feeding or any promise of loyalty. But keeping every warning private could leave the next wagon unchallenged.',
  vaelis:'A record that can be challenged is stronger than a rumor. I want a witness ledger that distinguishes what was seen from what was inferred, including Orven’s part. No witness owes us a name. Yet careful records take time while the wagons keep moving.',
  orven:'I want a road-watch brief: wagon markings and safe ways to report a sighting, never a list of people to hunt. I once guarded those wagons. Let that stay in the record. Waiting can cost lives, but frightened watchers could mistake an innocent traveler for a raider.'
 };
 const priorities={
  refuge:{label:'Prepare a refuge note',result:'Mirelle has prepared a refuge note: care is unconditional; testimony is optional. Vaelis keeps the source evidence separate. Orven’s proposed road watch remains deferred.',replies:{mirelle:'The refuge note is ready. Nobody has to earn a bandage by telling us their story.',vaelis:'I have kept your source record separate from the clinic note. I still want a witness ledger; privacy must not become an excuse to forget responsibility.',orven:'I will respect the clinic’s boundary. I still worry about the next wagon. You have not asked me to organize watchers.'}},
  testimony:{label:'Prepare a witness ledger',result:'Vaelis has prepared a witness ledger separating observation from inference. Orven’s admission is included as his own account, not proof about Briar Hollow. Mirelle records no patient names. The road-watch proposal remains deferred.',replies:{mirelle:'The ledger contains no patient names from me. Care must remain available to people who will never testify.',vaelis:'The ledger is ready. The cut rope suggests a method, not a proven identity. The inventory gives codes, not destinations we can claim to know.',orven:'My admission is in the ledger. I guarded raider wagons elsewhere; I cannot name the attackers at Briar Hollow. Recording that limit does not excuse what I did.'}},
  watch:{label:'Prepare a road-watch brief',result:'Orven has prepared a road-watch brief limited to sightings and safe reporting. It grants no authority to pursue, detain or punish anyone. Mirelle’s clinic remains outside the watch; Vaelis retains the evidence. No patrol or rescue is claimed.',replies:{mirelle:'The clinic will not supply names to the watch. Bring anyone who needs help here, without demanding a report.',vaelis:'I attached the limits of our evidence to the brief. R-7 is still a code, not a destination or a warrant.',orven:'The brief is ready: observe, withdraw safely, report. No pursuit and no hunting by ancestry. Nobody has been sent out on your word alone.'}}
 };
 const followups={
  refuge:{who:'orven',note:'Orven adds a boundary to the refuge note: a person who has escaped a wagon may fear being recognized by a former guard. He offers to stay away from clinic arrivals unless someone asks to speak with him. His help must not make refuge feel like another checkpoint.'},
  testimony:{who:'mirelle',note:'Mirelle adds a witness safeguard: silence, injury and a refusal to give a name must never be entered as evidence against a person. She will offer care before anyone asks for an account. The ledger now records that limit beside its invitation to testify.'},
  watch:{who:'vaelis',note:'Vaelis adds a correction procedure: each reported sighting must keep the observer’s uncertainty attached. A matching wagon mark is not proof of an abduction. An unconfirmed report must be corrected rather than quietly copied into a list of enemies.'}
 };
 function counselNear(n){return counselEligible()&&mapId==='veilhaven'&&maps.veilhaven.npcs.includes(n)&&Math.hypot(player.x-n.x,player.y-n.y)<=88;}
 const counselReady=()=>['reviewed','mirelle','vaelis','orven'].every(key=>counselRead()[key]===true);
 function counselOpen(n){
  if(!counselNear(n))return;
  const s=counselState(),who=n.vampireId;
  const current=()=>counselNear(n)&&counselRead()===s;
  if(s.choice){
   const follow=followups[s.choice],choices=[];
   if(!s.response&&who===follow.who)choices.push({label:'Record the unresolved concern',action:()=>{
    if(!current()||counselRead().choice!==s.choice||counselRead().response)return;
    counselState().response=true;saveGame();ui();
    openAdventureDialog('A recommendation with limits',follow.note+'\n\nOnly your chosen document has been prepared and annotated. The other proposals remain unadopted. The disagreement is not over.',[{label:'Keep this knowledge in the journal',action:()=>{}}]);
   }});
   choices.push({label:'Other matters',action:()=>{if(current())conversationBefore(n);}},{label:'Leave',action:()=>{}});
   openAdventureDialog(n.name+' · After the decision',priorities[s.choice].replies[who]+'\n\n'+priorities[s.choice].result+'\n\n'+(s.response?follow.note:'Before filing your recommendation, hear the remaining concern from '+vampireNpcDefs[follow.who].name+'.'),choices);return;
  }
  const choices=[];
  if(!s.reviewed)choices.push({label:'Review the secured evidence',action:()=>{
   if(!current()||counselRead().choice||!journalCanAccept(counselId))return;
   counselState().reviewed=true;saveGame();ui();
   openAdventureDialog('The Weight of a Record','The register remembers travelers offered shelter without a declaration of belief. The cut rope suggests a repeated method, not the identity of Briar Hollow’s attackers. The inventory lists supplies and two unexplained codes. It names no missing resident.\n\nThese records justify a response to specific raiders, not guilt assigned to every vampire. What should your recommendation support first?',[{label:'Hear this resident’s position',action:()=>counselOpen(n)}]);
  }});
  else choices.push({label:'Hear '+n.name+'’s proposal',action:()=>{
   if(!current()||counselRead().choice)return;
   counselState()[who]=true;saveGame();ui();
   openAdventureDialog(n.name+' · A different priority',positions[who],[{label:'Continue the discussion',action:()=>counselOpen(n)},{label:'Consider the other residents',action:()=>{}}]);
  }});
  if(who==='vaelis'&&counselReady())for(const [key,d] of Object.entries(priorities))choices.push({label:d.label,action:()=>{
   if(!current()||!counselReady()||counselRead().choice)return;
   openAdventureDialog('Endorse a first step',d.result+'\n\nThis records your recommendation permanently. It does not settle the disagreement or bind anyone to your service.',[{label:'Confirm this recommendation',action:()=>{
    if(!current()||!counselReady()||counselRead().choice)return;
    counselState().choice=key;saveGame();ui();counselOpen(n);
   }},{label:'Keep considering',action:()=>counselOpen(n)}]);
  }});
  choices.push({label:'Other matters',action:()=>{if(current())conversationBefore(n);}},{label:'Leave',action:()=>{}});
  openAdventureDialog(n.name+' · The Weight of a Record','Veilhaven offers sanctuary, but its residents disagree about what that requires beyond its shores. Nobody here speaks for every vampire.\n\n'+(s.reviewed?'Hear Mirelle at the clinic, Orven near the watch and Vaelis in the square. Return to Vaelis after hearing all three.':'You have secured the Last Lantern records. Review what they establish before asking the residents how to respond.'),choices);
 }
 const conversationBefore=openNpcConversation;
 openNpcConversation=function(n){if(n?.vampireId&&counselNear(n))return counselOpen(n);return conversationBefore(n);};
 const counselCatalogBefore=questCatalog,counselGuideBefore=questGuide;
 const counselDetail=()=>counselRead().choice?priorities[counselRead().choice].result+'\n'+(counselRead().response?followups[counselRead().choice].note:'Next: hear the unresolved concern from '+vampireNpcDefs[followups[counselRead().choice].who].name+'.'):'Review the secured records with a Veilhaven resident. Hear Mirelle, Orven and Vaelis, then recommend a first step to Vaelis. No payment or allegiance is required.';
 questCatalog=function(){const rows=counselCatalogBefore();if(counselEligible())rows.push({id:counselId,title:'The Weight of a Record',desc:counselDetail(),reward:'A recorded recommendation; no currency or equipment',active:!!counselRead().reviewed&&!counselRead().response,done:!!counselRead().choice&&!!counselRead().response});return rows;};
 questGuide=function(q){return q.id===counselId&&counselEligible()?{destination:'veilhaven',detail:counselDetail(),progress:['mirelle','vaelis','orven'].filter(key=>counselRead()[key]).length+'/3 residents heard',ready:counselReady()&&!counselRead().choice}:counselGuideBefore(q);};
 // Completed/partial discoveries remain readable in the normal quest journal.
 const rawCatalog=questCatalog;
 questCatalog=function(){const rows=rawCatalog(),q=rows.find(q=>q.id===quest),s=read();if(!q)return rows;q.desc+='\n'+[s.bell?'Bell: a severed rope, a repeated method without proof of identity.':'',s.register?'Register: shelter for travelers, boat crews and children.':'',s.inventory?'Inventory: oil, blankets, bandages, axles; R-7 and the Third Mooring. No names or code key.':''].filter(Boolean).join('\n');return rows;};
 const drawBefore=drawBriarHollow;
 drawBriarHollow=function(){
  drawBefore();syncAccess();if(!access())return;
  if(mapId==='briarhollow'){standArt('notice',entry.x,entry.y,42,'extras');if(Math.hypot(player.x-entry.x,player.y-entry.y)<210)drawLocationLabel(entry.x,entry.y-84,'LAST LANTERN · CHURCH →');return;}
  if(mapId!==id)return;
  const b=worldBounds(id),s=read();ctx.save();
  ctx.fillStyle='#30372e';if(!paintSurface('grass',b.minX-22,b.minY-45,b.maxX-b.minX+44,b.maxY-b.minY+80))ctx.fillRect(b.minX-22,b.minY-45,b.maxX-b.minX+44,b.maxY-b.minY+80);
  ctx.fillStyle='#5c5547';if(!paintSurface('dirt',55,280,840,70))ctx.fillRect(55,280,840,70);if(!paintSurface('dirt',55,310,150,200))ctx.fillRect(55,310,150,200);
  ctx.fillStyle='#4b4a43';if(!paintSurface('stone',325,85,300,440))ctx.fillRect(325,85,300,440);ctx.fillStyle='#353c40';if(!paintSurface('dungeon',645,85,240,440))ctx.fillRect(645,85,240,440);
  ctx.strokeStyle='#78726355';ctx.lineWidth=1;
  for(let x=330;x<885;x+=35){ctx.beginPath();ctx.moveTo(x,85);ctx.lineTo(x,525);ctx.stroke();}
  for(let y=90;y<525;y+=35){ctx.beginPath();ctx.moveTo(325,y);ctx.lineTo(885,y);ctx.stroke();}
  for(const [x,y,x2,y2] of masonry){ctx.fillStyle='#716e60';ctx.fillRect(x,y,x2-x,y2-y);ctx.fillStyle='#ada28a';ctx.fillRect(x,y,x2-x,4);ctx.fillStyle='#242b29';ctx.fillRect(x,y2-4,x2-x,4);}
  for(const [x,y,x2,y2] of masonry){ctx.strokeStyle='#393e36';ctx.lineWidth=1;for(let sy=y+16;sy<y2;sy+=16){ctx.beginPath();ctx.moveTo(x,sy);ctx.lineTo(x2,sy);ctx.stroke();}for(let sx=x+26;sx<x2;sx+=26){ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx,y2);ctx.stroke();}}
  for(const [x,y,x2,y2] of benches){ctx.fillStyle='#32271f';ctx.fillRect(x,y,x2-x,y2-y);ctx.fillStyle='#826647';ctx.fillRect(x,y,x2-x,6);}
  // Boarded windows, scraped plaques, cut bell and a visible stair threshold.
  for(const x of [380,490,565]){ctx.fillStyle='#171f23';ctx.fillRect(x,85,32,28);ctx.fillStyle='#71543b';ctx.fillRect(x-3,91,38,6);ctx.fillRect(x-3,103,38,6);}
  for(const x of [365,515]){ctx.fillStyle='#a99d7f';ctx.fillRect(x,483,50,18);ctx.strokeStyle='#48483e';ctx.beginPath();ctx.moveTo(x+5,486);ctx.lineTo(x+44,496);ctx.stroke();}
  for(let x=620;x<677;x+=9){ctx.fillStyle='#99917d';ctx.fillRect(x,278,3,73);}
  standArt('crate',760,460,38,'extras');standArt('crate',855,390,36,'extras');
  ctx.fillStyle='#634d37';ctx.fillRect(125,98,6,58);ctx.fillRect(163,98,6,58);ctx.fillRect(125,98,44,6);
  ctx.fillStyle='#a58e56';ctx.beginPath();ctx.ellipse(147,122,13,11,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b8a27b';ctx.beginPath();ctx.moveTo(147,133);ctx.lineTo(150,143);ctx.stroke();
  for(const o of objects){
   if(o.id==='lantern_light'){if(s.claimed)standArt('lamp',o.x,o.y,65);else{ctx.fillStyle='#79684d';ctx.fillRect(o.x-3,o.y-62,6,62);ctx.fillRect(o.x-3,o.y-62,20,5);ctx.strokeStyle='#99896d';ctx.lineWidth=3;ctx.strokeRect(o.x+7,o.y-55,12,17);ctx.fillStyle='#17211d';ctx.fillRect(o.x+9,o.y-53,8,13);}if(s.claimed){ctx.fillStyle='#ffd37c';ctx.beginPath();ctx.arc(o.x,o.y-42,7,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.14;ctx.beginPath();ctx.arc(o.x,o.y-42,45,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
   else if(o.id==='lantern_register'||o.id==='lantern_inventory')standArt('scroll',o.x,o.y,34,'extras');
   else if(o.id==='lantern_return')standArt('notice',o.x,o.y,36,'extras');
   if(Math.hypot(player.x-o.x,player.y-o.y)<210)drawLocationLabel(o.x,o.y-60,o.label);
  }
  if(player.x>325&&player.x<625)drawLocationLabel(475,138,'NAVE');if(player.x>645)drawLocationLabel(765,112,'UNDERCROFT');
  ctx.restore();
 };
})();

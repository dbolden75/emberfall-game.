// Dalen's Ashvale chapters: preserve old accepted objectives and the seal gate.
(() => {
 const ids=['ashvale_watch','ashvale_scout'];
 for(const id of ids)townQuestDefs[id].choiceBased=true;
 const near=o=>Math.hypot(player.x-o.x,player.y-o.y)<100;
 const bonded=()=>humanCompanion()?.id==='dalen'&&townQuestState.recruit_dalen?.claimed;
 const site={id:'ashvale_refuge',label:'ROADSIDE REFUGE SITE',...safeMapPosition('whisperwood',100,220,70)};
 (maps.whisperwood.worldObjects||(maps.whisperwood.worldObjects=[])).push(site);
 const commit=()=>{saveGame();ui();};
 const contact=(n,id)=>mapId==='wayfarers_camp'||npcs.includes(n)&&n.questId===id&&near(n);
 const ready=(id,s)=>s.method==='shelter'?s.built===true:s.method==='accounts'?s.fieldRead===true&&s.accountRead===true:s.kills>=townQuestDefs[id].target&&bagCount(townQuestDefs[id].drop)>=townQuestDefs[id].dropTarget;
 function detail(id,s){
  if(id==='ashvale_watch')return s.claimed?(s.method==='shelter'?'Dalen kept a retreat open. The refuge northwest of Rowan restores 20 vitality when the road is quiet, once every five minutes.':'Dalen cleared the road and received a 12-crown clearance premium. No refuge was built.'):
   s.method==='shelter'?(s.built?'Return to Reeve Mara in Ashvale, or Dalen at camp, to register the refuge.':'Bring Dalen, two Wood Logs and one Field Ration to the refuge site northwest of Rowan in Whisperwood.'):'Defeat three Ash Slimes with Dalen and deliver three Ash Motes. Clearance pays 12 extra crowns instead of establishing a refuge.';
  return s.claimed?(s.method==='accounts'?'Rowan’s log counted patrol departures; Dalen’s account counted arrivals at the gate. The missing return entry proves a gap in the record, not anyone’s fate. Both accounts are preserved.':'Dalen recovered the patrol’s signal materials from the slime nests. The field recovery is recorded; the two watch accounts were not compared.'):
   s.method==='accounts'?(!s.fieldRead?'Ask Rowan in Whisperwood to read his departure log with Dalen.':!s.accountRead?'Return to Wayfarer’s Camp with Dalen. Ask him to compare his watch account with Rowan’s log.':'Return to Rowan in Whisperwood, or discuss the report with Dalen at camp, to record the comparison and claim the chapter.'):'Defeat two Ash Slimes with Dalen and deliver two Ash Motes to recover the patrol signal.';
 }
 const previous=interactQuest;
 interactQuest=function(n){
  const id=n.questId;if(!ids.includes(id))return previous(n);
  const owner=townQuestState,origin=mapId,q=townQuestDefs[id];let s=owner[id];
  if(s&&!s.method)return previous(n); // Existing saves retain their exact task/reward.
  // The outer companion wrapper still enforces the established recruitment bond.
  if(!bonded()||!contact(n,id)||journalPaused(id))return true;
  if(q.requires&&!owner[q.requires]?.claimed)return previous(n);
  const current=()=>owner===townQuestState&&mapId===origin&&bonded()&&contact(n,id)&&!journalPaused(id)&&(!q.requires||owner[q.requires]?.claimed);
  if(!s){
   const methods=id==='ashvale_watch'?[['clear','Clear the threats · 36 crowns'],['shelter','Establish a refuge · 24 crowns + roadside rest']]:[['recover','Recover the patrol signal from the nests'],['accounts','Compare the two watch accounts']];
   openAdventureDialog(q.title,q.intro+'\n\n'+(id==='ashvale_watch'?'Clearance requires three Ash Slimes and three Ash Motes. A refuge instead uses two Wood Logs and one Field Ration at a single roadside site; it leaves the creatures alive. Both advance Dalen’s story.':'Field recovery requires two Ash Slimes and two Ash Motes. Comparing accounts instead requires Rowan’s departure log and a conversation with Dalen at camp. Both earn the same chapter reward and Ashvale seal.'),methods.map(([method,label])=>({label,action:()=>{
    if(!current()||owner[id]||!journalCanAccept(id))return;
    s=owner[id]={accepted:true,claimed:false,kills:0,method};owner._tracking={id};commit();say(detail(id,s));
   }})));return true;
  }
  if(s.claimed){say(detail(id,s));return true;}
  if(id==='ashvale_scout'&&s.method==='accounts'&&!s.fieldRead&&mapId==='whisperwood'){
   openAdventureDialog('Rowan’s departure log','Rowan counted who left the watch post. Dalen counted who reached the gate. A departure entry cannot stand in for a return entry. Compare the original columns together at camp before drawing a conclusion.',[{label:'Record Rowan’s departure column',action:()=>{if(!current()||owner[id]!==s||s.claimed||s.fieldRead)return;s.fieldRead=true;commit();say(detail(id,s));}}]);return true;
  }
  if(!ready(id,s)){say(detail(id,s));return true;}
  openAdventureDialog(q.title+' · Report ready',detail(id,s),[{label:'Record the result and claim the chapter',action:()=>{
   if(!current()||owner[id]!==s||s.claimed||!ready(id,s))return;
   if(['clear','recover'].includes(s.method)&&!removeItem(q.drop,q.dropTarget))return;
   s.claimed=true;player.coins+=q.coins+(id==='ashvale_watch'&&s.method==='clear'?12:0);grantXp(q.xp);refreshTownRelics(true);commit();say(detail(id,s));
  }}]);return true;
 };
 const humanBefore=openHumanStory;
 openHumanStory=function(id){
  humanBefore(id);
  const owner=townQuestState,s=owner.ashvale_scout;
  if(id!=='dalen'||mapId!=='wayfarers_camp'||!bonded()||s?.method!=='accounts'||!s.fieldRead||s.accountRead||s.claimed||journalPaused('ashvale_scout'))return;
  const choices=adventureChoices.slice();
  openAdventureDialog('Dalen · Two columns',"Rowan wrote down departures. My gate book recorded arrivals. We kept asking one column to answer the other. Let us put them side by side; a missing entry is not a death record.",[{label:'Compare Dalen’s gate account',action:()=>{
   if(owner!==townQuestState||owner.ashvale_scout!==s||mapId!=='wayfarers_camp'||!bonded()||journalPaused('ashvale_scout')||s.claimed||s.accountRead)return;
   s.accountRead=true;commit();openHumanStory(id);
  }},...choices]);
 };
 const objectBefore=worldObjectInteract;
 worldObjectInteract=function(o){
  if(o.id!==site.id)return objectBefore(o);
  const owner=townQuestState,s=owner.ashvale_watch;
  if(mapId!=='whisperwood'||!near(site))return true;
  if(s?.method!=='shelter'){say('A sheltered hollow northwest of Rowan’s post. Discuss the watch with Dalen before building here.');return true;}
  if(journalPaused('ashvale_watch'))return true;
  if(!s.built){
   if(!bonded()){say('Bring Dalen to establish the refuge.');return true;}
   openAdventureDialog('A place to retreat','Dalen leaves the entrance facing the road. Two logs brace the shelter; one ration stocks it. This keeps a place to recover, without promising the surrounding forest is safe.',[{label:'Build with 2 Wood Logs and 1 Field Ration',action:()=>{
    if(owner!==townQuestState||owner.ashvale_watch!==s||s.built||s.claimed||mapId!=='whisperwood'||!near(site)||!bonded()||journalPaused('ashvale_watch'))return;
    if(bagCount('wood_log')<2||bagCount('field_ration')<1){say('Bring two Wood Logs and one Field Ration. Nothing was consumed.');return;}
    removeItem('wood_log',2);removeItem('field_ration',1);s.built=true;commit();say(detail('ashvale_watch',s));
   }}]);return true;
  }
  if(!s.claimed){say(detail('ashvale_watch',s));return true;}
  if(enemies.some(e=>e.alive&&Math.hypot(e.x-site.x,e.y-site.y)<240)){say('The road is not quiet enough to rest. Move the threat away or clear it first.');return true;}
  if(Date.now()<(s.restAt||0)){say('The refuge needs time to replenish its supplies. Rest is available once every five minutes.');return true;}
  if(player.hp>=player.max){say('The refuge stands ready, but you need no treatment.');return true;}
  player.hp=Math.min(player.max,player.hp+20);s.restAt=Date.now()+300000;commit();say('Roadside refuge · restored 20 vitality at most. Supplies replenish in five minutes.');return true;
 };
 const guideBefore=questGuide;
 questGuide=function(q){const g=guideBefore(q),s=townQuestState[q.id];if(!ids.includes(q.id)||!s?.method)return g;return {...g,detail:detail(q.id,s),ready:!s.claimed&&ready(q.id,s),destination:s.claimed?'ashvale':q.id==='ashvale_scout'&&s.method==='accounts'&&s.fieldRead&&!s.accountRead?'wayfarers_camp':ready(q.id,s)?q.id==='ashvale_watch'?'ashvale':'whisperwood':'whisperwood',progress:s.claimed?'Complete':s.method==='shelter'?(s.built?'Refuge built':'Refuge not built'):s.method==='accounts'?[s.fieldRead,s.accountRead].filter(Boolean).length+'/2 accounts':g.progress};};
 const catalogBefore=questCatalog;
 questCatalog=function(){return catalogBefore().map(q=>{const s=townQuestState[q.id];return ids.includes(q.id)&&s?.method?{...q,desc:detail(q.id,s),reward:q.id==='ashvale_watch'?(s.method==='clear'?'36 crowns · 18 XP':'24 crowns · 18 XP · roadside refuge'):q.reward}:q;});};
 const drawBefore=drawWayfarerCamp;
 drawWayfarerCamp=function(){drawBefore();if(mapId!=='whisperwood')return;const s=townQuestState.ashvale_watch;if(s?.built)paintArt('tent',site.x-45,site.y-50,90,65);else standArt('logs',site.x,site.y,28,'items');if(near(site)||townQuestState._tracking?.id==='ashvale_watch'&&s?.method==='shelter')drawLocationLabel(site.x,site.y-62,s?.built?'DALEN’S ROADSIDE REFUGE':'REFUGE SITE');};
})();

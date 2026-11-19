// Corin's missed warning: a shield repurposed, or iron recovered; cloth or open vigil.
(() => {
 const ids=['stonewatch_sweep','stonewatch_silk'];
 for(const id of ids)townQuestDefs[id].choiceBased=true;
 const bell={id:'stonewatch_warning',label:'HIGHMOOR WARNING FRAME',...safeMapPosition('highmoor',145,350,28)};
 const memory={id:'stonewatch_memory',label:'REMEMBRANCE POST',...safeMapPosition('highmoor',200,490,24)};
 const watch={id:'stonewatch_watch',label:'WATCH POST',...safeMapPosition('highmoor',770,350,24)};
 (maps.highmoor.worldObjects||(maps.highmoor.worldObjects=[])).push(bell,memory,watch);
 const near=o=>Math.hypot(player.x-o.x,player.y-o.y)<85;
 const bonded=()=>humanCompanion()?.id==='corin'&&townQuestState.recruit_corin?.claimed;
 const commit=()=>{saveGame();ui();};
 const order=()=>townQuestState.stonewatch_sweep?.method==='gong'?['watch','memory']:['memory','watch'];
 const ready=(id,s)=>s.method==='gong'?s.hung===true:s.method==='open_vigil'?s.closed===true:s.kills>=townQuestDefs[id].target&&bagCount(townQuestDefs[id].drop)>=townQuestDefs[id].dropTarget;
 const reward=(id,s)=>s.method==='open_vigil'?[18,30]:[townQuestDefs[id].coins,townQuestDefs[id].xp];
 function detail(id,s){
  if(id==='stonewatch_sweep')return s.claimed?(s.method==='gong'?'A spare Buckler now hangs as a warning gong in Highmoor. Corin chose to make protection audible. The open vigil will begin at the watch post, then remembrance.':'Corin recovered the Grave Iron for the old warning frame. The open vigil will begin with remembrance, then the watch.'):
   s.method==='gong'?(s.hung?'The warning gong is hung. Report to Harlan or Corin at camp.':'Bring Corin and one spare Buckler to Highmoor’s warning frame near the western approach. The Stonewatch Weapons shop sells Bucklers. An equipped Buckler is protected unless you have a second one.'):'Defeat three Highmoor skeletons with Corin and deliver three Grave Iron pieces to Harlan.';
  if(s.claimed)return s.method==='open_vigil'?'Corin completed the open vigil. The posts remember the fallen and the duty of the living; no witness was asked to take his vows. The warning frame bears two ribbons. Earned 18 crowns and 30 XP.':'Mara prepared the shrine cloth from two Ruin Weaver Silk. Corin finished his vigil beneath it. The warning frame bears a folded cloth. Earned 28 crowns and 20 XP.';
  if(s.method!=='open_vigil')return 'Defeat two Ruin Weavers with Corin and bring two Ruin Weaver Silk to Mara for the shrine cloth.';
  if(s.closed)return 'The open vigil is complete. Report to Mara or Corin at camp.';
  const next=order()[s.steps||0];return next?'Bring Corin to Highmoor’s '+(next==='watch'?'eastern watch post':'southwestern remembrance post')+'. '+(s.steps||0)+'/2 stations witnessed. You accompany him without taking vows.':'Return with Corin to the warning frame near Highmoor’s western approach to close the vigil.';
 }
 const before=interactQuest;
 interactQuest=function(n){
  const id=n.questId;if(!ids.includes(id))return before(n);
  const owner=townQuestState,origin=mapId,q=townQuestDefs[id];let s=owner[id];
  if(s&&!s.method)return before(n);
  const contact=()=>mapId==='wayfarers_camp'||npcs.includes(n)&&n.questId===id&&near(n);
  const current=()=>owner===townQuestState&&mapId===origin&&bonded()&&contact()&&!journalPaused(id)&&(!q.requires||owner[q.requires]?.claimed);
  if(!bonded()||!contact()||journalPaused(id))return true;
  if(q.requires&&!owner[q.requires]?.claimed)return before(n);
  if(!s){
   const methods=id==='stonewatch_sweep'?[['iron','Recover Grave Iron from the wardens'],['gong','Give a spare Buckler to the warning frame']]:[['cloth','Prepare the shrine cloth · 28 crowns / 20 XP'],['open_vigil','Accompany an open vigil · 18 crowns / 30 XP']];
   openAdventureDialog(q.title,q.intro+'\n\n'+(id==='stonewatch_sweep'?'Recover three fresh skeleton defeats and three Grave Iron, or permanently repurpose one spare Buckler as a warning gong at Highmoor’s western frame. The Stonewatch Weapons shop sells Bucklers. Your equipped Buckler is protected; a second copy may be used. Both earn 42 crowns and 28 XP. Restoring the warning does not make Highmoor’s roads safe.':'Prepare cloth with two fresh Ruin Weaver defeats and two Ruin Weaver Silk, or walk an open vigil with Corin at the remembrance and watch posts, then close it at the warning frame. The warning you restored determines which station he visits first. You may witness either ceremony without adopting Corin’s beliefs. Neither determines the fate of anyone missing elsewhere.'),methods.map(([method,label])=>({label,action:()=>{
    if(!current()||owner[id]||!journalCanAccept(id))return;
    s=owner[id]={accepted:true,claimed:false,kills:0,method,...(method==='gong'?{hung:false}:method==='open_vigil'?{steps:0,closed:false}:{})};owner._tracking={id};commit();say(detail(id,s));
   }})));return true;
  }
  if(s.claimed){say(detail(id,s));return true;}
  if(!ready(id,s)){say(detail(id,s));return true;}
  openAdventureDialog(q.title+' · Corin’s return',detail(id,s),[{label:'Record the vigil chapter',action:()=>{
   if(!current()||owner[id]!==s||s.claimed||!ready(id,s))return;
   if(['iron','cloth'].includes(s.method)&&!removeItem(q.drop,q.dropTarget))return;
   s.claimed=true;const [coins,xp]=reward(id,s);player.coins+=coins;grantXp(xp);refreshTownRelics(true);commit();say(detail(id,s));
  }}]);return true;
 };
 const objectBefore=worldObjectInteract;
 worldObjectInteract=function(o){
  if(![bell.id,memory.id,watch.id].includes(o.id))return objectBefore(o);
  const owner=townQuestState,id=owner.stonewatch_sweep?.claimed?'stonewatch_silk':'stonewatch_sweep',s=owner[id];
  const current=()=>owner===townQuestState&&owner[id]===s&&mapId==='highmoor'&&near(o)&&bonded()&&!journalPaused(id)&&s?.accepted&&!s.claimed;
  if(!current()){say('Bring Corin and discuss the unfinished vigil in Stonewatch.');return true;}
  if(id==='stonewatch_sweep'){
   if(s.method!=='gong'||o.id!==bell.id||s.hung){say(detail(id,s));return true;}
   openAdventureDialog('A shield that others can hear','Corin threads the Buckler’s straps through the warning frame. This permanently consumes one spare Buckler. The one you are wearing remains yours; if it is your only copy, unequip it deliberately or bring another.',[{label:'Permanently hang one spare Buckler',action:()=>{
    if(!current()||s.hung)return;
    if(bagCount('buckler')-(player.shield==='buckler'?1:0)<1){say('A spare Buckler is needed. Your equipped copy was not taken. The Stonewatch Weapons shop sells Bucklers.');return;}
    if(!removeItem('buckler',1))return;s.hung=true;commit();say(detail(id,s));
   }}]);return true;
  }
  if(s.method!=='open_vigil'||s.closed){say(detail(id,s));return true;}
  if(o.id===bell.id){
   if(s.steps!==2){say(detail(id,s));return true;}
   openAdventureDialog('The warning answered','Corin sounds the warning once, then falls silent. “I cannot change the moment I froze. I can answer the next call.” You stand as witness. This asks no vow of you.',[{label:'Close the vigil as a witness',action:()=>{if(!current()||s.steps!==2||s.closed)return;s.closed=true;commit();say(detail(id,s));}}]);return true;
  }
  const station=o.id===watch.id?'watch':'memory';
  if(order()[s.steps]!==station){say(detail(id,s));return true;}
  const step=s.steps;
  openAdventureDialog(station==='watch'?'The duty that remains':'Those the warning failed',station==='watch'?'Corin faces the road. He names the duty he abandoned: hear the warning, answer it, and leave room for others to retreat. You witness his undertaking; you are not asked to swear it.':'Corin leaves the old names undisturbed. “They were people before they became a lesson about my fear.” The marker concerns Highmoor’s fallen; it supplies no answer about missing people elsewhere.',[{label:station==='watch'?'Witness Corin’s return to duty':'Witness the remembrance',action:()=>{if(!current()||s.steps!==step||order()[s.steps]!==station||s.closed)return;s.steps++;commit();say(detail(id,s));}}]);return true;
 };
 const newsBefore=npcLocalNews;
 npcLocalNews=function(n){if(mapId==='stonewatch'&&['Captain Harlan','Mara the Herbalist'].includes(n.name)){for(const id of ['stonewatch_silk','stonewatch_sweep']){const s=townQuestState[id];if(s?.claimed&&s.method)return detail(id,s);}}return newsBefore(n);};
 const guideBefore=questGuide;
 questGuide=function(q){const g=guideBefore(q),s=townQuestState[q.id];if(!ids.includes(q.id)||!s?.method)return g;return {...g,detail:detail(q.id,s),ready:!s.claimed&&ready(q.id,s),destination:s.claimed||ready(q.id,s)?'stonewatch':'highmoor',progress:s.claimed?'Complete':s.method==='gong'?(s.hung?'Gong hung':'Spare Buckler needed'):s.method==='open_vigil'?(s.closed?'Vigil closed':s.steps+'/2 stations witnessed'):g.progress};};
 const catalogBefore=questCatalog;
 questCatalog=function(){return catalogBefore().map(q=>{const s=townQuestState[q.id];if(!ids.includes(q.id)||!s?.method)return q;const [coins,xp]=reward(q.id,s);return {...q,desc:detail(q.id,s),reward:coins+' crowns · '+xp+' XP'};});};
 const drawBefore=drawWayfarerCamp;
 drawWayfarerCamp=function(){drawBefore();if(mapId!=='highmoor')return;standArt('lamp',bell.x,bell.y,40);for(const o of [memory,watch])standArt('runestone',o.x,o.y,30);if(townQuestState.stonewatch_sweep?.hung)standArt('shield',bell.x,bell.y-10,24,'items');const s=townQuestState.stonewatch_silk;if(s?.claimed&&s.method){ctx.fillStyle='#d8c9a2';if(s.method==='cloth')ctx.fillRect(bell.x-12,bell.y-18,24,9);else{ctx.fillRect(bell.x-9,bell.y-16,3,20);ctx.fillRect(bell.x+6,bell.y-16,3,20);}}for(const o of [bell,memory,watch])if(near(o))drawLocationLabel(o.x,o.y-50,o.label);};
})();

// Eryn's beacon: controlled discharge and a choice of magical or mechanical repair.
(() => {
 const ids=['sunmere_hunt','sunmere_weavers'];
 for(const id of ids)townQuestDefs[id].choiceBased=true;
 const beacon={id:'sunmere_beacon_work',label:'BEACON SERVICE FRAME',...safeMapPosition('sunmere',760,420,32)};
 const lookout={id:'sunmere_shutter_mount',label:'PASS SHUTTER MOUNT',...safeMapPosition('frostmarch',160,420,28)};
 (maps.sunmere.worldObjects||(maps.sunmere.worldObjects=[])).push(beacon);
 (maps.frostmarch.worldObjects||(maps.frostmarch.worldObjects=[])).push(lookout);
 const near=o=>Math.hypot(player.x-o.x,player.y-o.y)<85;
 const bonded=()=>humanCompanion()?.id==='eryn'&&townQuestState.recruit_eryn?.claimed;
 const commit=()=>{saveGame();ui();};
 const silkNeed=()=>townQuestState.sunmere_hunt?.method==='vent'?1:2;
 const ready=(id,s)=>s.method==='vent'?s.vented===true:s.method==='shutters'?s.mounted===true:s.kills>=townQuestDefs[id].target&&bagCount(townQuestDefs[id].drop)>=(id==='sunmere_weavers'?silkNeed():4);
 const reward=(id,s)=>s.method==='vent'?[40,34]:s.method==='shutters'?[24,36]:[townQuestDefs[id].coins,townQuestDefs[id].xp];
 function detail(id,s){
  if(id==='sunmere_hunt')return s.claimed?(s.method==='vent'?'Eryn vented the damaged charge instead of reinforcing it. The pressure test exposed the narrow seam: one Ice Cave Silk can bind it in the next chapter. Vale paid 40 crowns, fifteen less than field reinforcement.':'Eryn reinforced the damaged beacon with Frost Shards. Vale paid 55 crowns. Binding its charged lens will need two Ice Cave Silk.'):
   s.method==='vent'?(s.vented?'The damaged charge is safely vented. Report to Vale or Eryn at camp.':'Bring Eryn to the beacon service frame on Sunmere’s southeast shore. Set its harbor and pass vents from the service instructions, then test the pressure. No supplies are consumed by a failed test.'):'Defeat four Frostmarch creatures with Eryn and bring four Frost Shards to Vale. This reinforces the charge and pays 55 crowns.';
  return s.claimed?(s.method==='shutters'?'Eryn replaced her experimental control with a mechanical shutter linkage. I fitted its pass mount. The harbor keeps a measured amber signal; Neri records regular manual servicing. Earned 24 crowns and 36 XP.':'Neri bound the lens with '+silkNeed()+' Ice Cave Silk. Eryn admitted the experiment was hers; the repaired ward keeps its blue-white light. Earned 36 crowns and 24 XP.'):
   s.method==='shutters'?(s.mounted?'The linkage is fitted. Report to Neri or Eryn at camp.':!s.converted?'Bring Eryn to the Sunmere beacon frame to dismantle the damaged control and fit a manual crank.':'With Eryn, fit the shutter linkage at the mount on Frostmarch’s southwest approach, then report to Neri or Eryn at camp.'):'Defeat two fresh Ice Cave Weavers with Eryn and bring '+silkNeed()+' Ice Cave Silk to Neri. '+(silkNeed()===1?'The pressure test showed where a single binding will hold.':'The charged lens needs two bindings.');
 }
 const questBefore=interactQuest;
 interactQuest=function(n){
  const id=n.questId;if(!ids.includes(id))return questBefore(n);
  const owner=townQuestState,origin=mapId,q=townQuestDefs[id];let s=owner[id];
  if(s&&!s.method)return questBefore(n);
  const contact=()=>mapId==='wayfarers_camp'||npcs.includes(n)&&n.questId===id&&near(n);
  const current=()=>owner===townQuestState&&mapId===origin&&bonded()&&contact()&&!journalPaused(id)&&(!q.requires||owner[q.requires]?.claimed);
  if(!bonded()||!contact()||journalPaused(id))return true;
  if(q.requires&&!owner[q.requires]?.claimed)return questBefore(n);
  if(!s){
   const methods=id==='sunmere_hunt'?[['reinforce','Reinforce with Frost Shards · 55 crowns'],['vent','Vent the damaged charge · 40 crowns']]:[['weave','Rebind the lens · 36 crowns / 24 XP'],['shutters','Convert to manual shutters · 24 crowns / 36 XP']];
   openAdventureDialog(q.title,q.intro+'\n\n'+(id==='sunmere_hunt'?'Field reinforcement needs four fresh defeats and four Frost Shards. Controlled venting instead needs Eryn and a pressure test at the beacon frame. Vale pays fifteen fewer crowns for venting, but the test reveals how to bind the lens with one silk instead of two later. Both earn 34 XP.':'Rebinding needs two fresh Ice Cave Weaver defeats and '+silkNeed()+' Ice Cave Silk. Alternatively, dismantle the damaged control at the beacon with Eryn, then fit its mechanical linkage at the Frostmarch pass mount. Shutters pay fewer crowns and more experience; the town accepts regular manual servicing. Neither repair changes monster spawns or guarantees safe travel.'),methods.map(([method,label])=>({label,action:()=>{
    if(!current()||owner[id]||!journalCanAccept(id))return;
    s=owner[id]={accepted:true,claimed:false,kills:0,method,...(method==='vent'?{harbor:0,pass:0,vented:false}:method==='shutters'?{converted:false,mounted:false}:{})};owner._tracking={id};commit();say(detail(id,s));
   }})));return true;
  }
  if(s.claimed){say(detail(id,s));return true;}
  if(!ready(id,s)){say(detail(id,s));return true;}
  openAdventureDialog(q.title+' · Beacon report',detail(id,s),[{label:'Record Eryn’s repair and claim the chapter',action:()=>{
   if(!current()||owner[id]!==s||s.claimed||!ready(id,s))return;
   if(['reinforce','weave'].includes(s.method)&&!removeItem(q.drop,id==='sunmere_weavers'?silkNeed():4))return;
   s.claimed=true;const [coins,xp]=reward(id,s);player.coins+=coins;grantXp(xp);refreshTownRelics(true);commit();say(detail(id,s));
  }}]);return true;
 };
 const objectBefore=worldObjectInteract;
 worldObjectInteract=function(o){
  if(![beacon.id,lookout.id].includes(o.id))return objectBefore(o);
  const owner=townQuestState,origin=o.id===beacon.id?'sunmere':'frostmarch';
  const id=owner.sunmere_hunt?.claimed?'sunmere_weavers':'sunmere_hunt',s=owner[id];
  const current=()=>owner===townQuestState&&owner[id]===s&&mapId===origin&&near(o)&&bonded()&&!journalPaused(id)&&s?.accepted&&!s.claimed;
  if(!current()){say('Discuss the beacon work with Eryn and the Sunmere townspeople.');return true;}
  if(id==='sunmere_hunt'){
   if(o.id!==beacon.id||s.method!=='vent'){say(detail(id,s));return true;}
   if(s.vented){say(detail(id,s));return true;}
   const show=()=>openAdventureDialog('Eryn · A controlled discharge','The service plate reads: THREE measures must leave the chamber. The harbor vent must carry TWICE the pass vent. Each dial runs from zero to three. Eryn holds the damaged control steady while you balance the vents.\n\nHarbor: '+s.harbor+' · Pass: '+s.pass,[...['harbor','pass'].map(key=>({label:'Turn '+key+' vent',action:()=>{if(!current()||s.vented)return;s[key]=(s[key]+1)%4;commit();show();}})),{label:'Test the pressure balance',action:()=>{
    if(!current()||s.vented)return;
    if(s.harbor!==2||s.pass!==1){say('The test valve closes without venting. Use three measures in total; the harbor needs twice the pass. Adjust and test again.');return;}
    s.vented=true;commit();say('The charge drains evenly. Eryn marks the single narrow seam revealed beneath it. '+detail(id,s));
   }}]);show();return true;
  }
  if(s.method!=='shutters'){say(detail(id,s));return true;}
  if(o.id===beacon.id){
   if(s.converted){say(detail(id,s));return true;}
   openAdventureDialog('The experiment comes apart','Eryn lays her experimental control on the bench. Neri has agreed to a mechanical replacement: no hidden charge, and a linkage that needs regular servicing. The decision is already recorded; dismantling supplies the parts for the pass mount. No ordinary bag space is needed.',[{label:'Dismantle the control and fit the crank',action:()=>{if(!current()||s.converted)return;s.converted=true;commit();say(detail(id,s));}}]);return true;
  }
  if(!s.converted){say('Convert the control at Sunmere’s beacon frame before fitting the linkage.');return true;}
  if(s.mounted){say('The linkage is fitted. Report to Neri or Eryn at camp.');return true;}
  openAdventureDialog('A signal without a hidden charge','Eryn tensions the linkage while you fasten its pass mount. The shutter now gives the harbor a measured signal. This changes the beacon mechanism, not the creatures on the road.',[{label:'Fit and test the shutter linkage',action:()=>{if(!current()||!s.converted||s.mounted)return;s.mounted=true;commit();say('The linkage is fitted. Report to Neri or Eryn at camp.');}}]);return true;
 };
 const newsBefore=npcLocalNews;
 npcLocalNews=function(n){if(mapId==='sunmere'&&['Harbormaster Vale','Neri the Netmaker'].includes(n.name)){for(const id of ['sunmere_weavers','sunmere_hunt']){const s=townQuestState[id];if(s?.claimed&&s.method)return detail(id,s);}}return newsBefore(n);};
 const guideBefore=questGuide;
 questGuide=function(q){const g=guideBefore(q),s=townQuestState[q.id];if(!ids.includes(q.id)||!s?.method)return g;return {...g,detail:detail(q.id,s),ready:!s.claimed&&ready(q.id,s),destination:s.claimed||ready(q.id,s)||s.method==='vent'||s.method==='shutters'&&!s.converted?'sunmere':'frostmarch',progress:s.claimed?'Complete':s.method==='vent'?(s.vented?'Vented':'Pressure test needed'):s.method==='shutters'?(s.mounted?'Linkage fitted':s.converted?'Crank fitted':'Conversion needed'):s.method==='weave'?Math.min(s.kills||0,2)+'/2 weavers · '+Math.min(bagCount('ice_silk'),silkNeed())+'/'+silkNeed()+' silk':g.progress};};
 const catalogBefore=questCatalog;
 questCatalog=function(){return catalogBefore().map(q=>{const s=townQuestState[q.id];if(!ids.includes(q.id)||!s?.method)return q;const [coins,xp]=reward(q.id,s);return {...q,desc:detail(q.id,s),reward:coins+' crowns · '+xp+' XP'};});};
 const drawBefore=drawWayfarerCamp;
 drawWayfarerCamp=function(){drawBefore();if(mapId==='sunmere'){standArt('lamp',beacon.x,beacon.y,46);const s=townQuestState.sunmere_weavers;if(s?.claimed&&s.method){ctx.fillStyle=s.method==='shutters'?'#ffc477':'#b4edff';ctx.beginPath();ctx.arc(beacon.x,beacon.y-32,s.method==='shutters'?5+Math.sin(animationClock*2)*2:7,0,Math.PI*2);ctx.fill();}if(near(beacon))drawLocationLabel(beacon.x,beacon.y-50,'BEACON SERVICE FRAME');}else if(mapId==='frostmarch'){standArt('crate',lookout.x,lookout.y,30);if(near(lookout))drawLocationLabel(lookout.x,lookout.y-45,'SHUTTER LINKAGE MOUNT');}};
})();

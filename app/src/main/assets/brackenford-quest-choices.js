// Sylvi's marsh evacuation and medicine allocation, independent of Ashvale's arc.
(() => {
 const ids=['bracken_patrol','bracken_herbs'];
 for(const id of ids)townQuestDefs[id].choiceBased=true;
 const signal={id:'bracken_signal',label:'SCOUT DIVERSION SIGNAL',...safeMapPosition('redfen',400,330,24)};
 const cache={id:'bracken_medicine',label:'SCOUT MEDICINE RENDEZVOUS',...safeMapPosition('redfen',90,430,35)};
 (maps.redfen.worldObjects||(maps.redfen.worldObjects=[])).push(signal,cache);
 const close=o=>Math.hypot(player.x-o.x,player.y-o.y)<90;
 const bonded=()=>humanCompanion()?.id==='sylvi'&&townQuestState.recruit_sylvi?.claimed;
 const commit=()=>{saveGame();ui();};
 const reserveNeed=()=>townQuestState.bracken_patrol?.method==='diversion'?4:2;
 const ready=(id,s)=>s.method==='diversion'?s.held>=12:s.method==='reserve'?s.delivered===true:s.kills>=townQuestDefs[id].target&&bagCount(townQuestDefs[id].drop)>=townQuestDefs[id].dropTarget;
 function detail(id,s){
  if(id==='bracken_patrol')return s.claimed?(s.method==='diversion'?'Sylvi guided the scouts through the reed water while I kept the resin signal tended. The longer wet route needs four reserve medicine bottles if Iva supplies them.':'Sylvi opened the direct trail. The scouts need two reserve medicine bottles if Iva supplies them.'):
   s.method==='diversion'?(s.held>=12?'The scouts have passed the signal. Report to Tamsin or Sylvi at camp.':!s.signal?'Bring Sylvi and three Bog Resin to the signal in central Redfen. Resin drops from Bog Slimes and Fen Stalkers.':'Stay inside the marked signal circle with Sylvi for twelve active seconds. Dodge nearby threats. Retreat, menus, pausing and leaving Sylvi stop the count; return to resume. '+Math.floor(s.held||0)+'/12 seconds covered.'):'Defeat three Redfen creatures with Sylvi and deliver three Bog Resin to clear the direct trail.';
  return s.claimed?(s.method==='reserve'?'Iva set aside '+s.reserved+' Small Healing Potions from the town reserve. I delivered the sealed medicine to the scouts. The shop must wait for its normal delivery to replace those bottles.':'Iva distilled the samples without drawing on the town reserve. Sylvi brought the withheld warning to the council with Iva’s findings. Her venom-for-medicine barter is now available in Brackenford.'):
   s.method==='reserve'?(s.delivered?'The medicine is delivered. Report to Iva or Sylvi at camp.':'With Sylvi, deliver Iva’s sealed medicine at the rendezvous on Redfen’s southwest approach. The bundle is recorded with this quest, not in the ordinary bag.'):'Defeat two Fen Stalkers with Sylvi and bring two Venom Glands to Iva. Distillation preserves the shop reserve and teaches a medicine barter.';
 }
 const questBefore=interactQuest;
 interactQuest=function(n){
  const id=n.questId;if(!ids.includes(id))return questBefore(n);
  const owner=townQuestState,origin=mapId,q=townQuestDefs[id];let s=owner[id];
  if(s&&!s.method)return questBefore(n);
  const contact=()=>mapId==='wayfarers_camp'||npcs.includes(n)&&n.questId===id&&close(n);
  const current=()=>owner===townQuestState&&mapId===origin&&bonded()&&contact()&&!journalPaused(id)&&(!q.requires||owner[q.requires]?.claimed);
  if(!bonded()||!contact()||journalPaused(id))return true;
  if(q.requires&&!owner[q.requires]?.claimed)return questBefore(n);
  if(!s){
   const methods=id==='bracken_patrol'?[['clear_route','Clear the direct trail'],['diversion','Cover the reed-route diversion']]:[['brew','Distill Fen Stalker samples'],['reserve','Set aside town medicine · '+reserveNeed()+' bottles']];
   openAdventureDialog(q.title,q.intro+'\n\n'+(id==='bracken_patrol'?'The direct trail needs three fresh defeats and three Bog Resin. Alternatively, burn three resin at the central signal and cover twelve active seconds while Sylvi guides the scouts through the reeds. The longer wet route will need four reserve medicine bottles rather than two in the next chapter. Neither route determines the fate of anyone beyond this scouting party.':'Gather two fresh Fen Stalker defeats and two Venom Glands, or ask Iva here in Brackenford to set aside '+reserveNeed()+' Small Healing Potions from the shared shop reserve, then deliver them in Redfen. Reserved bottles are unavailable to shoppers until the normal active-play delivery. Neither route requires spending crowns.'),methods.map(([method,label])=>({label,disabled:method==='reserve'&&mapId!=='brackenford',action:()=>{
    if(!current()||owner[id]||!journalCanAccept(id))return;
    if(method==='reserve'){
     if(mapId!=='brackenford')return;
     const stock=townStock('brackenford'),need=reserveNeed();
     if(stock.items.potion_25<need){say('Iva needs '+need+' bottles in the town reserve. Wait for the normal active-play delivery or choose distillation; no supplies were taken.');return;}
     stock.items.potion_25-=need;
     s=owner[id]={accepted:true,claimed:false,kills:0,method,reserved:need,delivered:false};
    }else s=owner[id]={accepted:true,claimed:false,kills:0,method,...(method==='diversion'?{signal:false,held:0}:{})};
    owner._tracking={id};commit();say(detail(id,s));
   }})));return true;
  }
  if(s.claimed){say(detail(id,s));return true;}
  if(!ready(id,s)){say(detail(id,s));return true;}
  openAdventureDialog(q.title+' · Return to the scouts',detail(id,s),[{label:'Finish this chapter with Sylvi',action:()=>{
   if(!current()||owner[id]!==s||s.claimed||!ready(id,s))return;
   if(['clear_route','brew'].includes(s.method)&&!removeItem(q.drop,q.dropTarget))return;
   s.claimed=true;player.coins+=q.coins;grantXp(q.xp);refreshTownRelics(true);commit();say(detail(id,s));
  }}]);return true;
 };
 const objectBefore=worldObjectInteract;
 worldObjectInteract=function(o){
  if(![signal.id,cache.id].includes(o.id))return objectBefore(o);
  const id=o.id===signal.id?'bracken_patrol':'bracken_herbs',owner=townQuestState,s=owner[id];
  const current=()=>owner===townQuestState&&owner[id]===s&&mapId==='redfen'&&close(o)&&bonded()&&!journalPaused(id)&&s?.accepted&&!s.claimed;
  if(!current())return true;
  if(o.id===signal.id){
   if(s.method!=='diversion'){say('Sylvi is clearing the direct trail; this signal is for the reed-route diversion.');return true;}
   if(s.signal){say(detail(id,s));return true;}
   openAdventureDialog('A warning finally sent','Sylvi points out the reed channel she once left off the council’s map. “I will guide them. Keep the resin burning here until they are past.” The count advances only while you and Sylvi remain nearby in active play.',[{label:'Burn three Bog Resin and cover the crossing',action:()=>{
    if(!current()||s.signal)return;
    if(!removeItem('bog_resin',3)){say('Bring three Bog Resin from Redfen’s Bog Slimes or Fen Stalkers.');return;}
    s.signal=true;s.held=0;commit();say(detail(id,s));
   }}]);return true;
  }
  if(s.method!=='reserve'){say('Iva is waiting for the Fen Stalker samples before preparing the scouts’ medicine.');return true;}
  if(s.delivered){say('The sealed medicine has already been delivered.');return true;}
  openAdventureDialog('Medicine at the rendezvous','Sylvi leaves Iva’s sealed medicine at the agreed collection point, together with the warning she should have sent before the scouts set out. The town reserve has already supplied this bundle.',[{label:'Deliver the sealed medicine',action:()=>{if(!current()||s.delivered)return;s.delivered=true;commit();say(detail(id,s));}}]);return true;
 };
 const companionUpdateBefore=updateCompanions;
 updateCompanions=function(dt){
  companionUpdateBefore(dt);
  const s=townQuestState.bracken_patrol;
  if(!Number.isFinite(dt)||dt<=0||!combatReady()||player.hp<=0||!bonded()||mapId!=='redfen'||!close(signal)||journalPaused('bracken_patrol')||s?.method!=='diversion'||!s.signal||s.claimed||s.held>=12)return;
  const old=s.held;s.held=Math.min(12,s.held+Math.min(dt,.25));
  if(Math.floor(old)!==Math.floor(s.held)){commit();if(s.held>=12)say('The scouts have passed the resin signal. Report to Tamsin or Sylvi at camp.');}
 };
 const barterBefore=barterOffers;
 barterOffers=function(town){const offers=barterBefore(town),s=townQuestState.bracken_herbs;if(town==='brackenford'&&s?.claimed&&s.method==='brew')offers.push({id:'iva_distillation',out:'potion_25',n:1,cost:{fen_venom:2},level:1});return offers;};
 const newsBefore=npcLocalNews;
 npcLocalNews=function(n){if(mapId==='brackenford'&&['Mayor Tamsin','Iva the Herbalist'].includes(n.name)){const medicine=townQuestState.bracken_herbs,route=townQuestState.bracken_patrol;if(medicine?.claimed&&medicine.method)return detail('bracken_herbs',medicine);if(route?.claimed&&route.method)return detail('bracken_patrol',route);}return newsBefore(n);};
 const guideBefore=questGuide;
 questGuide=function(q){const g=guideBefore(q),s=townQuestState[q.id];if(!ids.includes(q.id)||!s?.method)return g;return {...g,detail:detail(q.id,s),destination:s.claimed||ready(q.id,s)?'brackenford':'redfen',ready:!s.claimed&&ready(q.id,s),progress:s.claimed?'Complete':s.method==='diversion'?Math.floor(s.held||0)+'/12 active seconds':s.method==='reserve'?(s.delivered?'Delivered':'Sealed medicine reserved'):g.progress};};
 const catalogBefore=questCatalog;
 questCatalog=function(){return catalogBefore().map(q=>{const s=townQuestState[q.id];return ids.includes(q.id)&&s?.method?{...q,desc:detail(q.id,s)}:q;});};
 const drawBefore=drawWayfarerCamp;
 drawWayfarerCamp=function(){drawBefore();if(mapId!=='redfen')return;const s=townQuestState.bracken_patrol;standArt('barrel',signal.x,signal.y,32);standArt('crate',cache.x,cache.y,32);if(s?.signal&&!s.claimed&&s.held<12){ctx.strokeStyle='#a5d6cb88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(signal.x,signal.y,90,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f6a04d';ctx.beginPath();ctx.arc(signal.x,signal.y-23,8+Math.sin(animationClock*7)*2,0,Math.PI*2);ctx.fill();}if(close(signal))drawLocationLabel(signal.x,signal.y-52,s?.method==='diversion'?'SCOUT SIGNAL · '+Math.floor(s.held||0)+'/12s':'SCOUT SIGNAL SITE');if(close(cache))drawLocationLabel(cache.x,cache.y-45,'MEDICINE RENDEZVOUS');};
})();

// Early road decisions. Optional fields preserve every pre-overlay objective.
(() => {
 const near=(area,o)=>mapId===area&&Math.hypot(player.x-o.x,player.y-o.y)<100;
 const tablet={id:'camp_waymark',x:760,y:450,label:'PUBLIC ROADWARDEN MARK'};
 maps.wayfarers_camp.worldObjects.push(tablet);
 const markers=[[200,65],[500,45],[820,555]].map(([x,y],i)=>({id:'camp_patrol_marker_'+i,x,y,label:'ROAD MARKER '+(i+1),marker:i}));
 for(const o of markers){Object.assign(o,safeMapPosition('whisperwood',o.x,o.y,18));(maps.whisperwood.worldObjects||(maps.whisperwood.worldObjects=[])).push(o);}
 const oldCamp=campInteract;
 function callerChoice(s){
  const owner=townQuestState;
  openAdventureDialog('Two ways to follow the summons','Follow the departing footprints, or compare the crescent with the public roadwarden mark southeast of the board. The comparison may tell you what the seal cannot prove.',[
   ['tracks','Follow the footprints'],['seal','Compare the public waymark']
  ].map(([method,label])=>({label,action:()=>{if(owner!==townQuestState||s!==townQuestState._camp||s.claimed||s.method!=='pending'||journalPaused('camp_caller')||!near('wayfarers_camp',maps.wayfarers_camp.worldObjects.find(o=>o.id==='camp_letter')))return;s.method=method;campCommit();say(method==='seal'?'Inspect the public waymark southeast of the board, then report at the board.':'Examine the footprints beside the southern exit.');}})));
 }
 campInteract=function(o){
  if(o.id.startsWith('camp_patrol_marker_')){
   const s=townQuestState._campPatrol;
   if(!near('whisperwood',o)||!s?.accepted||s.method!=='repair'||journalPaused('camp_patrol'))return true;
   if(s.markers.includes(o.marker)){say('This marker is repaired for this patrol.');return true;}
   if(!removeItem('wood_log',1)){say('A replacement marker needs one Wood Log.');return true;}
   s.markers.push(o.marker);campCommit();say('Road marker repaired · '+s.markers.length+'/3. Return to the camp board when all three are sound.');return true;
  }
  const s=townQuestState._camp;
  if(s?.method&&!s.claimed&&journalPaused('camp_caller'))return true;
  if(o.id==='camp_waymark'){
   if(!near('wayfarers_camp',o)||!s||s.claimed||s.method!=='seal'||journalPaused('camp_caller'))return true;
   s.compared=true;campNote('public_seal','A public mark','The crescent is a public roadwarden waymark. Anyone could have copied it; it does not establish who wrote the summons. I should record this at the camp board.');campCommit();say('The crescent is a public waymark, not proof of the caller’s identity. Report at the board.');return true;
  }
  if(s&&!s.claimed&&o.id==='camp_board'&&s.method==='seal'){
   if(!near('wayfarers_camp',o)||journalPaused('camp_caller'))return true;
   if(!s.compared){say('Compare the public waymark southeast of this board first.');return true;}
   s.stage=3;s.claimed=true;player.coins+=20;grantXp(25);campNote('seal_report','A lead, not a signature','I recorded the public seal comparison. The message points through Ashvale to Briar Hollow, but its author remains unknown.');townQuestState._tracking={id:'briar_hollow'};campCommit();say('The Unknown Caller complete · 20 crowns · 25 XP. Follow the southern road into Ashvale, then north to Briar Hollow.');return true;
  }
  if(s&&!s.claimed&&o.id==='camp_tracks'&&s.method&&s.method!=='tracks'){say(s.method==='pending'?'Return to the letter and choose how to investigate.':'Compare the public waymark, then report at the board.');return true;}
  if(s&&!s.claimed&&o.id==='camp_letter'&&s.stage>=1){
   if(journalPaused('camp_caller')||!near('wayfarers_camp',o))return true;
   if(s.stage===1)s.method='pending';
   const result=oldCamp(o);if(s.method==='pending')callerChoice(s);return result;
  }
  return oldCamp(o);
 };
 const oldGuide=campGuide;
 campGuide=function(){const s=campState(),g=oldGuide();if(!s.claimed&&s.method==='pending')g.detail='Return to the letter and choose footprints or a public seal comparison.';if(!s.claimed&&s.method==='seal')g.detail=s.compared?'Record the comparison at the camp board.':'Inspect the public waymark southeast of the camp board.';return g;};
 const oldEntries=campQuestEntries;
 campQuestEntries=function(){const rows=oldEntries(),s=campState();for(const q of rows){if(q.id==='camp_caller'&&s.method==='seal')q.desc=s.claimed?'I compared the crescent with a public waymark. It cannot identify the caller. The message still leads to Briar Hollow.':campGuide().detail;if(q.id==='camp_patrol')q.desc=campPatrolGuide().detail;}return rows;};
 const oldPatrolGuide=campPatrolGuide;
 campPatrolGuide=function(){const s=townQuestState._campPatrol;if(!s?.accepted||s.method!=='repair')return oldPatrolGuide();const count=s.markers.length;return {destination:count===3?'wayfarers_camp':'whisperwood',detail:count===3?'Return to the camp board for payment.':'Repair three road markers in Whisperwood, at the northwest, north and southeast approaches. Each uses one Wood Log; fighting does not repair markers.',progress:count+'/3 markers · Patrols completed: '+s.completed,ready:count===3};};
 openCampBoard=function(){
  if(!campState().claimed){say('Follow the caller’s clues first.');return;}
  const owner=townQuestState,s=owner._campPatrol||(owner._campPatrol={completed:0,kills:0,accepted:false}),cycle=s.completed;
  const current=()=>owner===townQuestState&&s===owner._campPatrol&&cycle===s.completed&&near('wayfarers_camp',maps.wayfarers_camp.worldObjects.find(o=>o.id==='camp_board'))&&!journalPaused('camp_patrol');
  const accept=method=>{if(!current()||s.accepted||!journalCanAccept('camp_patrol'))return;s.accepted=true;s.kills=0;s.method=method;s.markers=[];townQuestState._tracking={id:'camp_patrol'};campCommit();say(campPatrolGuide().detail);};
  const ready=()=>s.method==='repair'?s.markers.length===3:s.kills>=3;
  const choices=!s.accepted?[{label:'Clear threats · defeat three creatures',action:()=>accept('clear')},{label:'Repair the road · three Wood Logs',action:()=>accept('repair')}]:[{label:ready()?'Collect patrol reward':'Track patrol',action:()=>{if(!current()||!s.accepted)return;if(ready()){const method=s.method;s.completed++;s.accepted=false;s.kills=0;player.coins+=20;grantXp(20);campNote('patrol_'+s.completed,'Road patrol '+s.completed,method==='repair'?'I replaced three road markers with timber. Travelers can read the route again; the creatures remain.':'I cleared threats along the Whisperwood road. The markers still need regular care.');}else townQuestState._tracking={id:'camp_patrol'};campCommit();}}];
  openAdventureDialog('Road Warden Board',campPatrolGuide().detail+'\n\nEach patrol pays 20 crowns and 20 XP. Choose again on your next patrol.',choices.concat({label:'Leave the board',action:()=>{}}));
 };
 const oldRegional=regionalInteract;
 regionalInteract=function(o){
  if(o.region!=='willowfen')return oldRegional(o);
  const owner=townQuestState,s=regionalState('willowfen'),current=()=>owner===townQuestState&&s===regionalState('willowfen')&&near('willowfen',o)&&!journalPaused('regional_willowfen');
  if(!current())return true;
  if(!s.accepted&&o.piece===undefined){
   openAdventureDialog('The Lost Lanterns','The marsh guide’s three lanterns have fallen from their posts. Recover them for the guide, or spend timber to rehang them where travelers need light. Both routes earn the guide’s usual reward. Rehanging uses three ordinary Wood Logs: chop them in Ashvale with a hatchet. Willowfen’s trees yield Hardwood Logs.',[['return','Return the lanterns to the guide'],['rehang','Rehang the lanterns · three Wood Logs']].map(([method,label])=>({label,action:()=>{if(!current()||s.accepted||s.claimed||!journalCanAccept('regional_willowfen'))return;s.accepted=true;s.method=method;s.found=[];s.progress=0;campCommit();say(method==='rehang'?'Chop three ordinary Wood Logs in Ashvale with a hatchet. Visit each marked lantern with one log, then report to the guide.':'Recover all three lanterns, then return to the guide.');}})));return true;
  }
  if(s.method==='rehang'&&o.piece!==undefined&&!s.claimed){
   if(s.found.includes(o.piece)){say('This lantern already lights its post.');return true;}
   if(!removeItem('wood_log',1)){say('Rehanging needs one ordinary Wood Log. Chop logs in Ashvale with a hatchet; Willowfen yields Hardwood Logs.');return true;}
   s.found.push(o.piece);campCommit();say('Lantern rehung · '+s.found.length+'/3. Report to the guide after the third.');return true;
  }
  if(s.claimed&&s.method==='rehang'){say('The guide tends the lights you rehung along the marsh route.');return true;}
  return oldRegional(o);
 };
 const oldCatalog=questCatalog;
 questCatalog=function(){const rows=oldCatalog(),s=townQuestState.regional_willowfen;if(s?.method)for(const q of rows)if(q.id==='regional_willowfen')q.desc=s.method==='rehang'?(s.claimed?'I rehung the guide’s three lanterns. Their lights remain along the marsh route.':'Chop three ordinary Wood Logs in Ashvale with a hatchet. Bring one to each marked lantern, rehang all three, then report to the guide.'):(s.claimed?'I returned the three lanterns to the guide. Their old posts remain dark.':q.desc);return rows;};
 const oldQuestGuide=questGuide;
 questGuide=function(q){const g=oldQuestGuide(q);if(q.id==='regional_willowfen'&&townQuestState.regional_willowfen?.method==='rehang')g.detail='Chop ordinary Wood Logs in Ashvale with a hatchet. Rehang each marked lantern with one log, then return to the guide after all three.';return g;};
 const oldDraw=drawWayfarerCamp;
 drawWayfarerCamp=function(){oldDraw();if(mapId==='wayfarers_camp'){standArt('crate',tablet.x,tablet.y,30);drawLocationLabel(tablet.x,tablet.y-34,'PUBLIC WAYMARK');}
  if(mapId==='whisperwood')for(const o of markers){ctx.fillStyle=townQuestState._campPatrol?.markers?.includes(o.marker)?'#e9c782':'#766c59';ctx.fillRect(o.x-3,o.y-20,6,24);ctx.fillRect(o.x-12,o.y-20,24,9);if(Math.hypot(player.x-o.x,player.y-o.y)<110)drawLocationLabel(o.x,o.y-35,o.label);}
  if(mapId==='willowfen'&&townQuestState.regional_willowfen?.method==='rehang')for(const o of maps.willowfen.worldObjects.filter(o=>o.piece!==undefined&&townQuestState.regional_willowfen.found.includes(o.piece))){drawMemoryLantern(o.x,o.y,true);drawLocationLabel(o.x,o.y-64,'GUIDE’S LIGHT');}
 };
})();

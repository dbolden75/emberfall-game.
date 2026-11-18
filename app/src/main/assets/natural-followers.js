/* Preview-only trailing behaviour. Runtime history only; no saved schema changes. */
let naturalFollowTarget;
(() => {
 'use strict';
 let trail=[], trailMap=null;
 const seed=()=>{
  const fx=player.faceX||0,fy=player.faceY||0,length=Math.hypot(fx,fy);
  const dx=length?fx/length:0,dy=length?fy/length:1;
  trail=[{x:player.x-dx*220,y:player.y-dy*220},{x:player.x,y:player.y}];
  trailMap=mapId;
 };
 const record=()=>{
  const last=trail[trail.length-1];
  if(trailMap!==mapId||!last||Math.hypot(player.x-last.x,player.y-last.y)>120){seed();return;}
  if(Math.hypot(player.x-last.x,player.y-last.y)<2)return;
  trail.push({x:player.x,y:player.y});
  let distance=0;
  for(let i=trail.length-1;i>0;i--){distance+=Math.hypot(trail[i].x-trail[i-1].x,trail[i].y-trail[i-1].y);if(distance>340){trail.splice(0,i-1);break;}}
 };
 const pointAt=distance=>{
  for(let i=trail.length-1;i>0;i--){const a=trail[i],b=trail[i-1],span=Math.hypot(b.x-a.x,b.y-a.y);if(span>=distance){const t=distance/(span||1);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}distance-=span;}
  return {...trail[0]};
 };
 naturalFollowTarget=(actor,index)=>{
  if(!trail.length||trailMap!==mapId)seed();
  const target=pointAt(76+index*58);
  // Settle rather than continuously shuffle into an exact formation slot.
  return Math.hypot(target.x-actor.x,target.y-actor.y)<10?{x:actor.x,y:actor.y}:target;
 };
 const previousUpdate=updateCompanions;
 updateCompanions=function(dt){record();return previousUpdate(dt);};
 const previousSnap=snapCompanionsToPlayer;
 snapCompanionsToPlayer=function(){
  seed();previousSnap();
  const active=activeCompanions();
  active.forEach((actor,index)=>{if(actor.hp<=0)return;const target=pointAt(76+index*58);Object.assign(actor,safeMapPosition(mapId,target.x,target.y,14,[player,...active.slice(0,index)]));});
 };
})();

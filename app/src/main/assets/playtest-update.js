/* Thornhaven 1.0.46: exploration and pet lifecycle playtest. */
(function(){
'use strict';
// The world atlas is open; local exploration is stored with each character.
paintExplorationFog=function(){const c=document.getElementById('thornhavenAtlasFog');if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);c.style.display='none';}};
const style=document.createElement('style');style.textContent='#thornhavenAtlasFog{display:none!important}button{transition:filter .12s,transform .12s}button:active{filter:brightness(1.2);transform:scale(.97)}@media(prefers-reduced-motion:reduce){button{transition:none}}#localAtlas{position:fixed;inset:0;background:#15241ff5;z-index:10000;color:#f3e1b7;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px}#localAtlas[hidden]{display:none}#localAtlas header{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#localAtlas button{padding:9px 14px}#localAtlas canvas{min-height:0;flex:1;width:100%;touch-action:none;background:#b1b58a}#localAtlas small{font:12px system-ui}';document.head.appendChild(style);
const panel=document.createElement('section');panel.id='localAtlas';panel.hidden=true;panel.innerHTML='<header><strong id="localAtlasTitle">Local map</strong><button id="localAtlasCenter">My location</button><button id="localAtlasOut">−</button><button id="localAtlasIn">+</button><button id="localAtlasClose">Return to game</button></header><canvas id="localAtlasCanvas"></canvas><small>Blue: you · Copper: discovered people · Red: nearby enemies · White: exits. Drag to pan. Pinch or use + / − to zoom.</small>';document.body.appendChild(panel);
const canvas=panel.querySelector('canvas'),g=canvas.getContext('2d');let zoom=1,panX=0,panY=0,lastMap='',lastSave=0,priorPause=false;
function fog(){const all=townQuestState._localExploration||(townQuestState._localExploration={});return all[mapId]||(all[mapId]={});}
window.localTerrainRevealed=(x,y)=>revealed(x,y);
function revealed(x,y){return !!fog()[Math.floor(x/64)+','+Math.floor(y/64)];}
window.revealLocalTerrain=()=>reveal();
function reveal(){if(!hasStarted||titleMenuActive)return;const f=fog(),cx=Math.floor(player.x/64),cy=Math.floor(player.y/64);let changed=false;for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(x*x+y*y<=9){const k=(cx+x)+','+(cy+y);if(!f[k]){f[k]=1;changed=true;}}if(changed&&Date.now()-lastSave>5000){lastSave=Date.now();saveGame();}}
function paint(){if(panel.hidden)return;const b=worldBounds(),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;canvas.width=w;canvas.height=h;const scale=Math.min(w/(b.maxX-b.minX),h/(b.maxY-b.minY))*zoom;g.fillStyle='#101e1b';g.fillRect(0,0,w,h);g.save();g.translate(w/2+panX,h/2+panY);g.scale(scale,scale);g.translate(-(b.minX+b.maxX)/2,-(b.minY+b.maxY)/2);g.fillStyle=({grass:'#839167',snow:'#c2d2d1',marsh:'#627b6d',stone:'#99998a',dungeon:'#66666b',wood:'#a38b69'})[regionSurface()]||'#839167';g.fillRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);
 // Use the same building and road coordinates as the playable region.
 g.fillStyle='#c9b48a';
 if(activeMap.town){for(const [x0,y0,x1,y1] of townPathRects(activeMap))g.fillRect(x0,y0,x1-x0,y1-y0);}
 else if(usesOpenWorld()){g.fillRect(b.minX,270,b.maxX-b.minX,105);for(const y of [-48,690])g.fillRect(b.minX,y,b.maxX-b.minX,34);for(const x of [-170,1110])g.fillRect(x,b.minY,34,b.maxY-b.minY);}
 if(activeMap.town){const used=new Set(activeMap.npcs.map(n=>n.frontage));used.add('classHome');const buildings=[...used].map(k=>townFrontages[k]).filter(Boolean);for(const [x,y,w,h] of townOutlyingHouses)buildings.push({x,y,w,h});
  for(const f of buildings){g.fillStyle='#776653';g.fillRect(f.x,f.y,f.w,f.h);g.strokeStyle='#ead7ac';g.lineWidth=1/scale;g.strokeRect(f.x,f.y,f.w,f.h);if(f.label&&revealed(f.x+f.w/2,f.y+f.h)){g.fillStyle='#fff1cf';g.font=(9/scale)+'px sans-serif';g.fillText(f.label,f.x,f.y+f.h/2);}}
 }
 const dot=(x,y,color,r=7)=>{g.fillStyle=color;g.beginPath();g.arc(x,y,r/scale,0,Math.PI*2);g.fill();};
 for(const t of activeMap.trees||[]){const x=Array.isArray(t)?t[0]:t.x,y=Array.isArray(t)?t[1]:t.y;g.fillStyle='#253d3544';g.beginPath();g.ellipse(x+5,y+5,17,10,0,0,Math.PI*2);g.fill();g.fillStyle=regionSurface()==='snow'?'#71928a':'#355f43';g.beginPath();g.moveTo(x,y-20);g.lineTo(x-15,y+9);g.lineTo(x+15,y+9);g.closePath();g.fill();g.fillStyle='#b3bc8844';g.beginPath();g.moveTo(x,y-17);g.lineTo(x-10,y+5);g.lineTo(x,y+5);g.closePath();g.fill();}
 for(const t of activeMap.stones||[]){const x=Array.isArray(t)?t[0]:t.x,y=Array.isArray(t)?t[1]:t.y;g.fillStyle='#555e59';g.beginPath();g.moveTo(x-11,y+6);g.lineTo(x-8,y-7);g.lineTo(x+4,y-12);g.lineTo(x+12,y);g.lineTo(x+8,y+8);g.closePath();g.fill();g.strokeStyle='#c7cbbb';g.lineWidth=1;g.stroke();}
 for(const n of [...(activeMap.npcs||[]),...(activeMap.worldObjects||[])])if(revealed(n.x,n.y)){dot(n.x,n.y,'#9e6039',4);g.fillStyle='#263124';g.font=(11/scale)+'px sans-serif';g.fillText(n.name||n.label||'',n.x+8/scale,n.y);}
 for(let y=Math.floor(b.minY/64);y<=Math.floor(b.maxY/64);y++)for(let x=Math.floor(b.minX/64);x<=Math.floor(b.maxX/64);x++)if(!fog()[x+','+y]){g.fillStyle='#10191ff2';g.fillRect(x*64,y*64,65,65);}
 for(const e of enemies)if(e.alive&&revealed(e.x,e.y)&&Math.hypot(e.x-player.x,e.y-player.y)<210)dot(e.x,e.y,'#d64c62',4);
 for(const e of mapConnections[mapId]?.exits||[]){let x=e.x,y=e.y;if(e.trigger==='edge'){x=e.side==='west'?b.minX+12:e.side==='east'?b.maxX-12:Math.max(b.minX+70,Math.min(b.maxX-70,480));y=e.side==='north'?b.minY+12:e.side==='south'?b.maxY-12:Math.max(b.minY+70,Math.min(b.maxY-70,315));}if(Number.isFinite(x)&&Number.isFinite(y)&&revealed(x,y)){dot(x,y,'#fff0ce',5);g.fillStyle='#fff0ce';g.font=(10/scale)+'px sans-serif';g.fillText('To '+(maps[e.to]?.name||'exit'),x+8/scale,y-8/scale);}}
 const quest=questCatalog().find(q=>q.id===trackedQuestId()&&!q.done);if(quest){const guide=questGuide(quest);if(guide.destination===mapId){for(const obj of activeMap.worldObjects||[])if((obj.id===quest.id||obj.questId===quest.id)&&revealed(obj.x,obj.y)){dot(obj.x,obj.y,'#ffd05c',7);}}}
 
 g.save();g.translate(player.x,player.y);g.rotate(Math.atan2(player.faceY||0,player.faceX||1));g.fillStyle='#67d7ff';g.beginPath();g.moveTo(11/scale,0);g.lineTo(-7/scale,-6/scale);g.lineTo(-4/scale,0);g.lineTo(-7/scale,6/scale);g.closePath();g.fill();g.restore();g.restore();document.getElementById('localAtlasTitle').textContent=activeMap.name;const q=questCatalog().find(q=>q.id===trackedQuestId()&&!q.done);panel.querySelector('small').textContent=q?'Tracking: '+q.title+' · '+questGuide(q).detail:'Blue: you · Copper: discovered people · Red: nearby enemies · Gold: discovered quest object · White: exits. Drag or pinch to explore.';
}
function center(){const b=worldBounds(),scale=Math.min(canvas.clientWidth/(b.maxX-b.minX),canvas.clientHeight/(b.maxY-b.minY))*zoom;panX=((b.minX+b.maxX)/2-player.x)*scale;panY=((b.minY+b.maxY)/2-player.y)*scale;paint();}
function open(){if(!hasStarted)return;panel.hidden=false;priorPause=!!window.jarvisPaused;window.jarvisPaused=true;attackHeld=false;zoom=1;panX=panY=0;reveal();paint();}
document.getElementById('localAtlasClose').onclick=()=>{panel.hidden=true;window.jarvisPaused=priorPause;saveGame();};document.getElementById('localAtlasCenter').onclick=center;
for(const [id,f] of [['localAtlasIn',1.3],['localAtlasOut',1/1.3]])document.getElementById(id).onclick=()=>{zoom=Math.max(.7,Math.min(5,zoom*f));paint();};
const pointers=new Map();canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});};canvas.onpointermove=e=>{const old=pointers.get(e.pointerId);if(!old)return;const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>5)zoom=Math.max(.7,Math.min(5,zoom*after/before));}else{panX+=e.clientX-old.x;panY+=e.clientY-old.y;}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});paint();};canvas.onpointerup=canvas.onpointercancel=e=>pointers.delete(e.pointerId);
const mapButton=document.createElement('button');mapButton.textContent='LOCAL MAP';mapButton.onclick=open;document.querySelector('.hud .stats').appendChild(mapButton);
// Free quest rewards are granted once. Replacement pets use earned crowns.
function claimed(){return townQuestState._petRewards||(townQuestState._petRewards={});}
const oldStarter=ensureStarterPet;ensureStarterPet=function(){if(!hasStarted||switchingCharacter)return;const c=claimed();for(const p of companions)c[p.id]=true;if(!c.dalen){oldStarter();c.dalen=true;}normalizePets();};
function cost(id){return claimed()[id]?Math.max(60,petDefs[id].cost):0;}
adoptPet=function(id){const d=petDefs[id];if(!hasStarted||!d||!petUnlocked(id)||companions.some(p=>p.id===id))return false;const price=cost(id);if(player.coins<price){renderParty('You need '+(price-player.coins)+' more crowns.');return false;}player.coins-=price;claimed()[id]=true;for(const p of companions)p.active=false;companions.push(makeCompanion(id));selectedCompanionId=id;snapCompanionsToPlayer();ui();saveGame();renderParty(d.name+' has joined you.');return true;};
petStory=function(id){const d=petDefs[id];if(!d)return;const owned=companions.some(p=>p.id===id),price=cost(id),choices=[];if(!owned&&petUnlocked(id))choices.push({label:price?'Replacement · '+price+' crowns':'Claim quest pet · Free',disabled:player.coins<price,action:()=>{openPartyScreen();adoptPet(id);}});choices.push({label:'Back to pets',action:openPartyScreen});openAdventureDialog(d.name,d.story+'\n\nFirst quest pet is free. If an earned pet dies, replacements cost '+Math.max(60,d.cost)+' earned crowns. Retreat dismisses your pet to safety.',choices);};
const oldRender=renderPetCollection;renderPetCollection=function(message=''){oldRender(message);for(const b of document.querySelectorAll('[data-pet-adopt]')){const id=b.dataset.petAdopt;if(petUnlocked(id)){b.disabled=player.coins<cost(id);b.textContent=cost(id)?'Replacement · '+cost(id)+' crowns':'Claim quest pet · Free';}}const foot=document.querySelector('#partyScreen .screenFoot span');if(foot)foot.textContent='First quest reward free · Earned pets die permanently · Replacements cost crowns.';};
const oldHit=enemyHit;enemyHit=function(victim,e){const pet=victim!==player&&!victim.human&&petDefs[victim.id];oldHit(victim,e);if(!pet)return;if(victim.hp<=0){claimed()[victim.id]=true;if(victim.purchasedWithRealMoney){victim.active=false;say(victim.name+' is recovering. Visit a healer.');}else{companions=companions.filter(p=>p!==victim);say(victim.name+' has died. A replacement is available at the Pet Sanctuary for '+cost(victim.id)+' crowns.');}saveGame();ui();}else if(victim.hp/victim.max<=.25&&!victim.lowHealthWarned){victim.lowHealthWarned=true;say(victim.name+' is badly hurt! Use PET RETREAT to keep them safe.');}};
const retreat=document.createElement('button');retreat.textContent='PET RETREAT';retreat.onclick=()=>{for(const p of companions)p.active=false;saveGame();ui();say('Your pet has retreated to safety.');};document.querySelector('.hud .stats').appendChild(retreat);
const oldDrawPet=drawPet;drawPet=function(p){oldDrawPet(p);ctx.save();ctx.fillStyle='#171d1e';ctx.fillRect(p.x-20,p.y-62,40,5);ctx.fillStyle=p.hp/p.max<.25?'#ef6262':'#9ac875';ctx.fillRect(p.x-20,p.y-62,40*Math.max(0,p.hp/p.max),5);ctx.restore();return true;};
// Preserve the existing directional gait; add restrained idle and attack motion.
const oldPose=petAnimationPose;petAnimationPose=function(p,t){const pose=oldPose(p,t);pose.sy=1+Math.sin(t*2.8)*.012*(1-pose.weight);pose.rotation=(p.faceX<0?-1:1)*pose.attack*.06;return pose;};
setInterval(()=>{reveal();if(lastMap!==mapId){lastMap=mapId;panX=panY=0;}paint();},250);
})();
// A consistent motion pass using the existing artwork and combat timing.
(function(){
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const baseStand=standArt;
 standArt=function(key,x,y,height,group='environment',opacity=1){
  if(reduced)return baseStand(key,x,y,height,group,opacity);
  const foliage=['oak','pine','bush'].includes(key),fire=['campfire','lamp'].includes(key);
  if(!foliage&&!fire)return baseStand(key,x,y,height,group,opacity);
  ctx.save();ctx.translate(x,y);if(foliage){ctx.transform(1,0,Math.sin(animationClock*1.4+x*.013)*.012,1,0,0);}else{const pulse=1+Math.sin(animationClock*7+x)*.018;ctx.scale(1,pulse);}
  const result=baseStand(key,0,0,height,group,opacity);ctx.restore();return result;
 };
 const baseMonster=drawDetailedMonster;
 drawDetailedMonster=function(e){if(reduced||!e.alive)return baseMonster(e);const anticipation=e.windup>0?Math.sin(Math.PI*(1-e.windup/(e.windupLength||1))):0,recovery=e.recoveryTime>0?Math.min(1,e.recoveryTime/.65):0,breathe=Math.sin(animationClock*2.2+(e.seed||0))*.008;
  ctx.save();ctx.translate(e.x,e.y);ctx.scale(1+anticipation*.025,1+breathe-anticipation*.035-recovery*.018);ctx.translate(-e.x,-e.y);const result=baseMonster(e);ctx.restore();return result;
 };
 const baseCombat=drawCombat;drawCombat=function(){baseCombat();ctx.save();for(const e of enemies){if(!e.alive||!(e.recoveryTime>0))continue;ctx.globalAlpha=Math.min(.7,e.recoveryTime*2);ctx.strokeStyle='#9bd0db';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+5,e.boss?27:19,6,0,Math.PI*2);ctx.stroke();}ctx.restore();};
 const css=document.createElement('style');css.textContent='@media(prefers-reduced-motion:no-preference){.screenPanel{animation:thornPanelIn .16s ease-out}@keyframes thornPanelIn{from{opacity:.3;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}}';document.head.appendChild(css);
})();

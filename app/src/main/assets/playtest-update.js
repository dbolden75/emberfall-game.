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
function reveal(){if(!hasStarted||titleMenuActive)return;const f=fog(),cx=Math.floor(player.x/64),cy=Math.floor(player.y/64);let changed=false;for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(x*x+y*y<=9){const k=(cx+x)+','+(cy+y);if(!f[k]){f[k]=1;changed=true;}}if(changed)window.localExplorationRevision=(window.localExplorationRevision||0)+1;if(changed&&Date.now()-lastSave>5000){lastSave=Date.now();saveGame();}}
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
 if(window.drawSoftExplorationFog)window.drawSoftExplorationFog(g,b);
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
 const baseCombat=drawCombat;drawCombat=function(){baseCombat();ctx.save();for(const e of enemies){if(!e.alive||!(e.recoveryTime>0))continue;ctx.globalAlpha=Math.min(.7,e.recoveryTime*2);ctx.strokeStyle='#9bd0db';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+5,e.boss?27:19,6,0,0,Math.PI*2);ctx.stroke();}ctx.restore();};
 const css=document.createElement('style');css.textContent='@media(prefers-reduced-motion:no-preference){.screenPanel{animation:thornPanelIn .16s ease-out}@keyframes thornPanelIn{from{opacity:.3;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}}';document.head.appendChild(css);
})();

/* THORNHAVEN_157_GEAR_BEGIN
 * Original Thornhaven 1.0.57 equipment addition.
 * Integrated into an existing boot-time script to keep the audited game HTML
 * byte-for-byte unchanged and retain its existing integrity checksum.
 * Six class/level-gated gear items become available at the four town forges.
 * The initial ring design was adapted to earrings because the current UI,
 * equip logic and save model support earrings but not a ring slot.
 * Bestiary entries below are data-only, NOT active combat encounters.
 */
(function installThornhaven157Gear(){
  'use strict';
  if(typeof itemDefs==='undefined'||typeof itemClassRules==='undefined'||
     typeof shopDefs==='undefined'||typeof GEAR_SLOTS==='undefined')
    return; // Isolated tests may evaluate playtest-update.js without shop/equipment globals.
  const newGear={
    copperfang_dagger:{name:'Copperfang Dagger',icon:'🗡️',category:'gear',slot:'weapon',bonus:2,price:95,sell:35,minLevel:3,description:'A serrated blade forged in Brackenford.'},
    marshwarden_spear:{name:'Marshwarden Spear',icon:'🔱',category:'gear',slot:'weapon',bonus:4,price:220,sell:90,minLevel:8,description:'Long-reaching spear of the southern marsh patrols.'},
    duskweave_robe:{name:'Duskweave Robe',icon:'🥋',category:'gear',slot:'armor',guard:3,price:130,sell:50,minLevel:5,description:'Light robes threaded with dusk-silk.'},
    ironbark_vest:{name:'Ironbark Vest',icon:'🦺',category:'gear',slot:'armor',guard:5,price:270,sell:105,minLevel:10,description:'Protective armor made from lacquered ironbark.'},
    lanternkeeper_amulet:{name:'Lanternkeeper Amulet',icon:'📿',category:'gear',slot:'necklace',guard:2,price:180,sell:70,minLevel:6,description:'A talisman carried by frontier sentries.'},
    emberstone_earrings:{name:'Emberstone Earrings',icon:'💎',category:'gear',slot:'earrings',bonus:2,price:210,sell:85,minLevel:9,description:'A pair of earrings set with volcanic glass.'}
  };
  const classes={
    copperfang_dagger:['rogue','warrior'],
    marshwarden_spear:['warrior','cleric'],
    duskweave_robe:['mage','cleric'],
    ironbark_vest:['warrior','rogue'],
    lanternkeeper_amulet:['mage','cleric','warrior','rogue'],
    emberstone_earrings:['mage','cleric','warrior','rogue']
  };
  const stock={
    ashvale_forge:['copperfang_dagger','ironbark_vest'],
    brackenford_forge:['copperfang_dagger','marshwarden_spear'],
    sunmere_forge:['duskweave_robe','lanternkeeper_amulet'],
    stonewatch_forge:['ironbark_vest','emberstone_earrings']
  };
  for(const [id,def] of Object.entries(newGear)){
    if(!GEAR_SLOTS.includes(def.slot))throw new Error('Unknown gear slot: '+id);
    if(itemDefs[id])throw new Error('Duplicate gear definition: '+id);
  }
  for(const [shopId,ids] of Object.entries(stock)){
    if(!shopDefs[shopId]||!Array.isArray(shopDefs[shopId].stock))
      throw new Error('Missing town forge: '+shopId);
    if(ids.some(id=>!newGear[id]))throw new Error('Unknown forge stock: '+shopId);
  }
  Object.assign(itemDefs,newGear);
  Object.assign(itemClassRules,classes);
  for(const [shopId,ids] of Object.entries(stock))
    shopDefs[shopId].stock=[...new Set([...shopDefs[shopId].stock,...ids])];
  window.THORNHAVEN_157_CONTENT={
    version:'1.0.57',items:Object.keys(newGear),
    plannedBestiary:[
      {id:'mire_wolf',name:'Mire Wolf',level:4,region:'Sunmere Marsh'},
      {id:'hollow_sentinel',name:'Hollow Sentinel',level:9,region:'Stonewatch Ruins'},
      {id:'bloodmoth',name:'Bloodmoth',level:13,region:'Vampire Frontier'},
      {id:'ashbound_knight',name:'Ashbound Knight',level:18,region:'Ashvale Outskirts'}
    ]
  };
})();
/* THORNHAVEN_157_GEAR_END */

/* Compact party portraits: keep secondary controls outside the vitality card. */
(function(){
 const stats=document.querySelector('.hud .stats');
 const row=document.createElement('div');row.id='partyPortraits';
 const hero=document.getElementById('heroMenuButton');row.appendChild(hero);
 const human=document.createElement('button');human.type='button';human.id='companionPortraitButton';
 human.innerHTML='<canvas width="100" height="120"></canvas><span>COMPANION</span>';
 human.onclick=()=>openHumanRoster();row.appendChild(human);
 const pet=document.getElementById('petStatusButton');row.appendChild(pet);
 const actions=document.createElement('div');actions.id='explorationActions';
 for(const button of [...stats.querySelectorAll('button')])actions.appendChild(button);
 stats.before(row);stats.after(actions);
 const css=document.createElement('style');css.textContent=`
 body:has(#gameView:not([hidden])) .shell .hudSide{width:204px}
 body:has(#gameView:not([hidden])) .shell .hudSide .stats{box-sizing:border-box;padding:6px 8px;min-height:0;width:100%;font:10px/1.4 system-ui}
 #partyPortraits{display:flex;gap:5px;margin-bottom:5px;pointer-events:auto}
 body:has(#gameView:not([hidden])) .shell #partyPortraits button{position:static;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;width:64px;height:72px;min-width:0;min-height:0;margin:0;padding:0;overflow:hidden;border:1px solid #b99d62;border-radius:5px;background:linear-gradient(#39463a,#17241e);color:#f0dca8;font:700 8px/12px system-ui}
 body .shell #partyPortraits canvas,body .shell #partyPortraits img{position:static;width:46px!important;height:54px!important;object-fit:contain;border:0}
 body .shell #partyPortraits span{height:auto;letter-spacing:0;font:700 8px/12px system-ui}
 #explorationActions{display:flex;gap:5px;margin-top:5px;pointer-events:auto}
 body .shell #explorationActions button{flex:1;min-width:0;min-height:44px;padding:4px;border:1px solid #8c794f;border-radius:5px;background:#202c23ed;color:#f0dca8;font:10px system-ui}
 @media(orientation:landscape) and (max-height:500px){body:has(#gameView:not([hidden])) .shell .hudSide{width:186px}body:has(#gameView:not([hidden])) .shell #partyPortraits button{height:58px}body .shell #partyPortraits canvas,body .shell #partyPortraits img{height:42px!important;width:34px!important}}
 /* In shallow landscape, the bottom joystick/attack strip covers the HUD's map and pet buttons.
    Center the HUD buttons in the open lane between the two handed control groups.
    Keep ≥44px-high controls and shrink their row on narrow landscape screens. */
 @media(orientation:landscape) and (max-height:380px){
  body:has(#gameView:not([hidden])) .shell #explorationActions{
   position:relative;left:calc(50vw - 10px);width:min(186px,calc(100vw - 328px));transform:translateX(-50%)
  }
 }
 `;document.head.appendChild(css);
 const previous=ui;let portraitKey='';
 ui=function(){previous();
  const c=humanCompanion(),a=c?classAppearance(c):null;
  human.setAttribute('aria-label',c?'Companion: '+c.name+' · '+c.hp+' / '+c.max+' vitality':'Choose a companion');
  const key=c?c.id+':'+c.class+':'+c.gender:'none';
  if(key!==portraitKey){const canvas=human.querySelector('canvas'),g=canvas.getContext('2d');g.clearRect(0,0,100,120);
   if(a&&a.atlas.complete&&a.atlas.naturalWidth){const [x,y,w,h]=a.frames[0],scale=Math.min(92/w,112/h);g.drawImage(a.atlas,x,y,w,h,(100-w*scale)/2,(120-h*scale)/2,w*scale,h*scale);portraitKey=key;}
   else if(!c){g.fillStyle='#c6b784';g.font='36px serif';g.textAlign='center';g.fillText('+',50,72);portraitKey=key;}
  }
  const p=companions.find(p=>p.active&&p.hp>0);pet.setAttribute('aria-label',p?'Pet: '+p.name+' · '+p.hp+' / '+p.max+' vitality':'Choose a pet');
  const petKey=p?p.id:'none';if(pet.dataset.portraitKey!==petKey||!pet.querySelector('span')){pet.dataset.portraitKey=petKey;pet.innerHTML=p?'<img src="assets/pets/'+petArtwork[p.id]+'-v2.webp" alt=""><span>PET</span>':'<span style="font-size:28px;line-height:42px">+</span><span>PET</span>';}
 };ui();
})();

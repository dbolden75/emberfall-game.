/* Regional exploration playtest 1.0.50. No monetization or combat-stat changes. */
(function(){
'use strict';
window.regionalPanelOpen=function(){
 return [...document.querySelectorAll('.screenPanel,[role="dialog"],dialog[open],#localAtlas')].some(p=>!p.hidden&&getComputedStyle(p).display!=='none'&&p.getClientRects().length>0);
};
window.regionalSpawnSafe=function(e){
 if(activeMap.town||activeMap.interior||mapId==='wayfarers_camp')return false;
 const x=e.spawnX??e.x,y=e.spawnY??e.y;
 if(Math.hypot(player.x-x,player.y-y)<220)return false;
 return [...(activeMap.npcs||[]),...(activeMap.worldObjects||[])].every(p=>Math.hypot(p.x-x,p.y-y)>150);
};
window.drawWalkingFog=function(){
 if(!hasStarted||titleMenuActive||!window.localTerrainRevealed)return;
 window.revealLocalTerrain();
 if(window.drawSoftExplorationFog)window.drawSoftExplorationFog(ctx,worldBounds());
};
// Hidden enemies must not leak through the fixed target HUD.
const targetPanel=drawTargetPanel;
drawTargetPanel=function(){const e=lockedEnemy?.alive?lockedEnemy:nearestCombatEnemy(210);if(e&&!window.localTerrainRevealed(e.x,e.y))return;targetPanel();};
// Foliage/fire animation already exists. Add fixed-position ripples at fishing water.
// Fixed, non-colliding ground detail: never changes roads or object placement.
const ground=drawTileField;
drawTileField=function(tx,ty,x0,y0,x1,y1,size=32){
 const result=ground(tx,ty,x0,y0,x1,y1,size);
 if(ty!==15||activeMap.interior)return result;
 ctx.save();const surface=regionSurface();ctx.fillStyle=surface==='snow'?'#f0f6ef33':surface==='marsh'?'#b9c38d22':'#d2c99a22';
 for(let y=y0+23;y<y1;y+=83)for(let x=x0+17;x<x1;x+=97){
  const k=Math.abs(Math.round(x*13+y*7));const px=x+k%29,py=y+k%17;
  if(Math.abs(py-322)<55)continue;
  ctx.fillRect(px,py,3,2);ctx.fillRect(px+8,py-4,2,3);
 }
 ctx.restore();return result;
};
const scenery=drawRegionalScenery;
drawRegionalScenery=function(){scenery();
 if(activeMap.town){ctx.save();ctx.strokeStyle='#c9b584';ctx.lineWidth=2;const used=new Set(activeMap.npcs.map(n=>n.frontage));used.add('classHome');for(const key of used){const f=townFrontages[key];if(!f)continue;const d=townDoor(f);ctx.fillStyle='#c9b58455';ctx.fillRect(d.x-14,d.y+3,28,18);ctx.strokeRect(d.x-14,d.y+3,28,18);}ctx.restore();}
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;ctx.save();ctx.strokeStyle='#c6e4dd';ctx.lineWidth=1;for(const [x,y] of fishingSpotCoords[mapId]||[]){for(let i=0;i<2;i++){const phase=(animationClock*.45+i*.5)%1;ctx.globalAlpha=(1-phase)*.35;ctx.beginPath();ctx.ellipse(x,y,8+phase*21,3+phase*7,0,0,Math.PI*2);ctx.stroke();}}ctx.restore();};
})();

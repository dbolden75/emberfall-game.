/* Append-only Elderwood activity manifest v1. No new narrative or reward rules.
 * Saved enemy/cooldown indices are stable: never reorder/remove manifest rows. */
(() => {
 'use strict';
 const id='elderwood',m=maps[id],terrain=window.wildernessSlice;
 const initialEnemyCount=m.enemies.length,initialGatherCount=m.gatherNodes.length;
 const trails=[
  [[-6400,-1700],[-6230,-1600]],
  [[-5400,2425],[-5750,2080],[-5630,1950]],
  [[-3400,-1200],[-2850,-2050],[-2650,-2150]],
  [[3800,-2400],[4100,-2250],[4250,-2070]],
  [[-3400,2700],[-2850,3000],[-2550,3320]],
  [[7000,-2900],[7100,-3350]]
 ];
 const clearings=[[-6230,-1600,130],[-5630,1950,130],[-2650,-2150,350],[4250,-2070,350],[-2550,3320,300],[7100,-3350,280]];
 for(const route of trails)terrain.addTrail(route);
 for(const [x,y,r] of clearings)terrain.reserveClearing(x,y,r);
 const resources=[
  ['west_fish','fishing',-6120,-1600],['lower_fish','fishing',-5580,1920],
  ['ridge_copper','mining',-2800,-2200,'copper_ore'],['ridge_iron','mining',-2650,-2250,'iron_ore'],['ridge_silver','mining',-2500,-2280,'silver_ore'],
  ['wood_1','woodcutting',4000,-1950],['wood_2','woodcutting',4150,-1900],['wood_3','woodcutting',4280,-1940],
  ['wetland_wood_1','woodcutting',-2600,3470],['wetland_wood_2','woodcutting',-2730,3350],['wetland_fish','fishing',-2090,3300],
  ['east_copper','mining',7000,-3450,'copper_ore'],['east_iron','mining',7150,-3390,'iron_ore']
 ];
 const encounters=[
  ['ridge_1','skeleton',-2600,-2020],['ridge_2','skeleton',-2450,-2150],
  ['wood_1','spider',4270,-2170],['wood_2','spider',4450,-2180],['wood_3','spider',4480,-1990],
  ['wetland_1','slime',-2410,3250],['wetland_2','slime',-2510,3430],
  ['east_1','skeleton',7270,-3440]
 ];
 for(const [key,skill,x,y,oreId] of resources){
  const node={id:'elderwood_v1_'+key,skill,x,y,readyAt:0};if(oreId)node.oreId=oreId;m.gatherNodes.push(node);
  if(skill==='woodcutting'){m.trees.push([x,y]);terrain.addObstacle(x,y,20);}
  if(skill==='mining'){m.stones.push([x,y]);terrain.addObstacle(x,y,14);}
 }
 const base=Math.max(2,regionCombatLevel(id)+1);
 for(const [i,[key,kind,x,y]] of encounters.entries()){
  if(mapPlacementBlocked(id,x,y,14))throw Error('Blocked Elderwood activity '+key);
  const enemy={wildernessId:'elderwood_v1_'+key,kind,name:monsterEcologies()[m.ecology].names[kind],ecology:m.ecology,x,y,spawnX:x,spawnY:y,baseHp:base,combatBaseHp:base,hp:base,maxHp:base,alive:true,lootClaimed:false,respawnAt:0,seed:18000+i};
  enemy.maxHp=enemy.hp=enemyMaxForLevel(enemy,regionCombatLevel(id));m.enemies.push(enemy);
 }
 const newEnemies=m.enemies.slice(initialEnemyCount),newResources=m.gatherNodes.slice(initialGatherCount);
 const defaults=newEnemies.map(e=>({...e}));
 function reset(){newEnemies.forEach((e,i)=>{for(const k of Object.keys(e))delete e[k];Object.assign(e,defaults[i]);e.maxHp=e.hp=enemyMaxForLevel(e,regionCombatLevel(id));});for(const n of newResources)n.readyAt=0;}
 function restoreTail(saved){
  newResources.forEach((n,i)=>{const value=saved?.gatherNodes?.[initialGatherCount+i];n.readyAt=Math.max(0,Number(value)||0);});
  newEnemies.forEach((enemy,i)=>{const e=saved?.enemies?.[initialEnemyCount+i];if(!e)return;const nextMax=enemyMaxForLevel(enemy,regionCombatLevel(id)),savedMax=Math.max(1,Number(e.maxHp)||enemy.baseHp||1),savedHp=Number(e.hp)||0;
   Object.assign(enemy,{x:Number.isFinite(e.x)?e.x:enemy.x,y:Number.isFinite(e.y)?e.y:enemy.y,spawnX:Number.isFinite(e.spawnX)?e.spawnX:enemy.spawnX,spawnY:Number.isFinite(e.spawnY)?e.spawnY:enemy.spawnY,maxHp:nextMax,hp:savedHp>0?Math.max(1,Math.ceil(savedHp/savedMax*nextMax)):0,alive:e.alive,lootClaimed:!!e.lootClaimed,respawnAt:e.respawnAt||0});
  });
 }
 // Initial core load preceded extension scripts. Restore only our appended tail;
 // never reapply the entire character (which can trigger historical rewards).
 const row=saveSlots[activeSlotId];restoreTail((row?.state||row)?.mapStates?.[id]);
 const previousLoad=applySavedGame;
 applySavedGame=function(save){if(save)reset();return previousLoad(save);};
 const oldScenery=drawExpandedWorldScenery;
 drawExpandedWorldScenery=function(){oldScenery();if(mapId!==id)return;for(const [x,y,r] of clearings){const a=mapToScreen(x-r,y-r),b=mapToScreen(x+r,y+r);if(b.x<0||a.x>viewW||b.y<0||a.y>viewH)continue;ctx.save();ctx.globalAlpha=.25;drawOrganicClearing(x-r*.5,y-r*.3,r,r*.6);ctx.restore();}};
 window.wildernessActivities={version:1,initialEnemyCount,initialGatherCount,resources:newResources,enemies:newEnemies,clearings,trails};
})();

'use strict';
// Switching characters must discard encounter-only dungeon guards, which the
// save serializer intentionally omits. A separate hero must not inherit them.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function boot(script) {
 const durable = {kind:'wolf',hp:12,alive:true,x:14};
 const summoned = {catalogSummoned:true,kind:'skeleton',hp:4,alive:true,x:51};
 const otherSummoned = {catalogSummoned:true,kind:'skeleton',hp:6,alive:true};
 const maps = {
  emberdeep:{enemies:[durable,summoned],town:false},
  ashvale:{enemies:[],town:true},
  greenhollow:{enemies:[otherSummoned],town:false}
 };
 const liveEnemies=maps.emberdeep.enemies;
 const ctx={maps,window:{},player:{x:5,y:5},enemies:liveEnemies,
  enemyPattern:()=>({}),monsterKey:()=>'',damageEnemy:()=>{},enemyHit:()=>{},
  enemyAttackDamage:()=>1,updateEnemyCombat:()=>{},finishEnemy:()=>{},
  scaleEnemiesForRegion:()=>{},enemyMaxForLevel:()=>20,regionCombatLevel:()=>1,
  applySavedGame(save){
   // The game loads persistent enemy snapshots by array index.
   save.mapStates.emberdeep.enemies.forEach((e,i)=>{
    if(maps.emberdeep.enemies[i])maps.emberdeep.enemies[i].hp=e.hp;
   });
  }
 };
 vm.runInNewContext(script,ctx,{filename:'monster-catalog.js'});
 const loaded={mapStates:{emberdeep:{enemies:[{hp:9}]}}};
 ctx.applySavedGame(loaded);
 assert.equal(durable.hp,9,'restored durable enemy state');
 assert.equal(maps.emberdeep.enemies.length,1,
  'ephemeral encounter from different character must be removed');
 assert.strictEqual(maps.emberdeep.enemies[0],durable,'durable enemy identity remains stable');
 assert.strictEqual(liveEnemies,maps.emberdeep.enemies,'active array reference is retained');
 assert.equal(maps.greenhollow.enemies.length,0,
  'summons in a previously visited region are also cleared');
 ctx.applySavedGame(loaded);
 assert.equal(maps.emberdeep.enemies.length,1,'repeated loads remain idempotent');
}
const script=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/monster-catalog.js'),'utf8');
boot(script);
console.log('PASS character switching clears temporary catalog summons without losing durable enemy state.');

/* Thornhaven original monster encounters. Existing game art; no third-party assets. */
(function(){
'use strict';
const catalog={
 briar_spider:{name:'Briar Spider',art:'spider',kind:'spider',hp:1,level:2,pattern:{label:'BRIAR WEB',range:135,radius:26,speed:66,windup:1,cool:2,ranged:true}},
 crypt_archer:{name:'Crypt Archer',art:'skeleton',kind:'skeleton',hp:1,level:4,pattern:{label:'BONE ARROW',range:195,radius:22,speed:52,windup:1.15,cool:1.8,ranged:true}},
 stone_guardian:{name:'Stone Guardian',art:'warden',kind:'warden',hp:2,level:5,pattern:{label:'STONE CRUSH',range:75,radius:48,speed:32,windup:1.5,cool:2.6}},
 marsh_stalker:{name:'Marsh Stalker',art:'bandit',kind:'bandit',hp:1.25,level:3,pattern:{label:'REED AMBUSH',range:75,radius:30,speed:90,windup:.9,cool:2}},
 vampire_hunter:{name:'Vampire Hunter',art:'specter',kind:'specter',hp:1.5,level:6,pattern:{label:'BLOOD SIPHON',range:85,radius:30,speed:75,windup:1,cool:2}},
 dungeon_lord:{name:'Dungeon Lord',art:'warden',kind:'warden',hp:3,level:8,pattern:{label:'CRYPT COMMAND',range:90,radius:52,speed:40,windup:1.4,cool:2.8}}
};
// Reuse ordinary encounter slots: preserve quest enemies, save indices and town safety.
for(const [area,key] of [['greenhollow','briar_spider'],['highmoor','crypt_archer'],['frostmarch','stone_guardian'],['redfen','marsh_stalker'],['elderwood','vampire_hunter'],['emberdeep','dungeon_lord']]){
 const m=maps[area];if(!m||m.town)continue;const e=m.enemies.find(e=>!e.boss&&!e.storyBoss&&!e.eventRegion&&!e.roamingElite&&e.wayfarerTrial===undefined&&!e.worldBandit&&!e.catalogType);if(!e)continue;const d=catalog[key];e.catalogType=key;e.name=d.name;e.kind=d.kind;e.ecology=null;e.combatLevel=Math.max(e.combatLevel||1,d.level);e.combatBaseHp=Math.max(3,e.combatBaseHp||e.baseHp||3)*d.hp;
}
const originalPattern=enemyPattern;enemyPattern=function(e){return catalog[e.catalogType]?.pattern||originalPattern(e)};
const originalMonsterKey=monsterKey;monsterKey=function(e){return catalog[e.catalogType]?.art||originalMonsterKey(e)};
const originalDamage=damageEnemy;damageEnemy=function(e,damage,stun=0,owner=player){return originalDamage(e,e.catalogType==='stone_guardian'?Math.max(1,damage*.7):damage,stun,owner)};
const originalHit=enemyHit;enemyHit=function(victim,e){const before=victim.hp,evaded=victim===player&&dodgeGuard>0;originalHit(victim,e);if(evaded||victim.hp>=before)return;const damage=before-victim.hp;
 if(e.catalogType==='briar_spider'&&victim===player){slowTimer=Math.max(slowTimer,2.2);combatText(player.x,player.y-40,'WEBBED','#b5d590');}
 if(e.catalogType==='vampire_hunter'){e.hp=Math.min(e.maxHp,e.hp+damage*.5);e.catalogRetreat=1.1;combatText(e.x,e.y-40,'DRAIN','#d6a1d1');}
};
const originalAttackDamage=enemyAttackDamage;enemyAttackDamage=function(e){const base=originalAttackDamage(e);return e.catalogType==='stone_guardian'?base*1.4:e.catalogType==='marsh_stalker'&&!e.catalogAmbushed?base*1.6:base};
const hitWithAbilities=enemyHit;enemyHit=function(victim,e){const before=victim.hp;hitWithAbilities(victim,e);if(victim.hp<before&&e.catalogType==='marsh_stalker')e.catalogAmbushed=true;};
const originalCombat=updateEnemyCombat;updateEnemyCombat=function(e,dt){if(e.catalogType==='vampire_hunter'&&e.catalogRetreat>0){e.catalogRetreat=Math.max(0,e.catalogRetreat-dt);steerActor(e,e.x+(e.x-player.x),e.y+(e.y-player.y),70,dt);return;}
 if(e.catalogType==='dungeon_lord'&&!e.catalogCalled&&e.hp<e.maxHp*.65&&Math.hypot(e.x-player.x,e.y-player.y)<230){e.catalogCalled=true;for(let i=enemies.length-1;i>=0;i--)if(enemies[i].catalogSummoned&&!enemies[i].alive)enemies.splice(i,1);for(const offset of [-55,55]){if(enemies.filter(n=>n.catalogSummoned&&n.alive).length>=2)break;const pos=safeMapPosition(mapId,e.x+offset,e.y+45,16);if(Math.hypot(pos.x-player.x,pos.y-player.y)<45)continue;enemies.push({kind:'skeleton',name:'Crypt Guard',catalogSummoned:true,x:pos.x,y:pos.y,spawnX:pos.x,spawnY:pos.y,hp:Math.max(12,e.maxHp*.15),maxHp:Math.max(12,e.maxHp*.15),baseHp:3,alive:true,seed:8000+offset,combatLevel:encounterLevel(e),boss:false,lootClaimed:true,combatCool:1.5});}combatText(e.x,e.y-55,'GUARDS!','#e6c387');}
 return originalCombat(e,dt);
};
const originalFinish=finishEnemy;finishEnemy=function(e,killerClass){if(e.catalogSummoned){e.alive=false;e.hp=0;e.deathAnim=.6;e.respawnAt=0;return;}return originalFinish(e,killerClass)};
window.ThornhavenMonsterCatalog=catalog;
scaleEnemiesForRegion();
})();

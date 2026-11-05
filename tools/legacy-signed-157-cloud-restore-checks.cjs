#!/usr/bin/env node
'use strict';
// The historical serializer below is copied verbatim from assets/index.html
// in the user's original maintained-key signed 1.0.57 APK.
// It contains no private signing material or user character data.
// Mocked JavaScript validation only; not an Android or Google Play upgrade test.
const vm=require('node:vm'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const core=require('../app/src/main/assets/cloud-save-core.js');
const legacySnapshotSource="function snapshotGameState(){const mapStates={};for(const id of Object.keys(maps)){const m=maps[id];mapStates[id]={enemies:m.enemies.map(e=>({x:e.x,y:e.y,spawnX:e.spawnX,spawnY:e.spawnY,hp:e.hp,maxHp:e.maxHp,alive:e.alive,lootClaimed:!!e.lootClaimed,respawnAt:e.respawnAt||0})),runes:(m.runes||[]).map(r=>r.on),runeProgress:Number(m.runeProgress)||0,traps:(m.traps||[]).map(t=>t.armed),chest:m.chest?{open:m.chest.open}:null,treasure:m.treasure?{opened:m.treasure.opened}:null,gatherNodes:(m.gatherNodes||[]).map(node=>Math.max(0,Number(node.readyAt)||0))}}const data={gatheringSkills,gearUpgradeLevels,player:{name:player.name,class:player.class,gender:player.gender,x:player.x,y:player.y,hp:player.hp,max:player.max,speed:player.speed,xp:player.xp,level:player.level,coins:player.coins,inventory:player.inventory,weapon:player.weapon,armor:player.armor,shield:player.shield,earrings:player.earrings,necklace:player.necklace,legs:player.legs,boots:player.boots},mapId,defeated,done,hasSigil,hasFourfoldKey,townRelicState,huntRewarded,shrineRewarded,deepQuestDone,houseBought:ownsHome('brackenford'),ownedHomes,townQuestState,houseStorage,companions,mapStates};return JSON.parse(JSON.stringify(data))}\n";
assert.equal(crypto.createHash('sha256').update(legacySnapshotSource).digest('hex'),
 'c627d1a855a0cf5b8038175ca1a0a61e1f714565ddd86a4b559496e7b6d8f861',
 'Historical 1.0.57 snapshot serializer must remain immutable');
function historicalState(name,heroClass,level,mapId){
 const scope={
  maps:{[mapId]:{enemies:[{x:2,y:4,spawnX:2,spawnY:4,hp:20,maxHp:20,alive:true,lootClaimed:false,respawnAt:0}],runes:[{on:false}],runeProgress:0,traps:[{armed:true}],chest:{open:false},treasure:{opened:false},gatherNodes:[{readyAt:0}]}},
  gatheringSkills:{mining:{xp:10,level:2},woodcutting:{xp:0,level:1},fishing:{xp:0,level:1}},
  gearUpgradeLevels:{},
  player:{name,class:heroClass,gender:'male',level,coins:100+level,xp:level*8,hp:30,max:30,x:12,y:15,
   inventory:[{id:'copper_ore',count:3}],weapon:null,armor:null,shield:null,earrings:null,necklace:null,legs:null,boots:null},
  mapId,defeated:1,done:false,hasSigil:false,hasFourfoldKey:false,townRelicState:{},
  huntRewarded:false,shrineRewarded:false,deepQuestDone:false,ownedHomes:{},
  townQuestState:{},houseStorage:{},companions:[],ownsHome:()=>false
 };
 vm.createContext(scope);
 vm.runInContext(legacySnapshotSource+';this.snapshot=snapshotGameState();',scope,{timeout:1500});
 return JSON.parse(JSON.stringify(scope.snapshot));
}
const row=(id,name,cls,level,mapId,updated)=>({
 id,name,class:cls,level,updated,state:historicalState(name,cls,level,mapId)
});
const slots={
 slot1:row('slot1','OldWarrior','warrior',4,'ashvale',123450),
 slot2:row('slot2','OldMage','mage',8,'sunmere',123451)
};
const backupText=core.encode(slots,'slot2',123456);
assert.deepEqual(core.parse(backupText).slots,slots);
class Storage{
 constructor(){this.memory=new Map()}
 getItem(k){return this.memory.has(k)?this.memory.get(k):null}
 setItem(k,v){this.memory.set(k,String(v))}
 removeItem(k){this.memory.delete(k)}
}
const store=new Storage();
core.restore(store,backupText,{confirmed:true,expectedCurrent:null});
assert.equal(store.getItem(core.ACTIVE_SLOT_KEY),'slot2');
assert.deepEqual(core.readLocal(store.getItem(core.SLOT_KEY)).slots,slots);
assert.equal(core.readLocal(store.getItem(core.SLOT_KEY)).unreadable,false);
for(const [id,mapId] of [['slot1','ashvale'],['slot2','sunmere']]){
 const state=JSON.parse(store.getItem(core.SLOT_KEY))[id].state;
 assert.equal(state.mapId,mapId);
 assert.equal(state.player.inventory[0].count,3);
 assert.equal(state.mapStates[mapId].enemies[0].hp,20);
 assert.equal(state.gatheringSkills.mining.level,2);
}
const newer=JSON.parse(backupText);
newer.createdAt+=100;
newer.slots.slot1.updated+=99;
newer.slots.slot1.state.player.coins+=99;
core.restore(store,JSON.stringify(newer),{
 confirmed:true,expectedCurrent:store.getItem(core.SLOT_KEY)
});
assert.deepEqual(core.parse(core.recoveryText(store)).slots,slots,
 'Recovery retains old historical characters after subsequent restore');
const incomplete=JSON.parse(backupText);delete incomplete.slots.slot1;
const current=store.getItem(core.SLOT_KEY);
assert.throws(()=>core.restore(store,JSON.stringify(incomplete),{
 confirmed:true,expectedCurrent:current
}),/older|omits/);
assert.equal(store.getItem(core.SLOT_KEY),current,
 'Missing character in older backup cannot erase current progress');
const corrupt=JSON.parse(backupText);
corrupt.slots.slot1.state.companions=[{id:'dalen',hp:200,max:20}];
assert.throws(()=>core.parse(JSON.stringify(corrupt)),/companion/i);
console.log('PASS: real signed 1.0.57 serializer snapshot -> current Cloud Save; two slots, active selection, progress, recovery, downgrade refusal, invalid pet rejection. Mocked JS, not Android/Play delivery.');

#!/usr/bin/env node
'use strict';
// Unknown mapStates keys are not visited by applySavedGame() or the next
// snapshotGameState(). Without this guard a restore "succeeds" then silently
// drops enemy, shrine, chest and gather progress for unknown regions.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const row=()=>({id:'slot1',updated:1000,name:'Map Keeper',class:'warrior',level:3,state:{
 player:{name:'Map Keeper',class:'warrior',level:3,xp:0,coins:4,inventory:[],hp:30,max:40,x:300,y:200,speed:3},
 mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[]}},townQuestState:{}}});
const data=r=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1000,activeSlot:'slot1',slots:{slot1:r}});
const initial=row(),oldRaw=JSON.stringify({slot1:initial});
let checks=0;
for(const id of ['unrecognized_new_region','region_gone','Ashvale']){
 const damaged=row();
 damaged.state.mapStates[id]={enemies:[{x:400,y:200,hp:20,maxHp:20,alive:true,lootClaimed:false,respawnAt:0}],chest:{open:true}};
 const backup=data(damaged);
 assert.throws(()=>core.parse(backup),/saved map|unknown map|region/i,'Unknown world-state region '+id);checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:damaged})).unreadable,true);checks++;
 const records=new Map([[core.SLOT_KEY,oldRaw],[core.ACTIVE_SLOT_KEY,'slot1'],[core.RECOVERY_KEY,'preserve-recovery']]);
 let writes=0;
 const storage={getItem:key=>records.get(key)??null,
  setItem:(key,value)=>{writes++;records.set(key,String(value));},
  removeItem:key=>{writes++;records.delete(key);}};
 assert.throws(()=>core.restore(storage,backup,{confirmed:true,allowOlder:true}),/saved map|unknown map|region/i);checks++;
 assert.equal(writes,0);checks++;
 assert.equal(records.get(core.SLOT_KEY),oldRaw);checks++;
 assert.equal(records.get(core.RECOVERY_KEY),'preserve-recovery');checks++;
}
// Missing/empty historical snapshots and real outdoor, home and dungeon
// regions must continue to round-trip without a save-format migration.
for(const variant of [
 {},
 {ashvale:{enemies:[]}},
 {ashvale:null},
 {ashvale:{enemies:[{x:400,y:200,hp:20,maxHp:20,alive:true,lootClaimed:false,respawnAt:0}]},brackenford:{enemies:[]}},
 {shrine_rootmaze:{runes:[false,true]},wayfarers_camp:{enemies:[]}},
 {embercrypt:{enemies:[]},tidevault:{enemies:[]},stormspire:{enemies:[]},hollowcrown:{enemies:[]},worldsend:{enemies:[]}},
]){
 const r=row();r.state.mapStates=variant;
 assert.doesNotThrow(()=>core.parse(data(r)),'Existing map snapshot remains valid');checks++;
 assert.equal(core.readLocal(JSON.stringify({slot1:r})).unreadable,false);checks++;
}
console.log('PASS: '+checks+' map-state safety, atomic-restore and compatibility assertions.');

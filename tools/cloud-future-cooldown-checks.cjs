#!/usr/bin/env node
'use strict';
// Cooldown dates far beyond any legitimate save strand gathering nodes or
// dead enemies because the game compares these values with Date.now().
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const validEnemy={x:20,y:25,hp:4,maxHp:8,respawnAt:0,alive:true,lootClaimed:false};
function backup(mapState){
 return {format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',
  slots:{slot1:{id:'slot1',name:'Timer QA',class:'warrior',level:1,updated:100,
   state:{mapId:'ashvale',player:{name:'Timer QA',class:'warrior',level:1,
    coins:0,xp:0,hp:5,max:10,speed:3,x:10,y:10,inventory:[]},
    companions:[],townQuestState:{},mapStates:{ashvale:mapState}}}}};
}
const unreasonable=Date.now()+12*366*24*60*60*1000;
for(const [label,snapshot] of [
 ['gathering node',{gatherNodes:[unreasonable],enemies:[validEnemy]}],
 ['enemy respawn',{gatherNodes:[0],enemies:[{...validEnemy,respawnAt:unreasonable}]}]
]){
 const b=backup(snapshot),text=JSON.stringify(b);
 assert.throws(()=>core.parse(text),/enemy/i,`${label} extreme future timer must be refused`);
 assert.equal(core.readLocal(JSON.stringify(b.slots)).unreadable,true,`${label} local slot must be unreadable`);
 const good=JSON.stringify(backup({gatherNodes:[0],enemies:[validEnemy]}).slots);
 const data=new Map([[core.SLOT_KEY,good],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:k=>data.get(k)??null,
  setItem:(k,v)=>{writes++;data.set(k,String(v));},
  removeItem:k=>{writes++;data.delete(k);}};
 assert.throws(()=>core.restore(storage,text,{confirmed:true,allowOlder:true}),/enemy/i);
 assert.equal(writes,0,`${label} rejected restore must perform no writes`);
 assert.equal(data.get(core.SLOT_KEY),good,`${label} local save must remain exact`);
}
const soon=Date.now()+60000;
for(const snapshot of [
 {gatherNodes:[0,soon],enemies:[{...validEnemy,respawnAt:soon}]},
 {enemies:[{x:20,y:25,hp:0,maxHp:8,alive:false,lootClaimed:true}]},
 {gatherNodes:[],enemies:[]},{}
])assert.doesNotThrow(()=>core.parse(JSON.stringify(backup(snapshot))));
console.log('PASS: impossible future gathering/respawn deadlines rejected atomically, valid and historical saves preserved');

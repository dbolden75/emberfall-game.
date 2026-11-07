#!/usr/bin/env node
'use strict';
// Extreme but finite movement speeds in a Cloud Save bypassed prior validation.
// The game uses restored speed directly for character motion and camera updates.
// Rejected backups must not overwrite a playable hero or their recovery data.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const baseline={id:'slot1',updated:123455,state:{
 player:{name:'Traveler',class:'rogue',level:4,coins:12,xp:7,x:400,y:400,
  hp:25,max:50,speed:235,inventory:[]},
 mapId:'ashvale',companions:[],mapStates:{ashvale:{enemies:[]}},townQuestState:{}
}};
function payload(speed){
 const slot=JSON.parse(JSON.stringify(baseline));
 if(speed===undefined)delete slot.state.player.speed;
 else slot.state.player.speed=speed;
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:123456,
  activeSlot:'slot1',slots:{slot1:slot}});
}
const original=JSON.stringify({slot1:baseline});
let assertions=0;
for(const speed of [2000.01,1e6,1e308]){
 const value=payload(speed);
 assert.throws(()=>core.parse(value),/Invalid character health, movement or position/);assertions++;
 assert.equal(core.readLocal(JSON.stringify(JSON.parse(value).slots)).unreadable,true);assertions++;
 const memory=new Map([[core.SLOT_KEY,original],[core.RECOVERY_KEY,'existing recovery']]);
 let writes=0;
 const storage={getItem:key=>memory.get(key)??null,
  setItem:(key,val)=>{writes++;memory.set(key,val)},
  removeItem:key=>{writes++;memory.delete(key)}};
 assert.throws(()=>core.restore(storage,value,{confirmed:true,allowOlder:true}),
  /Invalid character health, movement or position/);assertions++;
 assert.equal(writes,0,'Rejected backup must make no storage writes');assertions++;
 assert.equal(memory.get(core.SLOT_KEY),original);assertions++;
 assert.equal(memory.get(core.RECOVERY_KEY),'existing recovery');assertions++;
}
for(const speed of [undefined,190,235,270,2000]){
 const value=payload(speed);
 assert.doesNotThrow(()=>core.parse(value));assertions++;
 assert.equal(core.readLocal(JSON.stringify(JSON.parse(value).slots)).unreadable,false);assertions++;
}
console.log('PASS '+assertions+' extreme-speed Cloud Save and no-write assertions');

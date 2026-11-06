const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
function backup(xp,level=1){
 const player={name:'Save QA',class:'warrior',level,coins:12,inventory:[]};
 if(xp!==undefined)player.xp=xp;
 const row={id:'slot1',name:'Save QA',class:'warrior',level,updated:1,
  state:{player,mapId:'ashvale',companions:[],mapStates:{},townQuestState:{}}};
 return JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1,
  activeSlot:'slot1',slots:{slot1:row}});
}
// A finite 1e308 XP field passes primitive Number.isFinite checks but would
// cause grantXp()'s synchronous per-level while loop to freeze gameplay.
for(const xp of [1e308,1e100,1e12]){
 assert.throws(()=>core.parse(backup(xp)),/Invalid character experience/,`Reject impossible experience ${xp}`);
}
for(const [xp,level] of [[0,1],[5.5,1],[39,1],[100,5],[1000000,1000],[undefined,1],[null,1]]){
 assert.doesNotThrow(()=>core.parse(backup(xp,level)),`Accept valid/legacy XP ${xp} at level ${level}`);
}
// A rejected backup must not even attempt localStorage writes.
let writes=0;
const storage={getItem:()=>null,setItem:()=>writes++,removeItem:()=>writes++};
assert.throws(()=>core.restore(storage,backup(1e308),{confirmed:true}),/Invalid character experience/);
assert.equal(writes,0);
console.log('PASS: 3 impossible XP records rejected; 7 legitimate/historical XP records accepted; failed restore left storage untouched');

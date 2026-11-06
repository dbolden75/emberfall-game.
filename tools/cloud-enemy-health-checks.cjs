'use strict';
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
function backup(enemy){
 return {
  format:'thornhaven-save',schema:1,createdAt:100,activeSlot:'slot1',
  slots:{slot1:{id:'slot1',name:'Restore QA',class:'warrior',level:1,updated:100,
   state:{mapId:'whisperwood',player:{name:'Restore QA',class:'warrior',level:1,
    coins:0,xp:0,hp:5,max:10,speed:3,x:10,y:10,inventory:[]},
    companions:[],townQuestState:{},mapStates:{whisperwood:{enemies:[enemy]}}}}}
 };
}
function permitted(enemy){assert.doesNotThrow(()=>core.parse(JSON.stringify(backup(enemy))));}
function refused(enemy){assert.throws(()=>core.parse(JSON.stringify(backup(enemy))),/enemy/i);}
// Region combat HP is scaled using savedHp / savedMax. Corrupt ratios above
// 1 would create monsters stronger than intended when restoring a character.
refused({hp:51,maxHp:50,alive:true});
refused({hp:10000,maxHp:5,alive:true});
refused({hp:10,maxHp:0,alive:true});
permitted({hp:20,maxHp:50,alive:true});
permitted({hp:0,maxHp:50,alive:false});
permitted({hp:0,maxHp:0,alive:false});
permitted({hp:20,alive:true}); // historical snapshots missing a maximum
permitted({maxHp:50,alive:true}); // historical snapshots missing current HP
// Rejection must happen before a single local save or recovery write.
const data=new Map([[core.SLOT_KEY,JSON.stringify(backup({hp:2,maxHp:10}).slots)]]);
let writes=0;
const storage={getItem:k=>data.has(k)?data.get(k):null,
 setItem:(k,v)=>{writes++;data.set(k,String(v));},
 removeItem:k=>{writes++;data.delete(k);}};
const pre=data.get(core.SLOT_KEY);
assert.throws(()=>core.restore(storage,JSON.stringify(backup({hp:51,maxHp:50,alive:true})),{confirmed:true,allowOlder:true}),/enemy/i);
assert.equal(writes,0);
assert.equal(data.get(core.SLOT_KEY),pre);
console.log('PASS: corrupt enemy max-health ratios are refused before save writes; valid/legacy snapshots work');

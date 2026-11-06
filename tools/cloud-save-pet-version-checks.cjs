#!/usr/bin/env node
'use strict';
// Regression against the production Cloud Save core. Unsupported pet versions
// must not trigger normalizePets()'s legacy equipment refund/migration.
const assert=require('node:assert/strict');
const core=require('../app/src/main/assets/cloud-save-core.js');
const row=pet=>({id:'slot1',updated:1234,name:'Hero',class:'warrior',level:4,state:{
 player:{name:'Hero',class:'warrior',level:4,coins:40,xp:10,hp:50,max:50,speed:3,x:300,y:200,inventory:[]},
 mapId:'ashvale',companions:[pet],mapStates:{},townQuestState:{}}});
const backup=pet=>JSON.stringify({format:'thornhaven-save',schema:1,createdAt:1234,activeSlot:'slot1',slots:{slot1:row(pet)}});
const pet={id:'dalen',petVersion:1,hp:10,max:20,active:true,weapon:null,armor:null,shield:null,earrings:null,necklace:null,legs:null,boots:null};
const invalid=[
 ['text version',{...pet,petVersion:'1'}],
 ['unsupported newer version with gear',{...pet,petVersion:2,weapon:'short_sword'}],
 ['negative version',{...pet,petVersion:-1}],
 ['boolean version',{...pet,petVersion:false}],
 ['object gear',{...pet,petVersion:0,weapon:{id:'short_sword'}}],
 ['array gear',{...pet,petVersion:1,boots:['short_sword']}],
 ['numeric gear',{...pet,petVersion:0,necklace:1}]
];
for(const [name,bad] of invalid){
 const input=backup(bad);
 assert.throws(()=>core.parse(input),/companion|pet/i,'reject '+name);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(bad)})).unreadable,true,name);
 const raw=JSON.stringify({slot1:row(pet)});
 const values=new Map([[core.SLOT_KEY,raw],[core.ACTIVE_SLOT_KEY,'slot1']]);
 let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem:(key,v)=>{writes++;values.set(key,String(v));},
  removeItem:key=>{writes++;values.delete(key)}};
 assert.throws(()=>core.restore(storage,input,{confirmed:true,allowOlder:true}),/companion|pet/i,name);
 assert.equal(writes,0,'Must not overwrite character on '+name);
 assert.equal(values.get(core.SLOT_KEY),raw);
}
const valid=[
 ['current',pet],
 ['historical missing version',Object.fromEntries(Object.entries(pet).filter(([key])=>key!=='petVersion'))],
 ['legacy version 0',{...pet,petVersion:0,weapon:'short_sword'}],
 ['historical no equipment',{id:'dalen',hp:0,max:0,active:false}],
 ['other known pet',{...pet,id:'ember_dragon'}]
];
for(const [name,good] of valid){
 assert.doesNotThrow(()=>core.parse(backup(good)),name);
 assert.equal(core.readLocal(JSON.stringify({slot1:row(good)})).unreadable,false,name);
}
console.log('PASS: seven invalid pet version/equipment imports rejected with zero storage writes; five current/legacy snapshots preserved.');

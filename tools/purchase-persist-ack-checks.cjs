#!/usr/bin/env node
'use strict';
// Execute the reconstructed production WebView purchase transaction.
// This injects storage failures; it does not simulate actual Google Play payment.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const start=html.indexOf('function purchaseCommit(next)');
const end=html.indexOf('function ensurePurchaseProfile()',start);
assert(start>=0&&end>start,'Generated purchaseCommit must be present');
const source=html.slice(start,end);
let checks=0;
function scenario(mode='ok'){
 const profile='a'.repeat(64),receipt='b'.repeat(64),sku='emberfall_aura_embers';
 const state={player:{name:'Ava',class:'warrior',level:10},townQuestState:{_purchaseProfile:profile,
   _playReceipts:{[receipt]:sku},_paidStyles:{[sku]:true}}};
 const original={slot1:{id:'slot1',name:'Ava',state:{player:{level:9},townQuestState:{_purchaseProfile:profile}}}};
 const store=new Map([['emberfall_character_slots_v1',JSON.stringify(original)],['emberfall_active_character_slot_v1','slot1']]);
 const acknowledgements=[];let updates=0;
 const c={SAVE_SLOTS_KEY:'emberfall_character_slots_v1', SAVE_KEY:'emberfall_singleplayer_v1',
    ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',activeSlotId:'slot1',saveSlots:structuredClone(original),
    townQuestState:{unchanged:true},player:{level:9},
    syncHeroStats(){updates++},normalizePets(){},scaleEnemiesForRegion(){},
    localStorage:{getItem(k){return store.has(k)?store.get(k):null},
      setItem(k,v){if(k===c.SAVE_SLOTS_KEY&&mode==='throw')throw new Error('QuotaExceededError');
        if(k===c.SAVE_SLOTS_KEY&&mode==='silent')return;
        if(k===c.SAVE_KEY&&mode==='legacy')throw new Error('Legacy mirror unavailable');
        if(k===c.ACTIVE_SLOT_KEY&&mode==='preference')throw new Error('Preference unavailable');
        store.set(k,String(v));}},Date:{now:()=>123},console:{warn(){}}
 };
 vm.createContext(c);vm.runInContext(source,c,{timeout:1000});
 let error=null;
 try{vm.runInContext('purchaseCommit('+JSON.stringify(state)+')',c,{timeout:1000});acknowledgements.push(receipt)}
 catch(e){error=String(e.message||e)}
 return {c,state,original,store,updates,error,acknowledgements};
}
for(const mode of ['ok','legacy','preference']){
 const r=scenario(mode);assert.equal(r.error,null,mode);
 assert.equal(r.acknowledgements.length,1,mode+' must acknowledge durable delivery');
 const onDisk=JSON.parse(r.store.get('emberfall_character_slots_v1'));
 assert.equal(onDisk.slot1.state.townQuestState._playReceipts['b'.repeat(64)],'emberfall_aura_embers');
 assert.equal(onDisk.slot1.state.townQuestState._paidStyles.emberfall_aura_embers,true);
 assert.equal(r.c.townQuestState._paidStyles.emberfall_aura_embers,true);
 checks++;
}
for(const mode of ['throw','silent']){
 const r=scenario(mode);
 assert(r.error,mode+' must refuse a non-durable purchase');
 assert.equal(r.acknowledgements.length,0,mode+' must NOT acknowledge a non-durable delivery');
 assert.equal(JSON.parse(r.store.get('emberfall_character_slots_v1')).slot1.state.player.level,9);
 assert.equal(r.c.saveSlots.slot1.state.player.level,9,'do not mutate live slot cache');
 assert.equal(r.c.player.level,9,'do not apply uncommitted reward');
 assert.equal(r.updates,0,'do not update hero UI before receipt persisted');
 checks++;
}
console.log('PASS: '+checks+' purchase persistence/acknowledgment scenarios (including silent WebView storage refusal).');

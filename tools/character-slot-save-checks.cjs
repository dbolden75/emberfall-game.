'use strict';
// Exercise the actual generated character switch code with isolated storage
// mocks. No real user saves or Android signing material are accessed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
const start=html.indexOf('function confirmSaveBeforeSlotSwitch(){');
const end=html.indexOf('function deleteSaveSlot(id)',start);
assert(start>=0&&end>start,'Release HTML must have the guarded save-slot switch');
const implementation=html.slice(start,end);
assert(implementation.includes('function selectSaveSlot(id)'), 'Test real game slot switching');

function scenario(mode, requested='slot2', started=true){
 const previous={slot1:{id:'slot1',state:{coins:1}},slot2:{id:'slot2',state:{coins:50}}};
 const storage=new Map([
  ['emberfall_character_slots_v1',JSON.stringify(previous)],
  ['emberfall_active_character_slot_v1','slot1']
 ]);
 const alerts=[],switched=[];
 const nodes=new Map(['characterSetup','gameView','controlRow','characterName'].map(id=>[id,{hidden:false,value:'',setCustomValidity(){}}]));
 const c={
  SAVE_SLOT_IDS:['slot1','slot2','slot3','slot4'],
  SAVE_SLOTS_KEY:'emberfall_character_slots_v1',
  ACTIVE_SLOT_KEY:'emberfall_active_character_slot_v1',
  activeSlotId:'slot1',switchingCharacter:false,titleMenuActive:!started,hasStarted:started,
  saveSlots:structuredClone(previous),saveFilesReturnToGame:false,
  freshCharacterState:{coins:0},player:{name:'Ava',cool:0,attack:0},
  activeMap:{name:'Ashvale'},keys:{clear(){}},attackHeld:false,
  saveFilesScreen:{hidden:false},
  localStorage:{
   getItem(k){return storage.has(k)?storage.get(k):null;},
   setItem(k,v){
    if(k==='emberfall_character_slots_v1'&&mode==='quota')throw Error('QuotaExceededError');
    if(k==='emberfall_character_slots_v1'&&mode==='silent')return;
    storage.set(k,String(v));
   }
  },
  snapshotGameState(){return {coins:30};},
  saveGame(){
   if(!c.hasStarted||c.titleMenuActive||c.switchingCharacter)return;
   const next={...c.saveSlots,[c.activeSlotId]:{id:c.activeSlotId,state:c.snapshotGameState()}};
   try{c.localStorage.setItem(c.SAVE_SLOTS_KEY,JSON.stringify(next));c.saveSlots=next;}
   catch(_){/* game catches quota errors and reports them through UI */}
  },
  applySavedGame(row){switched.push(row);},
  preparePanel(){},refreshPanelState(){},ui(){},
  document:{getElementById(id){return nodes.get(id)||{hidden:false,value:''};}},
  closePanel(id){alerts.push('closed:'+id);},
  say(msg){alerts.push(msg);}
 };
 vm.createContext(c);
 vm.runInContext(implementation,c,{timeout:1000});
 vm.runInContext('selectSaveSlot('+JSON.stringify(requested)+')',c,{timeout:1000});
 return {c,alerts,switched,storage};
}
for(const mode of ['quota','silent']){
 const r=scenario(mode);
 assert.equal(r.c.activeSlotId,'slot1','Failed '+mode+' save must retain selected character');
 assert.equal(r.switched.length,0,'Failed '+mode+' save must not load another character');
 assert.equal(r.storage.get('emberfall_active_character_slot_v1'),'slot1');
 assert(r.alerts.some(x=>x.includes('could not be saved')),'Failed '+mode+' save must warn');
}
{
 const r=scenario('ok');
 assert.equal(r.c.activeSlotId,'slot2','Successful save allows switching');
 assert.equal(r.storage.get('emberfall_active_character_slot_v1'),'slot2');
 assert.equal(JSON.parse(r.storage.get('emberfall_character_slots_v1')).slot1.state.coins,30);
 assert.equal(r.switched.length,1);
}
{
 const r=scenario('ok','slot1');
 assert.equal(r.c.activeSlotId,'slot1');
 assert(r.alerts.includes('closed:saveFilesScreen'),'Same-slot selection closes menu');
}
{
 const r=scenario('ok','slot2',false);
 assert.equal(r.c.activeSlotId,'slot2','A new character can be selected at start');
}
console.log('PASS: five real HTML character-switch cases: quota, silent storage, success, same slot, fresh start.');

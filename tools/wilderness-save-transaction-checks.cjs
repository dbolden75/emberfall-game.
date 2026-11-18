// Exercise actual prepared-snapshot save and guard, with storage fault injection.
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8'),api=fs.readFileSync('app/src/main/assets/purchase-api.js','utf8');
const code=html.slice(html.indexOf('function saveGame(){'),html.indexOf('function applyDanCompanionGear('))+api.slice(api.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_START */'),api.indexOf('/* THORNHAVEN_SAVE_DURABILITY_GUARD_END */'));
const S='emberfall_character_slots_v1',L='emberfall_singleplayer_v1',A='emberfall_active_character_slot_v1';
for(const mode of ['ok','quota','drop','alter-inactive','read-error','mirror-error']){
 const live={player:{name:'Prepared',class:'warrior',level:1,xp:0,coins:10,inventory:[]},mapId:'elderwood',townQuestState:{_localExploration:{elderwood:{}}}};
 for(let i=0;i<36000;i++)live.townQuestState._localExploration.elderwood[(i%240)+','+Math.floor(i/240)]=1;
 const prior={...structuredClone(live),player:{...live.player,coins:5}};
 const slots={slot1:{id:'slot1',state:prior},slot2:{id:'slot2',state:structuredClone(prior)}};
 const disk=new Map([[S,JSON.stringify(slots)],[L,JSON.stringify(prior)]]),original=disk.get(S),nodes=new Map(),writes=[];let behavior=mode,snapshots=0,committed=false;
 const document={getElementById:id=>nodes.get(id)||null,createElement:()=>({style:{},setAttribute(){},remove(){nodes.delete(this.id);}}),body:{appendChild:e=>nodes.set(e.id,e)}};
 const root={window:{},hasStarted:true,titleMenuActive:false,switchingCharacter:false,activeSlotId:'slot1',SAVE_SLOTS_KEY:S,SAVE_KEY:L,ACTIVE_SLOT_KEY:A,player:live.player,saveSlots:structuredClone(slots),snapshotGameState:()=>{snapshots++;return structuredClone(live);},document,console:{error(){},warn(){}},Date,JSON,
 localStorage:{getItem(k){if(behavior==='read-error'&&committed&&k===S)throw Error('interrupted read');return disk.get(k)??null;},setItem(k,v){writes.push(k);if(behavior==='quota'&&k===S)throw Error('quota');if(behavior==='drop'&&k===S)return;if(behavior==='mirror-error'&&k===L)throw Error('mirror quota');if(behavior==='alter-inactive'&&k===S){const parsed=JSON.parse(v);parsed.slot2.state.player.coins=777;v=JSON.stringify(parsed);}disk.set(k,String(v));if(k===S)committed=true;}}};
 vm.createContext(root);vm.runInContext(code,root);root.saveGame();assert.equal(snapshots,1,mode+': exactly one snapshot');
 const success=['ok','mirror-error'].includes(mode);assert.equal(nodes.has('saveFailureWarning'),!success,mode+': durability warning');
 if(success){assert.equal(JSON.parse(disk.get(S)).slot1.state.player.coins,10);assert.equal(JSON.parse(disk.get(S)).slot2.state.player.coins,5);assert.equal(root.saveSlots.slot1.state.player.coins,10);}
 else{assert.equal(root.saveSlots.slot1.state.player.coins,5,'unverified commit must not publish cache');assert.deepEqual(writes,[S],'failed primary must not write mirror/pref');if(['quota','drop'].includes(mode))assert.equal(disk.get(S),original);}
 behavior='ok';committed=false;root.saveGame();assert.equal(snapshots,2);assert(!nodes.has('saveFailureWarning'),'retry clears warning');assert.equal(JSON.parse(disk.get(S)).slot1.state.player.coins,10);
 root.activeSlotId='slot2';live.player.coins=12;root.saveGame();const switched=JSON.parse(disk.get(S));assert.equal(switched.slot1.state.player.coins,10);assert.equal(switched.slot2.state.player.coins,12,'slot-specific immediate checkpoint');
}
console.log('PASS: one prepared snapshot; 36k-cell synchronous atomic save; quota/drop/altered inactive bytes/read interruption/mirror faults; cache publication, retry and two-slot isolation');

// Verify local save/purchase durability guards preserve old equipped hero gear.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/purchase-api.js','utf8');
function game(hero, legacy=false){
 const key='emberfall_character_slots_v1', old='emberfall_singleplayer_v1';
 const data={player:hero};
 const storage=legacy?{[old]:JSON.stringify(data)}:
  {[key]:JSON.stringify({slot1:{id:'slot1',state:data}})};
 const original={...storage};
 const label={textContent:'',remove(){}};
 const document={
  getElementById:()=>label,querySelectorAll:()=>[],querySelector:()=>null,
  createElement:()=>({style:{},setAttribute(){}}),body:{appendChild(){}}
 };
 const itemDefs={short_sword:{slot:'weapon'},shield_basic:{slot:'shield'},mage_staff:{slot:'weapon'}};
 const gearRequirements=(id,owner)=>!!itemDefs[id]&&(id!=='mage_staff'||owner.class==='mage');
 let saveCalls=0,deliveries=0;
 const context={
  console,document,itemDefs,gearRequirements,window:{},PREMIUM_PRODUCTS:[],
  premiumProduct:()=>null,hasStarted:true,titleMenuActive:false,switchingCharacter:false,
  danTesting:()=>false,renderPremiumShop:()=>{},buyPlayProduct:()=>{},
  purchaseOwned:()=>false,grantTestPremium:()=>{},
  saveGame:()=>{saveCalls++;storage[key]=JSON.stringify({slot1:{state:data}})},
  snapshotGameState:()=>structuredClone(data),
  localStorage:{
   getItem:k=>Object.prototype.hasOwnProperty.call(storage,k)?storage[k]:null,
   setItem:(k,v)=>storage[k]=v
  },
  SAVE_SLOTS_KEY:key,SAVE_KEY:old,activeSlotId:'slot1',
  purchaseCommit:()=>{deliveries++}
 };
 vm.runInNewContext(source,context,{filename:'purchase-api.js'});
 return {context,storage,original,key,old,get saveCalls(){return saveCalls},get deliveries(){return deliveries}};
}
const base={name:'Hero',class:'warrior',level:1,x:10,y:10,hp:30,max:30,speed:3,xp:0,coins:0,inventory:[]};
const cases=[
 ['removed gear', {weapon:'retired_relic'},true],
 ['wrong slot', {weapon:'shield_basic'},true],
 ['class locked', {weapon:'mage_staff'},true],
 ['numeric ID', {weapon:42},true],
 ['object prototype ID', {weapon:'constructor'},true],
 ['valid weapon', {weapon:'short_sword'},false],
 ['valid shield', {shield:'shield_basic'},false],
 ['empty slot', {weapon:null},false],
 ['old empty sentinel', {weapon:''},false],
 ['old absent slot', {},false]
];
let count=0;
for(const [name,gear,damaged] of cases){
 const hero={...base,...gear};
 for(const legacy of [false,true]){
  const g=game(hero,legacy);
  assert.equal(g.context.window.ThornhavenDamagedSlots(),damaged,name+' legacy='+legacy);
  count++;
 }
}
for(const legacy of [false,true]){
 const g=game({...base,weapon:'retired_relic'},legacy);
 g.context.saveGame();
 assert.equal(g.saveCalls,0,'ordinary save must not overwrite missing gear');
 assert.deepEqual(g.storage,g.original,'stored bytes must remain intact');
 assert.throws(()=>g.context.purchaseCommit({player:base}),/Damaged character slots/);
 assert.equal(g.deliveries,0,'purchase must not acknowledge unpreserved gear');
 count+=4;
}
const healthy=game({...base,weapon:'short_sword'});
healthy.context.saveGame();
assert.equal(healthy.saveCalls,1,'normal gear must remain saveable');
healthy.context.purchaseCommit({player:{...base,weapon:'short_sword'}});
assert.equal(healthy.deliveries,1,'normal gear must remain deliverable');
count+=2;
console.log('PASS: '+count+' hero equipment preservation checks');

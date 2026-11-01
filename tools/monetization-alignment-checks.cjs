const fs=require('fs'),assert=require('assert'),vm=require('vm');
const {reward}=require('../app/src/main/assets/purchase-delivery');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const products=JSON.parse(html.match(/const PREMIUM_PRODUCTS=(\[.*?\]);/s)[1]);
const native=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/PlayBillingPreparation.java','utf8');
const ids=JSON.parse('['+native.match(/PRODUCT_IDS=\{(.*?)\}/s)[1]+']');
assert.deepEqual(ids.slice().sort(),products.map(p=>p.id).sort());
for(const p of products.filter(p=>['xp','levels'].includes(p.category)))assert(p.legacyRestoreOnly&&p.saleEnabled===false);
// Cinder is the cost:0 starter pet and is automatically granted by ensureStarterPet.
// Never let a paid copy of that free pet enter the native or WebView catalog.
assert(!ids.includes('thornhaven_pet_wolf'));
assert(!products.some(p=>p.petId==='dalen'));
for(const p of products.filter(p=>['thornhaven_crowns_100','thornhaven_pet_dragon'].includes(p.id)))assert.strictEqual(p.saleEnabled,false);
assert(html.includes("PREMIUM_PRODUCTS.filter(p=>p.saleEnabled!==false).filter(p=>premiumCategory"));
assert(html.includes("function ensureStarterPet()"));
assert(html.includes("dalen:{name:'Cinder'"));
assert(html.includes("cost:0"));
const profile='b'.repeat(64),id='a'.repeat(64);
const state={player:{level:17,xp:23,coins:8,name:'Tester',class:'warrior',inventory:[{id:'legacy',count:1}]},companions:[],townQuestState:{_purchaseProfile:profile,quest:{claimed:true}}};
function grant(product,input=state){return reward(input,{id,product,profile},products)}
const crowns=grant('thornhaven_crowns_100');assert.equal(crowns.player.coins,108);assert.equal(grant('thornhaven_crowns_100',crowns).player.coins,108);
assert.deepEqual(crowns.player.inventory,state.player.inventory);assert.equal(crowns.player.level,17);assert.equal(crowns.player.xp,23);assert.deepEqual(crowns.townQuestState.quest,state.townQuestState.quest);
for(const product of ['thornhaven_pet_dragon']){
 const pet=grant(product);assert.equal(pet.companions.length,1);assert(pet.companions[0].purchasedWithRealMoney);assert.equal(pet.companions[0].level,8);assert.equal(pet.companions[0].active,false);
 assert.equal(grant(product,pet).companions.length,1);
 const second=reward(pet,{id:'c'.repeat(64),product,profile},products);assert.equal(second.companions.length,1);
 assert.throws(()=>reward(state,{id,product,profile:'f'.repeat(64)},products));
}
assert.equal(state.player.coins,8);assert.equal(state.companions.length,0);
const commit=html.slice(html.indexOf('function purchaseCommit('),html.indexOf('function ensurePurchaseProfile('));
let fail=true,saved;
const c={SAVE_SLOTS_KEY:'slots',SAVE_KEY:'cache',ACTIVE_SLOT_KEY:'active',activeSlotId:'slot2',saveSlots:{slot1:{name:'Other'}},townQuestState:state.townQuestState,player:{...state.player},companions:[],Date,JSON,syncHeroStats(){},normalizePets(){},scaleEnemiesForRegion(){},localStorage:{setItem(k,v){if(k==='slots'){if(fail)throw Error('full');saved=v;}}}};
vm.createContext(c);vm.runInContext(commit,c);assert.throws(()=>c.purchaseCommit(crowns));assert.equal(c.player.coins,8);fail=false;c.purchaseCommit(crowns);assert.equal(c.player.coins,108);assert.equal(JSON.parse(saved).slot1.name,'Other');assert.equal(grant('thornhaven_crowns_100',JSON.parse(saved).slot2.state).player.coins,108);
c.purchaseCommit(grant('thornhaven_pet_dragon'));assert(c.companions[0].purchasedWithRealMoney);
assert(native.includes('if(!saleEnabled(product))'));
console.log('PASS: catalog parity, blocked XP/levels, draft crowns/pets, character-bound delivery, replay/reload, pet protection, save failure and live crown/pet commit.');

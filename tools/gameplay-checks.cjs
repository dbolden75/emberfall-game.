const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const update=fs.readFileSync('app/src/main/assets/playtest-update.js','utf8');
const noop=()=>{}, context=new Proxy({},{get:()=>noop,set:()=>true});
const nodes=new Map(),children=[];function append(e){children.push(e);if(e.id)nodes.set(e.id,e);}
function element(){return {style:{},dataset:{},hidden:true,before:noop,after:noop,setAttribute:noop,querySelectorAll:()=>[],appendChild:append,querySelector:()=>element(),getContext:()=>context,clientWidth:900,clientHeight:400};}
const root={document:{createElement:element,head:element(),body:element(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},querySelector:()=>element(),querySelectorAll:()=>[]},window:{},humanCompanion:()=>null,openHumanRoster:noop,petArtwork:{dalen:"dalen",sylvi:"sylvi"},standArt:noop,drawDetailedMonster:noop,drawCombat:noop,animationClock:1,regionSurface:()=>"grass",worldBounds:()=>({minX:0,maxX:960,minY:0,maxY:600}),activeMap:{name:'Ashvale',npcs:[],trees:[],stones:[],worldObjects:[]},enemies:[],maps:{ashvale:{name:'Ashvale'}},mapConnections:{ashvale:{exits:[]}},usesOpenWorld:()=>false,questCatalog:()=>[],trackedQuestId:()=>null,attackHeld:false,setInterval:fn=>{root.tick=fn;},mapId:"ashvale",stopWorldTouch:noop,clearPadTouches:noop,keys:new Set(),tapTarget:null,paintExplorationFog:noop,ensureStarterPet:noop,normalizePets:noop,renderPetCollection:noop,enemyHit:(v)=>{v.hp=Math.max(0,v.hp-10);},drawPet:noop,petAnimationPose:()=>({weight:0,attack:0}),ctx:context,hasStarted:true,switchingCharacter:false,titleMenuActive:false,townQuestState:{},companions:[],player:{coins:100},petDefs:{dalen:{cost:0,name:'Cinder'},sylvi:{cost:90,name:'Briar'}},petUnlocked:()=>true,makeCompanion:id=>({id,hp:30,max:30,active:true}),snapCompanionsToPlayer:noop,ui:noop,saveGame:noop,renderParty:noop,openPartyScreen:noop,openAdventureDialog:noop,say:noop,adoptPet:noop,petStory:noop,selectedCompanionId:null};
vm.createContext(root);vm.runInContext(update,root);
// Protect the 1.0.64 portrait layout from legacy in-game pet button sizing
// which otherwise expands the Pet button and overlaps Hero/Companion controls.
assert(update.includes('body:has(#gameView:not([hidden])) .shell #partyPortraits button{position:static;'),'Portrait CSS must outrank legacy pet HUD width and margin');
assert(update.includes('body:has(#gameView:not([hidden])) .shell #partyPortraits button{height:58px}'),'Short landscape portrait sizing must outrank legacy pet HUD');
assert(root.adoptPet('sylvi'));assert.equal(root.player.coins,100,'First pet must be free');
let pet=root.companions[0];pet.hp=5;root.enemyHit(pet,{});assert.equal(root.companions.length,0,'Earned pet must be removed on death');
assert(root.adoptPet('sylvi'));assert.equal(root.player.coins,10,'Replacement must cost crowns');
pet=root.companions[0];pet.hp=5;pet.purchasedWithRealMoney=true;root.enemyHit(pet,{});assert.equal(root.companions.length,1);assert.equal(pet.active,false,'Purchased pet retained for recovery');
root.companions=[];assert.equal(root.adoptPet('sylvi'),false);assert.equal(root.player.coins,10,'Unaffordable replacement must not charge');
assert(html.includes('bloodbound_scout')&&html.includes('veil_stalker')&&html.includes('crimson_elder'));
console.log('PASS: free reward, earned-pet death, paid replacement, insufficient funds, purchased-pet recovery flag, vampire definitions. Mocked state test; not visual or device testing.');
const combatSource=html.match(/function updateEnemyCombat\(e,dt\)\{[\s\S]*?\n\}/)[0];
const combat={Math,player:{x:999,y:999,hp:100},enemyPattern:()=>({cool:1.8}),activeCompanions:()=>[],combatEffects:[],battleVfx:()=>{},enemyHit:()=>{},dodgeGuard:0,steerActor:()=>{throw Error('Movement during recovery');}};
vm.createContext(combat);vm.runInContext(combatSource,combat);
const enemy={kind:'vampire',windup:.1,windupLength:1,swing:{x:0,y:0,radius:32},combatCool:0};
combat.updateEnemyCombat(enemy,.2);assert.equal(enemy.swing,null);assert.equal(enemy.recoveryTime,.45);assert.equal(combat.combatEffects.length,1);
combat.updateEnemyCombat(enemy,.2);assert.equal(enemy.recoveryTime,.25);assert.equal(combat.combatEffects.length,1);
combat.updateEnemyCombat(enemy,.4);assert.equal(enemy.recoveryTime,0);
console.log('PASS: committed attack resolves once; vampire recovery blocks movement and expires.');

root.player.x=128;root.player.y=128;root.tick();
assert(root.townQuestState._localExploration.ashvale["2,2"]);
assert(!root.townQuestState._localExploration.ashvale["20,20"]);
root.mapId="redfen";root.tick();
assert(root.townQuestState._localExploration.redfen["2,2"]);
assert.notStrictEqual(root.townQuestState._localExploration.ashvale,root.townQuestState._localExploration.redfen);
console.log("PASS: local exploration reveals nearby cells, hides distant cells, and separates regions in save state.");

root.mapId='ashvale';root.player.faceX=1;root.player.faceY=0;
const localButton=children.find(e=>e.textContent==='LOCAL MAP');assert(localButton);localButton.onclick();
assert.equal(root.window.jarvisPaused,true);assert.equal(nodes.get('localAtlas').hidden,false);
nodes.get('localAtlasClose').onclick();assert.equal(root.window.jarvisPaused,false);assert.equal(nodes.get('localAtlas').hidden,true);
root.window.jarvisPaused=true;localButton.onclick();nodes.get('localAtlasClose').onclick();assert.equal(root.window.jarvisPaused,true);
console.log('PASS: local map opens, renders, closes, and preserves an existing pause state. Canvas calls mocked.');

// Healing a character and consuming their potion must be saved atomically.
// In the released HTML, useItem() changes both values without calling saveGame().
// Extract the real functions (not a simplified fake) and verify the runtime fix.
const useItemLine=html.split(/\r?\n/).find(line=>line.startsWith('function useItem(id){'));
const itemSavePatch=update.match(/\/\* THORNHAVEN_ITEM_USE_SAVE_BEGIN[\s\S]*?\/\* THORNHAVEN_ITEM_USE_SAVE_END \*\//)?.[0];
assert(useItemLine&&itemSavePatch,'Healing persistence fix and actual game handler must both exist');
const itemCounts={potion_25:2,wayfarer_compass:1},healingSaves=[];
const saved={player:{hp:50,max:100},itemDefs:{potion_25:{heal:25,name:'Healing Potion'}},
 document:{getElementById:()=>({textContent:''})},
 bagCount:id=>itemCounts[id]||0,
 removeItem:id=>{if(!itemCounts[id])return false;itemCounts[id]--;return true},
 activateWayfarerCompass:()=>{},ui:()=>{},renderInventory:()=>{},
 saveGame:()=>healingSaves.push({hp:saved.player.hp,potions:itemCounts.potion_25})};
vm.createContext(saved);
vm.runInContext(useItemLine+'\n'+itemSavePatch,saved);
saved.useItem('potion_25');
assert.deepStrictEqual(healingSaves,[{hp:75,potions:1}],
 'A successful heal must persist its new HP and the consumed potion together');
saved.useItem('wayfarer_compass');
assert.equal(healingSaves.length,1,'Compass activation must not trigger a healing save');
saved.useItem('not_an_item');
assert.equal(healingSaves.length,1,'Unknown item must not trigger a save');
saved.player.hp=100;
saved.useItem('potion_25');
assert.equal(itemCounts.potion_25,1,'Full-health attempt must not consume a potion');
assert.equal(healingSaves.length,1,'Full-health attempt must not write a save');
console.log('PASS: healing consumes a potion and immediately persists HP and inventory; no save for unused items. Mocked state, not device testing.');

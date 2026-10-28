const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const update=fs.readFileSync('app/src/main/assets/playtest-update.js','utf8');
const noop=()=>{}, context=new Proxy({},{get:()=>noop,set:()=>true});
const nodes=new Map(),children=[];function append(e){children.push(e);if(e.id)nodes.set(e.id,e);}
function element(){return {style:{},dataset:{},hidden:true,before:noop,after:noop,setAttribute:noop,querySelectorAll:()=>[],appendChild:append,querySelector:()=>element(),getContext:()=>context,clientWidth:900,clientHeight:400};}
const root={document:{createElement:element,head:element(),body:element(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},querySelector:()=>element(),querySelectorAll:()=>[]},window:{},humanCompanion:()=>null,openHumanRoster:noop,petArtwork:{dalen:"dalen",sylvi:"sylvi"},standArt:noop,drawDetailedMonster:noop,drawCombat:noop,animationClock:1,regionSurface:()=>"grass",worldBounds:()=>({minX:0,maxX:960,minY:0,maxY:600}),activeMap:{name:'Ashvale',npcs:[],trees:[],stones:[],worldObjects:[]},enemies:[],maps:{ashvale:{name:'Ashvale'}},mapConnections:{ashvale:{exits:[]}},usesOpenWorld:()=>false,questCatalog:()=>[],trackedQuestId:()=>null,attackHeld:false,setInterval:fn=>{root.tick=fn;},mapId:"ashvale",paintExplorationFog:noop,ensureStarterPet:noop,normalizePets:noop,renderPetCollection:noop,enemyHit:(v)=>{v.hp=Math.max(0,v.hp-10);},drawPet:noop,petAnimationPose:()=>({weight:0,attack:0}),ctx:context,hasStarted:true,switchingCharacter:false,titleMenuActive:false,townQuestState:{},companions:[],player:{coins:100},petDefs:{dalen:{cost:0,name:'Cinder'},sylvi:{cost:90,name:'Briar'}},petUnlocked:()=>true,makeCompanion:id=>({id,hp:30,max:30,active:true}),snapCompanionsToPlayer:noop,ui:noop,saveGame:noop,renderParty:noop,openPartyScreen:noop,openAdventureDialog:noop,say:noop,adoptPet:noop,petStory:noop,selectedCompanionId:null};
vm.createContext(root);vm.runInContext(update,root);
// Existing in-game pet HUD CSS has a more specific width/margin rule than the
// former generic portrait selector. Keep both standard and landscape sizing
// overrides specific enough to prevent the pet portrait covering other buttons.
assert(update.includes('body:has(#gameView:not([hidden])) .shell #partyPortraits button{position:static;'),'Portrait base rule must override legacy pet HUD sizing');
assert(update.includes('body:has(#gameView:not([hidden])) .shell #partyPortraits button{height:58px}'),'Short-landscape portrait height override missing');
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

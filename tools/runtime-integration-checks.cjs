const vm=require('vm'),fs=require('fs');const base=process.cwd()+'/app/src/main/assets/';const html=fs.readFileSync(base+'index.html','utf8');
const noop=()=>{};const ctx=new Proxy({ellipse(...args){if(args.length<7)throw new TypeError('Canvas ellipse requires seven arguments');},measureText:()=>({width:50}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8ClampedArray(1000000)})},{get:(o,k)=>k in o?o[k]:noop});
const nodes=new Map();function elem(){const e={firstChild:{textContent:''},hidden:true,style:{setProperty:noop},dataset:{},value:'',textContent:'',innerHTML:'',clientWidth:960,clientHeight:600,width:960,height:600,children:[],classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},cloneNode:()=>elem(),replaceWith:noop,getContext:()=>ctx,getBoundingClientRect:()=>({width:960,height:600,left:0,top:0}),getClientRects:()=>[],querySelectorAll:()=>[],querySelector:()=>elem(),insertBefore:noop,appendChild:noop,append:noop,prepend:noop,after:noop,before:noop,remove:noop,replaceChildren:noop,insertAdjacentHTML:noop,addEventListener:noop,setAttribute:noop,getAttribute:()=>'',focus:noop,closest:()=>null};e.parentElement=e;return e;}
const doc={hidden:false,body:elem(),head:elem(),documentElement:elem(),createElement:elem,getElementById:id=>{if(!nodes.has(id))nodes.set(id,elem());return nodes.get(id)},querySelector:()=>elem(),querySelectorAll:()=>[],addEventListener:noop};const storage=new Map();const runtimeErrors=[];const root={console:{...console,error(...args){runtimeErrors.push(args.map(String).join(' '));}},document:doc,navigator:{},screen:{orientation:{addEventListener:noop}},innerWidth:960,innerHeight:600,devicePixelRatio:1,performance:{now:()=>0},MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},Image:class{constructor(){this.complete=false}addEventListener(){}},Audio:class{play(){return Promise.resolve()}pause(){}addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},requestAnimationFrame:noop,cancelAnimationFrame:noop,setTimeout:noop,setInterval:noop,clearTimeout:noop,clearInterval:noop,addEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop}),getComputedStyle:()=>({display:'none',getPropertyValue:()=>''}),location:{},URL,URLSearchParams,structuredClone};root.window=root;vm.createContext(root);
const probe=`hasStarted=true;titleMenuActive=false;document.getElementById('gameView').hidden=false;mapId='elderwood';activeMap=maps[mapId];enemies=activeMap.enemies;npcs=activeMap.npcs;player.class='mage';for(const panel of ['optionsMenu','adventureScreen','travelScreen','inventoryScreen','characterScreen','skillsScreen','shopScreen','partyScreen','storageScreen','questScreen','saveFilesScreen'])document.getElementById(panel).hidden=true;enemies[1].alive=true;enemies[1].recoveryTime=1;enemies[0].alive=false;enemies[0].respawnAt=Date.now()+100000;for(let i=1;i<5;i++)frame(i*16);`;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){const src=m[1].match(/src="([^"]+)"/);if(m[1].includes('application/'))continue;let code=src?fs.readFileSync(base+src[1],'utf8'):m[2];if(code.includes('})().catch(presentLoadError);'))code=code.replace('})().catch(presentLoadError);','window.runProbe=()=>{'+probe+'};})().catch(e=>console.error(e));');try{vm.runInContext(code,root,{filename:src?src[1]:'index-inline.js'});}catch(e){throw e;}}
if(root.runProbe)root.runProbe();else vm.runInContext(probe,root);if(runtimeErrors.length)throw Error(runtimeErrors.join('\n'));console.log('PASS: all bundled scripts initialize; Elderwood frames continue with a defeated monster awaiting respawn. DOM/canvas mocked; not device validation.');

vm.runInContext(`window.jarvisPaused=true;const prior=player.coins;player.coins=prior+7;saveGame();const saved=JSON.parse(localStorage.getItem(SAVE_KEY));if(saved.player.coins!==prior+7)throw Error('Paused menu changes were not saved');player.coins=prior;window.jarvisPaused=false;`,root);
console.log('PASS: gameplay changes save while paused in menus.');

root.TextEncoder=TextEncoder;
vm.runInContext(`window.jarvisPaused=false;player.name='CloudProbe';saveGame();const exported=ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId);const decoded=ThornhavenCloudSaveCore.parse(exported);if(decoded.slots[activeSlotId].state.player.name!=='CloudProbe')throw Error('Actual game snapshot backup failed');`,root);
console.log('PASS: actual full game snapshots validate in the portable backup format.');

// 1.0.58 map-selection regression: use the full initialized game state.
vm.runInContext(`
 const savedMap=mapId;
 const sc=document.getElementById('atlasScroller');sc.scrollTop=271;sc.scrollLeft=193;
 for(const id of [...worldGrid.flat(),'wayfarers_camp','veilhaven']){
  showAtlasDetails(id);
  if(!document.getElementById('atlasSelection').textContent.includes(maps[id].name))throw Error('Missing details: '+id);
  if(document.getElementById('atlasSelection').hidden)throw Error('Details hidden: '+id);
 }
 if(mapId!==savedMap||sc.scrollTop!==271||sc.scrollLeft!==193)throw Error('Details moved map/player');
`,root);
const selection=html.match(/document.getElementById\('travelDestinations'\)\.addEventListener\('click',e=>\{([\s\S]*?)\}\);travelScreen/);
if(!selection)throw Error('Missing map click handler');
let detailCalls=0,travelCalls=0;
const clickCheck=new Function('e','fastTravelArmed','travelTo','showAtlasDetails',selection[1]);
const event={target:{closest:()=>({disabled:false,dataset:{travelTo:'ashvale'},closest:()=>true})}};
clickCheck(event,false,()=>travelCalls++,()=>detailCalls++);
if(detailCalls!==1||travelCalls)throw Error('Overview tap did not select details directly');
clickCheck(event,true,()=>travelCalls++,()=>detailCalls++);
if(travelCalls!==1)throw Error('Compass action regressed');
if(/#atlasSelection\s*\{\s*display\s*:\s*none/.test(html))throw Error('Landscape hides details');
console.log('PASS: all grid regions plus camp/Veilhaven show details; selection leaves scroll/player unchanged; overview and compass dispatch verified. CSS hiding rule removed. No physical touch/layout validation.');

const background=html.match(/let atlasPointerStart=null;([\s\S]*?)\n requestAnimationFrame/);
if(!background)throw Error('Missing atlas background selection');
const listeners={}, selected=[];
const scroller={scrollLeft:0,scrollTop:0,addEventListener:(name,fn)=>listeners[name]=fn};
new Function('atlasScroller','worldGrid','showAtlasDetails','let atlasPointerStart=null;'+background[1])(scroller,[['northwest','northeast'],['southwest','southeast']],id=>selected.push(id));
const view={getBoundingClientRect:()=>({left:20,top:30,width:200,height:200})};
const tap={clientX:170,clientY:180,target:{closest:selector=>selector==='.atlasView'?view:null}};
listeners.pointerdown(tap);listeners.click(tap);
if(selected.join()!=='southeast')throw Error('Unlabelled region coordinate lookup failed');
listeners.pointerdown(tap);listeners.click({...tap,clientX:130});
if(selected.length!==1)throw Error('Drag mistaken for tap');
listeners.pointerdown(tap);scroller.scrollLeft=30;listeners.click(tap);
if(selected.length!==1)throw Error('Scroll mistaken for tap');
console.log('PASS: unlabelled map coordinates select region; drag/scroll gestures do not select. Mocked events only.');

vm.runInContext(`
 const expected=['briar_spider','crypt_archer','stone_guardian','marsh_stalker','vampire_hunter','dungeon_lord'];
 for(const key of expected){const matches=Object.values(maps).flatMap(m=>m.enemies).filter(e=>e.catalogType===key);if(matches.length!==1)throw Error('Missing catalog encounter '+key);if(!enemyPattern(matches[0]).label)throw Error('Missing pattern');}
 for(const m of Object.values(maps))if(m.town&&m.enemies.some(e=>e.catalogType))throw Error('Catalog enemy in town');
 const lord=Object.values(maps).flatMap(m=>m.enemies).find(e=>e.catalogType==='dungeon_lord');
 setMap('emberdeep',lord.x-120,lord.y,false);lord.hp=lord.maxHp*.5;lord.catalogCalled=false;lord.combatCool=99;
 const before=enemies.length;updateEnemyCombat(lord,.01);if(enemies.length>before+2||!lord.catalogCalled)throw Error('Unbounded summons');
 const summoned=enemies.filter(e=>e.catalogSummoned);if(!summoned.length)throw Error('No guards summoned');
 const snapshot=snapshotGameState();if(snapshot.mapStates.emberdeep.enemies.length!==before)throw Error('Summons leaked into indexed saves');
 const coinsBefore=player.coins,xpBefore=player.xp;finishEnemy(summoned[0],player.class);if(player.coins!==coinsBefore||player.xp!==xpBefore)throw Error('Summoned guard farming');
 updateEnemyCombat(lord,.01);if(enemies.length>before+2)throw Error('Repeated summons');
`,root);
console.log('PASS: six native encounters, no town additions, bounded lord summons, stable indexed saves and no summon reward farming.');
vm.runInContext(`
 const ids=Object.keys(ThornhavenNewItems);if(ids.length!==44)throw Error('Missing expansion items');
 for(const id of ids){if(!itemDefs[id]||!Object.values(shopDefs).some(s=>s.stock?.includes(id)))throw Error('Unavailable item '+id);}
 player.inventory=[];player.class='rogue';player.level=6;addItem('briar_fang');if(!canUseItem('briar_fang')||canUseItem('cryptsteel_blade'))throw Error('Class gates');
 equipItem('briar_fang');if(player.weapon!=='briar_fang')throw Error('Equip failed');player.hp=1;addItem('crypt_salve');useItem('crypt_salve');if(player.hp!==66||bagCount('crypt_salve'))throw Error('Potion effect');
 const save=snapshotGameState();applySavedGame(save);if(player.weapon!=='briar_fang'||!bagCount('briar_fang'))throw Error('Item save roundtrip');
`,root);
console.log('PASS: 44 items, shop availability, class restrictions, equipping, healing and save roundtrip.');

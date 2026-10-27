const vm=require('vm'),fs=require('fs');const base=process.cwd()+'/app/src/main/assets/';const html=fs.readFileSync(base+'index.html','utf8');
const noop=()=>{};const ctx=new Proxy({measureText:()=>({width:50}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8ClampedArray(1000000)})},{get:(o,k)=>k in o?o[k]:noop});
const nodes=new Map();function elem(){const e={firstChild:{textContent:''},hidden:true,style:{setProperty:noop},dataset:{},value:'',textContent:'',innerHTML:'',clientWidth:960,clientHeight:600,width:960,height:600,children:[],classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},cloneNode:()=>elem(),replaceWith:noop,getContext:()=>ctx,getBoundingClientRect:()=>({width:960,height:600,left:0,top:0}),getClientRects:()=>[],querySelectorAll:()=>[],querySelector:()=>elem(),insertBefore:noop,appendChild:noop,append:noop,prepend:noop,after:noop,before:noop,remove:noop,replaceChildren:noop,insertAdjacentHTML:noop,addEventListener:noop,setAttribute:noop,getAttribute:()=>'',focus:noop,closest:()=>null};e.parentElement=e;return e;}
const doc={hidden:false,body:elem(),head:elem(),documentElement:elem(),createElement:elem,getElementById:id=>{if(!nodes.has(id))nodes.set(id,elem());return nodes.get(id)},querySelector:()=>elem(),querySelectorAll:()=>[],addEventListener:noop};const storage=new Map();const root={console,document:doc,navigator:{},screen:{orientation:{addEventListener:noop}},innerWidth:960,innerHeight:600,devicePixelRatio:1,performance:{now:()=>0},MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},Image:class{constructor(){this.complete=false}addEventListener(){}},Audio:class{play(){return Promise.resolve()}pause(){}addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},requestAnimationFrame:noop,cancelAnimationFrame:noop,setTimeout:noop,setInterval:noop,clearTimeout:noop,clearInterval:noop,addEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop}),getComputedStyle:()=>({display:'none',getPropertyValue:()=>''}),location:{},URL,URLSearchParams,structuredClone};root.window=root;vm.createContext(root);
const probe=`hasStarted=true;titleMenuActive=false;document.getElementById('gameView').hidden=false;mapId='elderwood';activeMap=maps[mapId];enemies=activeMap.enemies;npcs=activeMap.npcs;player.class='mage';for(const panel of ['optionsMenu','adventureScreen','travelScreen','inventoryScreen','characterScreen','skillsScreen','shopScreen','partyScreen','storageScreen','questScreen','saveFilesScreen'])document.getElementById(panel).hidden=true;enemies[0].alive=false;enemies[0].respawnAt=Date.now()+100000;for(let i=1;i<5;i++)frame(i*16);`;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){const src=m[1].match(/src="([^"]+)"/);if(m[1].includes('application/'))continue;let code=src?fs.readFileSync(base+src[1],'utf8'):m[2];if(code.includes('})().catch(presentLoadError);'))code=code.replace('})().catch(presentLoadError);','window.runProbe=()=>{'+probe+'};})().catch(e=>console.error(e));');try{vm.runInContext(code,root,{filename:src?src[1]:'index-inline.js'});}catch(e){throw e;}}
if(root.runProbe)root.runProbe();else vm.runInContext(probe,root);console.log('PASS: all bundled scripts initialize; Elderwood frames continue with a defeated monster awaiting respawn. DOM/canvas mocked; not device validation.');

 // Thornhaven 1.0.57 equipment/forge/save integration; mocked runtime, not device testing.
const integration=vm.runInContext(`(() => {
 const ids=['copperfang_dagger','marshwarden_spear','duskweave_robe','ironbark_vest','lanternkeeper_amulet','emberstone_earrings'];
 const expected={ashvale_forge:['copperfang_dagger','ironbark_vest'],brackenford_forge:['copperfang_dagger','marshwarden_spear'],sunmere_forge:['duskweave_robe','lanternkeeper_amulet'],stonewatch_forge:['ironbark_vest','emberstone_earrings']};
 if(!window.THORNHAVEN_157_CONTENT || window.THORNHAVEN_157_CONTENT.items.length!==6) throw Error('1.0.57 not loaded');
 for(const id of ids){if(!itemDefs[id]||!GEAR_SLOTS.includes(itemDefs[id].slot)||!Array.isArray(itemClassRules[id]))throw Error('Invalid equipment: '+id);}
 for(const [id,stock] of Object.entries(expected))for(const gear of stock){if(shopDefs[id].stock.filter(x=>x===gear).length!==1)throw Error('Incorrect forge stock '+id+'/'+gear);}
 player.class='mage';player.level=12;
 if(canUseItem('ironbark_vest') || !canUseItem('duskweave_robe'))throw Error('Class gating bypass');
 player.class='warrior';player.level=2;
 if(canUseItem('copperfang_dagger'))throw Error('Level requirement bypass');
 player.level=12;
 if(!canUseItem('copperfang_dagger'))throw Error('Eligible gear unavailable');
 const html=itemRowHTML('copperfang_dagger',1,'buy');
 if(!html.includes('Classes:')||!html.includes('Level 3'))throw Error('Shop class labels missing');
 const before=JSON.stringify(player.inventory);
 player.inventory.push({id:'copperfang_dagger',count:1});
 const snapshot=snapshotGameState();
 if(!snapshot.player.inventory.some(row=>row.id==='copperfang_dagger'))throw Error('New gear lost in save snapshot');
 player.inventory=JSON.parse(before);
 return ids.length;
})()`,root);
if(integration!==6)throw Error('Unexpected 1.0.57 integration check result');
console.log('PASS: six new gear items, class/level gating, forge stock, shop labels, save snapshot; mocked runtime only.');

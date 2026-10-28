'use strict';
// Execute the actual game bag-capacity and inventory-render functions in an
// isolated DOM mock. This is a regression, not physical-device QA.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const bag=html.match(/function bagUnits\(\)\{[\s\S]*?\}(?=\s*function bagCount\()/);
const draw=html.match(/function renderInventory\(\)\{[\s\S]*?\}(?=\s*function showItemDetail\()/);
assert(bag&&draw,'Could not find real inventory functions');
const elements=new Map();
const element=id=>{
 if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',style:{},hidden:false});
 return elements.get(id);
};
const oldRows=[{id:'missing_legacy_item',count:99},{id:'health_tonic',count:2},{id:'ancient_quest',count:1}];
const player={name:'Legacy QA',class:'warrior',gender:'male',level:7,coins:123,hp:30,max:50,
 inventory:JSON.parse(JSON.stringify(oldRows)),weapon:'missing_legacy_blade',armor:null,shield:null};
const context={
 document:{getElementById:element,querySelectorAll:()=>[]},
 player,
 itemDefs:{health_tonic:{name:'Health tonic',category:'supply'},ancient_quest:{name:'Quest token',category:'quest'}},
 classDefs:{warrior:{title:'Warrior'}},
 normalizedHeroGender:()=> 'male',
 GEAR_SLOTS:['weapon','armor','shield'],GEAR_LABELS:{weapon:'Weapon',armor:'Armor',shield:'Shield'},
 GEAR_ICONS:{weapon:'⚔',armor:'⛨',shield:'◇'},
 inventoryFilter:'all',inventoryTileHTML:(id,count)=>'<div class="validTile">'+id+' × '+count+'</div>',
 hasSigil:false,bagLimit:()=>24,playerAttackPower:()=>10,equipmentGuard:()=>2,equipmentSetSummary:()=>''
};
vm.createContext(context);
vm.runInContext(bag[0]+'\n'+draw[0],context);
assert.equal(context.bagUnits(),2,'Missing catalog items must not consume bag capacity; quest items are capacity-free');
context.renderInventory();
assert.equal(element('bagCapacity').textContent,'2 / 24 items');
assert.match(element('inventoryList').innerHTML,/Unavailable legacy item \(preserved\)/,
 'Do not silently hide legacy items from the player');
assert.match(element('inventoryList').innerHTML,/health_tonic/,
 'Keep normal inventory items visible');
assert.match(element('inventoryGearSlots').innerHTML,/Unavailable legacy gear/,
 'Unknown equipped gear is preserved, not an empty equipment slot');
assert.match(element('inventoryNotice').textContent,/do not take bag space/);
assert.deepEqual(player.inventory,oldRows,'Legacy bag IDs, counts and order must remain unchanged');
assert.equal(player.weapon,'missing_legacy_blade','Never erase a legacy equipped gear ID');
context.inventoryFilter='quest';context.renderInventory();
assert.doesNotMatch(element('inventoryList').innerHTML,/Unavailable legacy item/,
 'Legacy placeholders are visible only in the all-items view');
assert.match(element('inventoryList').innerHTML,/ancient_quest/);
context.player.inventory=[{id:'health_tonic',count:3}];context.inventoryFilter='all';context.renderInventory();
assert.equal(context.bagUnits(),3,'Ordinary recognized bags are unaffected');
assert.doesNotMatch(element('inventoryList').innerHTML,/Unavailable legacy item/);
console.log('PASS: legacy catalog item IDs stay saved and visible without silently filling the bag; normal and quest items unchanged.');


// Historical unavailable inventory entries also reached the merchant Sell
// tab, where renderShop dereferenced itemDefs[row.id].sell without checking
// whether the catalog still contains that item. Test the real game function.
const shopSource=html.match(/function renderShop\(\)\{[^\n]+\}/);
assert(shopSource,'Could not find real merchant renderShop function');
const shopNodes=new Map();
const shopElement=id=>{if(!shopNodes.has(id))shopNodes.set(id,{textContent:'',innerHTML:'',hidden:false});return shopNodes.get(id)};
const shopPlayer={coins:123,inventory:JSON.parse(JSON.stringify(oldRows))};
const shopContext={
 document:{getElementById:shopElement,querySelectorAll:()=>[]},
 shopScreen:{querySelector:()=>({hidden:false})},
 shopDefs:{ashvale_store:{stock:[],forgeClass:null,workshopOnly:false}},
 activeShopId:'ashvale_store',player:shopPlayer,
 itemDefs:{health_tonic:{sell:2},ancient_quest:{sell:0}},shopMode:'sell',
 shopTown:()=>null,townStock:()=>({remaining:0}),renderBulkSell:()=>{},
 itemRowHTML:(id,count)=>id+' x'+count,renderSetForge:()=>{},renderForge:()=>{}
};
vm.createContext(shopContext);
vm.runInContext(shopSource[0],shopContext);
assert.doesNotThrow(()=>shopContext.renderShop(),
 'Historical unavailable items must not crash the merchant Sell tab');
assert.equal(shopElement('shopList').innerHTML,'health_tonic x2',
 'Known salable inventory must remain usable');
assert.deepEqual(shopPlayer.inventory,oldRows,
 'The Sell tab must not alter saved historical items');
console.log('PASS: merchant Sell tab ignores unavailable historical IDs without losing saved items.');

const fs=require('fs');
const harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8');
const probe=`
for(const [hero,town] of [['warrior','ashvale'],['rogue','brackenford'],['cleric','stonewatch'],['mage','sunmere']]){
 player.name='MiningBeginner';player.class=hero;player.level=1;player.inventory=[];player.coins=20;gatheringSkills=normalizeGatheringSkills({});
 if(!maps[town].npcs.some(n=>n.shopId&&shopDefs[n.shopId]?.stock.includes('mining_pick')))throw Error('No local pick seller: '+town);
 player.coins-=itemDefs.mining_pick.price;addItem('mining_pick');setMap(town,480,340,false);
 const rock=activeMap.gatherNodes.find(n=>n.skill==='mining'&&n.x>=0&&n.x<=960&&n.y>=0&&n.y<=600&&gatherOutput(n)==='copper_ore');
 if(!rock)throw Error('No central starter copper: '+town);
 rock.readyAt=0;gatherNode(rock);if(bagCount('copper_ore')!==1||gatheringSkills.mining.xp!==12)throw Error('Beginner mining failed: '+town);
 gatherNode(rock);if(gatheringSkills.mining.xp!==12)throw Error('Depletion bypass');
 for(let i=1;i<17;i++){rock.readyAt=0;gatherNode(rock)}
 if(gatheringSkills.mining.level!==5)throw Error('No level-5 training path');
}
let mixed=0;
for(const m of Object.values(maps)){
 const nodes=(m.gatherNodes||[]).filter(n=>n.skill==='mining');if(!nodes.length)continue;
 const ores=nodes.map(n=>miningOreFor(n,m));if(!ores.includes('copper_ore'))throw Error('Copper missing: '+m.name);
 if(!m.town&&m.level>=6&&nodes.length>=3){if(!ores.includes('iron_ore')||!ores.includes('silver_ore'))throw Error('Mixed ore missing: '+m.name);mixed++;}
}
setMap('frostmarch',480,340,false);player.inventory=[];addItem('mining_pick');gatheringSkills=normalizeGatheringSkills({});
const silver=activeMap.gatherNodes.find(n=>gatherOutput(n)==='silver_ore');silver.readyAt=0;gatherNode(silver);
if(bagCount('silver_ore')||gatheringSkills.mining.xp)throw Error('Silver gate bypass');
gatheringSkills.mining={xp:200,level:5};gatherNode(silver);if(bagCount('silver_ore')<1)throw Error('Silver blocked');
const ore=gatherOutput(silver);setMap('ashvale',480,340,false);setMap('frostmarch',480,340,false);if(gatherOutput(silver)!==ore)throw Error('Ore changed on travel');
console.log('PASS: all four ordinary level-1 classes mine local copper and train to Mining 5; '+mixed+' high-tier regions have mixed ores; depletion and silver gates preserved. Mocked runtime.');
`;
new Function('require',harness+'\nvm.runInContext('+JSON.stringify(probe)+',root);')(require);

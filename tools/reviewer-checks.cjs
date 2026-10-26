const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const start=html.indexOf('function grantTestPremium('),end=html.indexOf('function purchaseCommit(',start);
let testMode=false,commits=0,state={player:{level:10},townQuestState:{}};
const ctx={danTesting:()=>testMode,hasStarted:true,titleMenuActive:false,switchingCharacter:false,premiumProduct:id=>({id,category:'levels',levels:5}),snapshotGameState:()=>structuredClone(state),purchaseCommit:n=>{state=n;commits++},renderPremiumShop:()=>{},document:{getElementById:()=>({})}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);ctx.grantTestPremium('test');assert.equal(commits,0);testMode=true;ctx.grantTestPremium('test');assert.equal(state.player.level,15);assert.equal(commits,1);assert.equal(state.townQuestState._playReceipts,undefined);
assert(html.includes('if(danTesting()||!hasStarted||titleMenuActive||switchingCharacter||!playStore.products[id]||playStore.busy)return;'));
console.log('PASS: ordinary characters cannot use test grants; developer grants remain local and separate from Play receipt ledger; developer checkout blocked.');

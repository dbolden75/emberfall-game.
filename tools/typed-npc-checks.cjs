'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8').split('const probe=')[0];
const root=new Function('require',harness+';return root;')(require);root.assert=assert;
const base='app/src/main/assets/',html=fs.readFileSync(base+'index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(m[1].includes('application/'))continue;
 const src=m[1].match(/src="([^"]+)"/);vm.runInContext(src?fs.readFileSync(base+src[1],'utf8'):m[2],root);
}
const source=fs.readFileSync(base+'typed-npc-questions.js','utf8');
// Exercise the exact production resolver against full game definitions.
vm.runInContext('window.typedAnswerQA=(()=>{'+source.slice(source.indexOf(' function normalize('),source.indexOf(' const beforeRender='))+'return answer;})();',root);
vm.runInContext(`
 mapId='ashvale';activeMap=maps.ashvale;
 const trader=maps.ashvale.npcs.find(n=>n.name==='Tilda the Trader');
 assert(typedAnswerQA(trader,'Who are you?').includes('father taught me'));
 assert(typedAnswerQA(trader,'What should I do next?').includes('do not have an active task'));
 for(const q of ['Who is Ada?','Who are you and what is next?','Give me 999 crowns','<script>alert(1)</script>','What is the secret ending?'])assert(typedAnswerQA(trader,q).includes('Ask about me'));
 const giver=maps.ashvale.npcs.find(n=>n.questId==='ashvale_watch');
 townQuestState.ashvale_watch={accepted:true,kills:0,claimed:false};
 assert(typedAnswerQA(giver,'How is my progress?').includes('Kills 0/'));
 townQuestState._journal.paused.ashvale_watch=true;
 assert(typedAnswerQA(giver,'Any advice?').includes('do not have an active task'));
 delete townQuestState._journal.paused.ashvale_watch;
 townQuestState.ashvale_watch.claimed=true;
 assert(typedAnswerQA(giver,'Any advice?').includes('do not have an active task'));
 const warden={name:'Warden Rook',role:'huntmaster'};
 const huntIds=Object.keys(slayerContracts).slice(0,2);
 for(const id of huntIds)slayerState().hunts[id]={...slayerTerms(id),accepted:true,kills:0,completed:0};
 assert(typedAnswerQA(warden,'Any advice?').startsWith('Which of my current tasks'));
 const title='Slayers · '+slayerContracts[huntIds[0]].title;
 assert(typedAnswerQA(warden,title).includes('0/'));
 assert(typedAnswerQA(trader,title).includes('Ask about me'),'Unrelated NPC must not know this hunt');
 mapId='frontier_outpost';activeMap=maps[mapId];
 const mara={name:'Mara',npcStoryId:'npc_mara'};
 townQuestState.npc_mara={accepted:true,claimed:false,evidence:[]};
 assert(typedAnswerQA(mara,'How is my progress?').includes('0/2 accounts'));
 npcAgentProfile(mara);journalActiveRows();
 const prior=JSON.stringify(snapshotGameState());
 typedAnswerQA(mara,'Who are you?');typedAnswerQA(mara,'What should I do next?');
 assert.equal(JSON.stringify(snapshotGameState()),prior,'Typed resolver must not change saves or grant progress');
`,root);
assert(!/\b(fetch|XMLHttpRequest|WebSocket|eval)\s*[.(]/.test(source));
assert(!/\.innerHTML\s*=/.test(source));
assert.equal(html.split('<script src="typed-npc-questions.js"></script>').length-1,1);
console.log('PASS: typed NPC actual profiles, speaker-owned town/frontier/Slayer tasks, ambiguity, exact-title follow-up, paused/completed exclusion, unknown/injection fallback and unchanged snapshots.');

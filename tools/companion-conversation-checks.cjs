'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Reuse the established full-game mock environment; load actual release scripts.
const harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8').split('const probe=')[0];
const root=new Function('require',harness+';return root;')(require);
root.assert=assert;
const base='app/src/main/assets/',html=fs.readFileSync(base+'index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 if(m[1].includes('application/'))continue;
 const src=m[1].match(/src="([^"]+)"/);
 vm.runInContext(src?fs.readFileSync(base+src[1],'utf8'):m[2],root);
}
// Mocked DOM is intentionally not used for interaction assertions; Playwright
// covers clicks/focus/layout. Here ensure state and cloud-save invariants.
vm.runInContext(`
 hasStarted=true; titleMenuActive=false; player.name='ConvoTest'; mapId='wayfarers_camp';
 townQuestState._humanParty={active:'dalen',roster:{dalen:makeHuman('dalen')}};
 townQuestState.recruit_dalen={accepted:true,kills:1,claimed:false};
 journalActiveRows();
 const before=JSON.stringify(snapshotGameState());
 ThornhavenCompanionConversation.open();
 assert(document.getElementById('adventureText').textContent.includes('take stock'));
 closePanel('adventureScreen');
 assert.equal(JSON.stringify(snapshotGameState()),before,'Conversation must not change saved game state');
 saveGame();
`,root);
root.TextEncoder=TextEncoder;
vm.runInContext(`
 const restored=ThornhavenCloudSaveCore.parse(ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId));
 const party=restored.slots[activeSlotId].state.townQuestState._humanParty;
 assert.equal(party.active,'dalen');
 assert.equal(restored.slots[activeSlotId].state.townQuestState.recruit_dalen.kills,1);
 townQuestState._humanParty.active=null;
 ThornhavenCompanionConversation.open();
 assert(document.getElementById('adventureText').textContent.includes('No active companion'));
`,root);
const feature=fs.readFileSync(base+'companion-conversations.js','utf8');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|eval)\s*[.(]/.test(feature),'Feature must remain offline and session-only');
assert(!/\.innerHTML\s*=/.test(feature),'Feature must render untrusted text through DOM textContent');
assert.equal(html.split('<script src="companion-conversations.js"></script>').length-1,1);
console.log('PASS: companion conversation full-game initialization, unchanged snapshots, cloud-save roundtrip, absent companion, offline/text-safe source, single load.');

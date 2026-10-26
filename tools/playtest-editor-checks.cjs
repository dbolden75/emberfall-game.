const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app/src/main/assets/playtest-editor.js','utf8');
let tick,testing=true,sent=[],launches=0;const events={},store={};
const elements={};function el(id){return elements[id]||(elements[id]={value:'',textContent:'',close(){},click(){if(this.onclick)this.onclick();},insertBefore(){}});}
el('jarvisUrl').value='https://test.invalid';el('jarvisToken').value='x'.repeat(40);
el('world').width=1200;el('world').height=600;
const bridge={send(...args){sent.push(args)}};
const ctx={console,URL,Date,Math,JSON,Error,hasStarted:true,titleMenuActive:false,danTesting:()=>testing,
 mapId:'camp',activeMap:{name:'Camp'},player:{x:1,y:2,class:'mage',level:1},townQuestState:{},ui(){},
 localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},
 document:{hidden:false,getElementById:el,createElement:tag=>tag==='canvas'?{getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,/9j/2Q=='}:{innerHTML:''}},
 setInterval:fn=>tick=fn,ThornhavenPlaytest:bridge,ThornhavenDevice:{openChatGPTBesideGame(){launches++}}};
ctx.window=ctx;ctx.addEventListener=(name,fn)=>events[name]=fn;
vm.createContext(ctx);vm.runInContext(source,ctx);
ctx.ui();ctx.ui();assert.equal(launches,1);
el('editorFlag').onclick();assert.equal(sent.length,1);const frame=JSON.parse(sent[0][2]);assert.equal(frame.context.build,'1.0.49');
assert.equal(JSON.parse(store['thornhaven.playtest.flags.v1']).length,1);
events.playtestDelivery({detail:{id:'wrong',ok:true}});assert.equal(JSON.parse(store['thornhaven.playtest.flags.v1']).length,1);
events.playtestDelivery({detail:{id:frame.id,ok:false}});assert.equal(JSON.parse(store['thornhaven.playtest.flags.v1']).length,1);
el('editorFlag').onclick();const pending=JSON.parse(sent.at(-1)[2]);events.playtestDelivery({detail:{id:pending.id,ok:true}});
assert.equal(JSON.parse(store['thornhaven.playtest.flags.v1']).length,1);
testing=false;const before=sent.length;el('editorFlag').onclick();assert.equal(sent.length,before);
console.log('Editor checks passed: one split request, Dan gating, capture context, persisted flags, mismatched ack, failed delivery retention, acknowledged deletion. No Android UI tested.');

/* Developer-only frame capture. Delivery is not AI analysis or a ChatGPT session. */
(()=>{
'use strict';
const STORE='thornhaven.playtest.flags.v1';
let queue=[];try{const saved=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(saved))queue=saved.slice(0,8);}catch{}
let sharing=false,pending=null,launched=false,lastSent=0;
const errors=[];
window.addEventListener('error',e=>{errors.push({time:Date.now(),message:String(e.message).slice(0,300)});if(errors.length>12)errors.shift();});
const panel=document.getElementById('jarvisPanel');
const controls=document.createElement('section');
controls.innerHTML='<h3>TheDanCode editor</h3><p>Flag saves the current game-world image and diagnostic context. Configure a private receiver below for automatic uploads. Delivery does not mean an AI reviewed it.</p><button id="editorFlag">Flag current view</button><button id="editorWatch">Start game-view sharing</button><button id="editorSplit">Open ChatGPT beside game</button><p id="editorStatus" role="status">Not sharing.</p>';
panel.insertBefore(controls,panel.firstChild);
const get=id=>document.getElementById(id),status=t=>get('editorStatus').textContent=t;
function allowed(){return hasStarted&&!titleMenuActive&&danTesting();}
function persist(){localStorage.setItem(STORE,JSON.stringify(queue));}
function config(){
 const url=new URL(get('jarvisUrl').value);const token=get('jarvisToken').value.trim();
 if(url.protocol!=='https:'||url.username||url.password||token.length<32||token.startsWith('sk-'))throw Error('Enter a private HTTPS receiver and pairing token under Testing connection.');
 if(!window.ThornhavenPlaytest)throw Error('This feature requires the Android APK.');
 return {url:url.origin+'/frames',token};
}
function capture(kind){
 const source=document.getElementById('world'),image=document.createElement('canvas');
 const ratio=Math.min(1,960/source.width);image.width=Math.round(source.width*ratio);image.height=Math.round(source.height*ratio);
 image.getContext('2d').drawImage(source,0,0,image.width,image.height);
 return {id:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),kind,time:new Date().toISOString(),image:image.toDataURL('image/jpeg',.65),context:{build:'1.0.49',map:mapId,mapName:activeMap.name,position:{x:Math.round(player.x),y:Math.round(player.y)},class:player.class,level:player.level,trackedQuest:townQuestState._tracking?.id||null,errors:errors.slice(),note:get('jarvisMessage').value.slice(0,2000)}};
}
function deliver(frame){
 const connection=config();pending={id:frame.id,kind:frame.kind,time:Date.now()};
 try{ThornhavenPlaytest.send(connection.url,connection.token,JSON.stringify(frame));}
 catch(error){pending=null;throw error;}
}
function tick(){
 if(!allowed()||document.hidden){sharing=false;get('editorWatch').textContent='Start game-view sharing';return;}
 if(pending){if(Date.now()-pending.time>35000){pending=null;status('Retrying: no delivery confirmation.');}return;}
 if(Date.now()-lastSent<5000)return;
 lastSent=Date.now();
 try{if(queue.length)deliver(queue[0]);else if(sharing)deliver(capture('view'));}
 catch(e){if(sharing){sharing=false;get('editorWatch').textContent='Start game-view sharing';}status(queue.length?'Queued locally: '+queue.length+'. '+e.message:e.message);}
}
get('editorFlag').onclick=()=>{
 if(!allowed())return;
 if(queue.length>=8){status('Queue full: connect the receiver before adding more flags. Existing flags are retained.');return;}
 try{const item=capture('flag');queue.push(item);try{persist();}catch(e){queue.pop();throw e;}status('Queued locally: '+queue.length+'.');lastSent=0;tick();}
 catch(e){status('Flag was not saved. Storage or image capture unavailable.');}
};
get('editorWatch').onclick=()=>{
 if(!allowed())return;
 if(sharing){sharing=false;get('editorWatch').textContent='Start game-view sharing';status('Stopped. An upload already in flight may finish.');return;}
 try{config();sharing=true;get('editorWatch').textContent='Stop game-view sharing';status('Sharing game-world images every five seconds. No AI viewer is connected by this build.');lastSent=0;panel.close();tick();}
 catch(e){status(e.message);}
};
get('editorSplit').onclick=()=>{if(allowed()&&window.ThornhavenDevice?.openChatGPTBesideGame)ThornhavenDevice.openChatGPTBesideGame();};
window.addEventListener('playtestDelivery',e=>{
 if(!pending||e.detail?.id!==pending.id)return;
 if(e.detail.ok){
  if(pending.kind==='flag'){const previous=queue;queue=queue.filter(f=>f.id!==pending.id);try{persist();}catch{queue=previous;}}
  status('Delivered to receiver. '+queue.length+' flags queued. AI review not confirmed.');
 }else status('Retrying: receiver did not confirm delivery. '+queue.length+' flags retained.');
 pending=null;
});
const previousUi=ui;ui=function(){previousUi();if(allowed()&&!launched){launched=true;get('editorSplit').click();}if(!allowed())sharing=false;};
setInterval(tick,1000);
})();

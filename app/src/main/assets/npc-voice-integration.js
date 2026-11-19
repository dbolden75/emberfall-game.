/* Only Tilda, Edda and Sera's existing conversation greetings/new replies. */
(function(){
 'use strict';
 const voice=window.ThornhavenVoice=window.ThornhavenCreateVoice();
 let latest=null,npcGeneration=null,background=false,blurred=false;
 const panel=document.getElementById('adventureScreen');
 const profile=n=>/^Tilda\b/.test(n.name||'')?'merchant':/^Edda\b/.test(n.name||'')?'carpenter':/^Sera\b/.test(n.name||'')?'courier':null;
 function stop(){latest=null;npcGeneration=null;voice.stop();}
 function say(n,text){
  const p=profile(n);if(!p)return;
  latest={speakerId:npcAgentKey(n),profile:p,text};voice.speak(latest);npcGeneration=voice.generation();controls();
 }
 function description(){const p=voice.preferences(),state=voice.status();return p.muted||p.volume===0?'NPC voice muted.':state==='ready'?'Android device speech · offline voice':state==='loading'?'Device voice loading · use Replay when ready.':state==='no-offline-english'?'No installed offline English voice. Dialogue text remains available.':'Device speech unavailable here. Dialogue text remains available.';}
 function controls(){
  let row=document.getElementById('npcVoiceControls');if(row)row.remove();if(!latest)return;
  row=document.createElement('div');row.id='npcVoiceControls';
  const status=document.createElement('small');status.id='npcVoiceStatus';status.textContent=description();status.style.display='block';
  const replay=document.createElement('button');replay.type='button';replay.textContent='Replay voice';replay.addEventListener('click',()=>{if(latest){voice.speak(latest);npcGeneration=voice.generation();}status.textContent=description();});
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Stop voice';cancel.addEventListener('click',()=>voice.stop());
  row.append(status,replay,cancel);panel.querySelector('.screenFoot').appendChild(row);
 }
 const openBefore=openNpcConversation;openNpcConversation=function(n){stop();const result=openBefore(n);if(npcConversation&&npcConversation.npc===n)say(n,npcConversation.greeting);return result;};
 const askBefore=askNpc;askNpc=function(text){
  const c=npcConversation,clean=String(text||'').trim();if(!c||c.map!==mapId||!clean)return askBefore(text);
  voice.stop();const result=askBefore(text);if(npcConversation===c){const history=npcAgentMemory(c.npc).history||[];const reply=history[history.length-1];if(reply)say(c.npc,reply.reply);}return result;
 };
 const dialogBefore=openAdventureDialog;openAdventureDialog=function(...args){stop();return dialogBefore(...args);};
 const closeBefore=closePanel;closePanel=function(id){if(id==='adventureScreen')stop();return closeBefore(id);};
 const mapBefore=setMap;setMap=function(...args){stop();return mapBefore(...args);};
 new MutationObserver(()=>{
  if(panel.hidden){stop();return;} // Hiding the shared dialog cancels any owner.
  if(latest&&!panel.classList.contains('npcTalkView')){
   // A pending NPC mutation must not cancel a newer companion/API request.
   if(voice.generation()===npcGeneration)voice.stop();
   latest=null;npcGeneration=null;
  }
 }).observe(panel,{attributes:true,attributeFilter:['hidden','class']});
 function sync(){if(background||blurred||document.hidden){voice.suspend();}else voice.resume();}
 window.addEventListener('pagehide',()=>{background=true;sync();});
 window.addEventListener('pageshow',()=>{background=false;blurred=false;sync();});
 window.addEventListener('blur',()=>{blurred=true;sync();});window.addEventListener('focus',()=>{blurred=false;sync();});
 document.addEventListener('visibilitychange',sync);
 const section=document.getElementById('audioSettings'),label=document.createElement('label'),out=document.createElement('output'),slider=document.createElement('input'),mute=document.createElement('button'),note=document.createElement('p');
 label.className='optionsLabel';label.htmlFor='voiceVolume';label.textContent='NPC voice volume ';label.appendChild(out);
 slider.id='voiceVolume';slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.value=String(Math.round(voice.preferences().volume*100));slider.style.cssText='width:100%;min-height:44px;accent-color:#edc874';
 mute.id='voiceMute';mute.type='button';note.style.font='11px system-ui';note.textContent='Device speech for Tilda, Edda and Sera. Uses installed offline English voices; availability and voice quality depend on your device.';
 function paint(){out.textContent=slider.value+'%';mute.textContent='NPC VOICES: '+(voice.preferences().muted?'OFF':'ON');mute.setAttribute('aria-pressed',String(!voice.preferences().muted));const status=document.getElementById('npcVoiceStatus');if(status)status.textContent=description();}
 slider.addEventListener('input',()=>{voice.set({volume:Number(slider.value)/100});paint();});mute.addEventListener('click',()=>{voice.set({muted:!voice.preferences().muted});paint();});section.append(label,slider,mute,note);paint();sync();
 setInterval(()=>{const status=document.getElementById('npcVoiceStatus');if(status&&!panel.hidden)status.textContent=description();},1000);
})();

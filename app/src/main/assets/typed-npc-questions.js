/* Typed, offline authored NPC answers. No inference, transport or save schema. */
(() => {
 'use strict';
 const panel=document.getElementById('adventureScreen');
 let turn=null, rendering=false;
 function voice(method,payload){try{const v=window.ThornhavenVoice;if(typeof v?.[method]==='function')Promise.resolve(v[method](payload)).catch(()=>{});}catch(_){}}
 function end(){
  if(!turn)return;
  const previous=turn;turn=null; voice('stop');
  if(previous.keyHandler)panel.removeEventListener('keydown',previous.keyHandler);
  document.getElementById('typedNpcForm')?.remove();
  panel.classList.remove('typedNpcView');
  panel.style.removeProperty('--npc-view-height');panel.style.removeProperty('--npc-view-top');
  panel.querySelector('.screenFoot').textContent=previous.footer;
 }
 const beforeDialog=openAdventureDialog;
 openAdventureDialog=function(...args){if(!rendering)end();return beforeDialog.apply(this,args);};
 const beforeClose=closePanel;
 closePanel=function(id){if(id==='adventureScreen')end();return beforeClose.apply(this,arguments);};
 const beforePrepare=preparePanel;
 preparePanel=function(id){if(id!=='adventureScreen')end();return beforePrepare.apply(this,arguments);};
 function valid(t){return turn===t&&!panel.hidden&&npcConversation===t.conversation&&mapId===t.map&&activeSlotId===t.slot&&npcAgentKey(t.npc)===t.key;}
 function viewport(){if(!turn)return;const v=window.visualViewport;panel.style.setProperty('--npc-view-height',(v?.height||window.innerHeight)+'px');panel.style.setProperty('--npc-view-top',(v?.offsetTop||0)+'px');}
 window.visualViewport?.addEventListener('resize',viewport);
 window.visualViewport?.addEventListener('scroll',viewport);
 window.addEventListener('resize',viewport);
 function normalize(s){return s.toLowerCase().replace(/[’']/g,'').replace(/[?!.,]+$/g,'').replace(/\s+/g,' ').trim();}
 function ownedQuests(n){
  return journalActiveRows().filter(q=>q.active&&!q.done&&(q.id===n.questId||q.id===n.npcStoryId||(n.role==='huntmaster'&&q.id.startsWith('slayer_')&&q.id!=='slayer_intro')));
 }
 function answer(n,question){
  const p=npcAgentProfile(n),rows=ownedQuests(n),q=normalize(question);
  const fallback=(npcVoices[p.voice]?.unknown||'I do not know enough to answer that.')+' Ask about me, my services, or my current task.';
  const self=/^(who are you|what is your name|tell me about yourself|tell me about your past|what do you do|your past|about you)$/;
  const services=/^(what services do you offer|what can i buy here|can you heal me|what do you sell|your services|services)$/;
  const task=/^(what is next for your current task|what should i do next|what is my next step|what is the next step|what is your current task|what is your quest|how can i help|what work do you have|what should i do|what is left|what do i need|any advice|i am stuck|help with your quest|how is my progress|what is my progress|how much have i done|current progress|progress|next|advice)$/;
  if(self.test(q))return p.past;
  if(services.test(q)){const label=npcServiceLabel(n);return label?'Choose “'+label+'” below to discuss the service. Asking here does not buy, heal or accept anything.':'I have no service to offer here. We can still talk about who I am.';}
  const named=rows.filter(r=>normalize(r.title)===q);
  if(!task.test(q)&&!named.length)return fallback;
  const selected=named.length?named:rows;
  if(!selected.length)return 'I do not have an active task of my own to advise you on. '+(npcServiceLabel(n)==='Discuss my request'?'Use “Discuss my request” to hear what is available; asking does not accept it.':'Your Quest Journal can help with commitments you made to other people.');
  if(selected.length!==1)return 'Which of my current tasks do you mean? Ask using one exact title: '+selected.map(r=>r.title).join(' · ')+'.';
  const row=selected[0];
  // Only audited, speaker-owned guides; never use arbitrary catalog descriptions.
  if(!townQuestDefs[row.id]&&!npcStoryDefs[row.id]&&!(n.role==='huntmaster'&&row.id.startsWith('slayer_')))return 'Review that task in your Quest Journal. I do not have a more specific lead to add.';
  const g=questGuide(row);
  return row.title+'\n'+g.progress+'\n\n'+g.detail;
 }
 const beforeRender=renderNpcConversation;
 renderNpcConversation=function(...args){
  end(); rendering=true;
  try{beforeRender.apply(this,args);}finally{rendering=false;}
  const c=npcConversation;
  if(!c||c.map!==mapId||panel.hidden)return;
  const text=document.getElementById('adventureText');
  document.getElementById('npcChatForm')?.remove();
  panel.classList.add('typedNpcView');
  const footer=panel.querySelector('.screenFoot').textContent;
  panel.querySelector('.screenFoot').textContent='Offline authored answers · supported topics, not generative AI · no quest acceptance';
  const t=turn={conversation:c,npc:c.npc,key:c.key,map:mapId,slot:activeSlotId,composing:false,footer};
  const form=document.createElement('form');form.id='typedNpcForm';
  const label=document.createElement('label');label.htmlFor='typedNpcInput';label.textContent='Ask '+npcAgentProfile(c.npc).name+' a question';
  const input=document.createElement('input');input.id='typedNpcInput';input.type='text';input.maxLength=180;input.autocomplete='off';input.setAttribute('enterkeyhint','send');input.placeholder='What is next for your current task?';
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Ask';
  const feedback=document.createElement('p');feedback.id='typedNpcFeedback';feedback.setAttribute('role','status');input.setAttribute('aria-describedby',feedback.id);
  const row=document.createElement('div');row.append(input,submit);form.append(label,row,feedback);
  const topics=document.createElement('div');topics.className='typedNpcTopics';
  for(const question of ['Who are you?','What services do you offer?','What is next for your current task?']){
   const b=document.createElement('button');b.type='button';b.textContent=question;b.onclick=()=>{if(valid(t)){input.value=question;form.requestSubmit();}};topics.appendChild(b);
  }
  form.appendChild(topics);document.getElementById('adventureChoices').before(form);
  input.addEventListener('compositionstart',()=>t.composing=true);
  input.addEventListener('compositionend',()=>t.composing=false);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||t.composing||e.keyCode===229)){e.preventDefault();e.stopPropagation();}});
  form.addEventListener('submit',e=>{
   e.preventDefault();e.stopPropagation();
   if(!valid(t)||t.composing)return;
   const question=input.value.trim();
   if(!question){feedback.textContent='Type a question or choose a suggested topic.';input.focus();return;}
   if(question.length>180){feedback.textContent='Please keep your question to 180 characters.';input.focus();return;}
   voice('stop');
   const reply=answer(t.npc,question);
   // Session-only typed turn; existing authored/menu history remains unchanged.
   let block=document.getElementById('typedNpcReply');
   if(!block){block=document.createElement('section');block.id='typedNpcReply';block.setAttribute('aria-label','Latest question and answer');block.setAttribute('role','log');block.setAttribute('aria-live','polite');block.setAttribute('aria-atomic','true');text.appendChild(block);}
   block.replaceChildren();const ask=document.createElement('p'),response=document.createElement('p');ask.textContent='You: '+question;response.textContent=reply;response.style.whiteSpace='pre-wrap';block.append(ask,response);
   feedback.textContent='Answer updated.';input.value='';
   text.scrollTop=text.scrollHeight;input.focus();
   voice('speak',{speakerId:'npc:'+t.key,profile:'merchant',text:response.textContent});
  });
  t.keyHandler=function key(e){
   if(!valid(t)){panel.removeEventListener('keydown',key);return;}
   if(e.key==='Escape'&&!t.composing){e.preventDefault();e.stopPropagation();closePanel('adventureScreen');document.getElementById('optionsToggle')?.focus();}
   if(e.key==='Tab'){
    const list=[...panel.querySelectorAll('button:not([disabled]),input')].filter(el=>el.getClientRects().length),first=list[0],last=list.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };panel.addEventListener('keydown',t.keyHandler);
  viewport();
 };
 const style=document.createElement('style');style.textContent=`
 #adventureScreen.typedNpcView{height:var(--npc-view-height,100dvh);top:var(--npc-view-top,0px);bottom:auto}
 #adventureScreen.typedNpcView .screenPanel{height:calc(var(--npc-view-height,100dvh) - 16px);max-height:calc(var(--npc-view-height,100dvh) - 16px)}
 #typedNpcForm{padding:8px 14px;flex:0 0 auto;border-top:1px solid #52624d}
 #typedNpcForm label{display:block;margin-bottom:4px}#typedNpcForm>div{display:flex;gap:6px}
 #typedNpcInput{min-width:0;flex:1;font-size:16px;min-height:44px}#typedNpcForm button{min-height:44px}
 #typedNpcFeedback{font-size:12px;margin:3px 0}#typedNpcFeedback:empty{display:none}
 #typedNpcForm .typedNpcTopics{overflow:auto;max-height:50px;margin-top:5px}#typedNpcForm .typedNpcTopics button{flex:1;min-width:110px;font-size:12px}
 #adventureScreen.typedNpcView .adventureChoices{max-height:18dvh}
 @media(max-height:500px){#typedNpcForm .typedNpcTopics{display:none}#typedNpcForm{padding:4px 10px}#adventureScreen.typedNpcView .screenFoot{font-size:10px}}
 `;document.head.appendChild(style);
})();

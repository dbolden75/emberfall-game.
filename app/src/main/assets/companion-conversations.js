/* Offline authored companion conversations. No model, transport, or save schema. */
(() => {
 'use strict';
 const panel = document.getElementById('adventureScreen');
 const text = document.getElementById('adventureText');
 const choices = document.getElementById('adventureChoices');
 const voices = {
  dalen: {opening:'Let’s take stock before we move.', advice:'One task at a time. Keep our orders clear.', progress:'Count what is done before taking another step.'},
  sylvi: {opening:'Which trail are we following?', advice:'Check the route before setting out.', progress:'Let’s see how far we have come.'},
  corin: {opening:'Tell me what weighs on you.', advice:'We can take this one step at a time.', progress:'Let’s remember the work already done.'},
  eryn: {opening:'Let’s examine what we know.', advice:'Start with what the evidence tells us.', progress:'Let’s compare our progress with the task.'}
 };
 let session = null;
 function companion() {
  const party = townQuestState._humanParty, c = party?.roster?.[party.active];
  return c && c.hp > 0 && voices[c.id] ? c : null;
 }
 function currentQuests() {
  // The journal contains future rows too. Only its current, active commitments
  // may enter this conversation; never traverse the full catalog for advice.
  return journalActiveRows().filter(q => q.active && !q.done);
 }
 function guidance(q) {
  const id = q.id;
  // These guides are staged against live objective counters. Other quest types
  // stay in the journal until their disclosure rules have been audited here.
  const supported = ['camp_caller','camp_patrol','briar_hollow','main_hunt'].includes(id) ||
   !!townQuestDefs[id] || !!classGearQuests[id] ||
   (id.startsWith('recruit_') && !!humanStories[id.slice(8)]) ||
   (id.startsWith('slayer_') && !!slayerContracts[id.slice(7)]);
  if (!supported) return {detail:'Review this current commitment in the Quest Journal. I do not have a more specific lead to add.', progress:'See the Quest Journal for current progress.'};
  const g = {...questGuide(q)};
  // Recruitment's legacy guide describes the hunt even when its counter is full.
  if (id.startsWith('recruit_') && (townQuestState[id]?.kills || 0) >= 2) {
   g.detail = 'Return to Wayfarer’s Camp with '+companionDefs[id.slice(8)].name+' active. Speak with them to complete A Shared Summons.';
   g.ready = true;
  }
  return g;
 }
 function invalidate() { session = null; }
 const dialogBefore = openAdventureDialog;
 openAdventureDialog = function(...args) { invalidate(); return dialogBefore.apply(this,args); };
 const closeBefore = closePanel;
 closePanel = function(id) {
  const wasConversation = id === 'adventureScreen' && !!session;
  if (id === 'adventureScreen') invalidate();
  const result = closeBefore.call(this,id);
  if (wasConversation) {
   const target = ['companionPortraitButton','hudDetailsToggle','optionsToggle']
    .map(id => document.getElementById(id)).find(el => el && el.getClientRects().length);
   target?.focus();
  }
  return result;
 };
 function render(body, options, c = companion()) {
  openAdventureDialog(c ? companionDefs[c.id].name : 'Companion conversation', body, []);
  panel.querySelector('.screenFoot').textContent = 'Offline authored conversation · responds to current quests · no generative AI';
  panel.querySelector('.screenClose').setAttribute('aria-label','Close companion conversation');
  text.setAttribute('tabindex','-1');
  const turn = session = {id:c?.id || null, slot:activeSlotId};
  choices.replaceChildren();
  for (const [label, action] of options) {
   const button = document.createElement('button');
   button.style.minHeight = '44px';
   button.type = 'button'; button.textContent = label;
   button.onclick = () => {
    if (session !== turn || panel.hidden) return;
    if (turn.slot !== activeSlotId || turn.id !== (companion()?.id || null)) { open(); return; }
    action();
   };
   choices.appendChild(button);
  }
  // Focus the answer so keyboard/screen-reader users encounter the new turn.
  text.focus();
 }
 function open() {
  const c = companion();
  if (!c) {
   render('No active companion is available to talk. Choose or recover a companion at Wayfarer’s Camp.',[
    ['Manage companions',openHumanRoster],['Return to adventure',() => closePanel('adventureScreen')]
   ],null); return;
  }
  render(voices[c.id].opening+'\n\nWe can discuss your current commitments or what brought me here.',[
   ['What should we focus on?',() => selectQuest()],
   ['Remind me about your summons',() => render(humanStories[c.id].clue,[['Back to our conversation',open]])],
   ['Return to adventure',() => closePanel('adventureScreen')]
  ],c);
 }
 function selectQuest() {
  const rows = currentQuests(), tracked = trackedQuestId();
  rows.sort((a,b) => Number(b.id === tracked)-Number(a.id === tracked));
  render(rows.length ? 'Which commitment shall we discuss?' : 'We have no active commitments to discuss. Check the Quest Journal for paused tasks, or speak with people you meet.',[
   ...rows.map(q => [q.title+(q.id === tracked?' · Tracked':''),() => discuss(q.id,'advice')]),
   ['Back to our conversation',open]
  ]);
 }
 function discuss(id, topic) {
  // Re-resolve on every selection: no stale objectives after completion, pause,
  // a party change, a character switch, or a previous conversation.
  const q = currentQuests().find(row => row.id === id), c = companion();
  if (!c) return open();
  if (!q) return render('That commitment is no longer active. Let’s review what remains.',[['Review current commitments',selectQuest],['Back to our conversation',open]],c);
  const g = guidance(q), voice = voices[c.id];
  let reply = (voice[topic] || voice.advice)+'\n\n'+q.title+'\n';
  if (topic === 'progress') reply += g.progress+'\n\n'+(g.ready?'The objective is ready to turn in. '+g.detail:'This is our current progress. Ask about the next step when you are ready.');
  else if (topic === 'prepare') {
   const owner = humanQuestOwner(id) || (id.startsWith('recruit_') ? id.slice(8) : null);
   const notes = [];
   if (owner && owner !== c.id) notes.push('This task requires '+companionDefs[owner].name+' active. Change companions at Wayfarer’s Camp.');
   if (c.hp < c.max) notes.push('My vitality is '+Math.ceil(c.hp)+' / '+c.max+'. We can recover at Wayfarer’s Camp.');
   const d = townQuestDefs[id];
   if (d?.drop && bagCount(d.drop) < d.dropTarget) notes.push('We still need '+(d.dropTarget-bagCount(d.drop))+' '+itemDefs[d.drop].name+' for this task. Keep the required materials for delivery.');
   if (g.ready) notes.push('The objective is ready. '+g.detail);
   reply += notes.length ? notes.join('\n\n') : 'I have no additional requirement to flag. Follow the current objective: '+g.detail;
  } else reply += g.detail+'\n\n'+g.progress;
  render(reply,[
   [topic === 'progress'?'What is our next step?':'How much have we done?',() => discuss(id,topic === 'progress'?'advice':'progress')],
   ['Anything to watch for?',() => discuss(id,'prepare')],
   ['Discuss another commitment',selectQuest],['Back to our conversation',open],
   ['Return to adventure',() => closePanel('adventureScreen')]
  ],c);
 }
 const rosterBefore = openHumanRoster;
 openHumanRoster = function(...args) {
  const result = rosterBefore.apply(this,args);
  const button = document.createElement('button');
  button.style.minHeight = '44px';
   button.type = 'button'; button.textContent = 'Talk with active companion';
  button.id = 'companionConversationButton'; button.onclick = open;
  choices.prepend(button); return result;
 };
 // Scoped keyboard behavior; other story panels retain their existing behavior.
 panel.addEventListener('keydown', event => {
  if (!session || panel.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel('adventureScreen'); }
  if (event.key === 'Tab') {
   const buttons = [...panel.querySelectorAll('button:not([disabled])')].filter(b => b.getClientRects().length);
   const first = buttons[0], last = buttons[buttons.length-1];
   if (!first) return;
   if (event.shiftKey && (document.activeElement === first || document.activeElement === text)) { event.preventDefault(); last.focus(); }
   else if (!event.shiftKey && (document.activeElement === last || document.activeElement === text)) { event.preventDefault(); first.focus(); }
  }
 });
 // Deliberately text-only. Audio may wrap the existing dialog lifecycle once its
 // optional speaker/interrupt/stop contract is available; no speech dependency.
 window.ThornhavenCompanionConversation = Object.freeze({open});
})();

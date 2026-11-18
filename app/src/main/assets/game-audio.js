/* Thornhaven audio: streamed score/ambience, bounded reusable effect voices.
 * No save data, synthesis fallback, network dependency, or queued stale effects. */
(function (root) {
 'use strict';
 const defaults={effects:{volume:.75,muted:false},music:{volume:.35,muted:false},ambience:{volume:.3,muted:false}};
 function createAudio(options={}) {
  const make=options.makeAudio||(()=>new Audio());
  let storage=options.storage;try{storage=storage||root.localStorage;}catch(_){}
  const now=options.now||(()=>Date.now()), catalog=options.catalog||root.ThornhavenAudioCatalog||{};
  const prefs=JSON.parse(JSON.stringify(defaults)), voices=[], loops=[], cooldown=new Map(), failed=new Set();
  let unlocked=false, paused=true, scene='title', environment='exploration', sequence=0;
  try {
   const saved=JSON.parse(storage.getItem('thornhaven_audio_v1')||'null');
   for(const bus of Object.keys(prefs)) {
    if(saved&&saved[bus]) {const v=saved[bus].volume;if(typeof v==='number'&&Number.isFinite(v))prefs[bus].volume=Math.max(0,Math.min(1,v));prefs[bus].muted=saved[bus].muted===true;}
   }
   if(!saved){const v=storage.getItem('thornhaven_sound_volume');if(v!==null&&Number.isFinite(Number(v)))prefs.effects.volume=Math.max(0,Math.min(1,Number(v)));prefs.effects.muted=storage.getItem('emberfall_sound_effects_v1')==='off';}
  } catch (_) {}
  const level=bus=>prefs[bus].muted?0:prefs[bus].volume;
  function stop(row){row.token=++sequence;row.pending=false;row.el.pause();row.active=false;}
  function release(row){stop(row);row.el.removeAttribute('src');row.el.load();}
  function safePlay(row) {
   if(paused||!unlocked||row.pending||row.active||failed.has(row.id))return;
   const token=row.token=++sequence;row.pending=true;
   try {Promise.resolve(row.el.play()).then(()=>{
    if(row.token!==token){if(!row.pending&&!row.active)row.el.pause();return;}
    row.pending=false;if(paused){stop(row);return;}row.active=true;
   },error=>{if(row.token!==token)return;row.pending=false;row.active=false;if(error&&error.name==='NotSupportedError')failed.add(row.id);});}
   catch(_){row.pending=false;row.active=false;}
  }
  function rowFor(id,bus,loop){
   const spec=catalog[id];if(!spec||failed.has(id))return null;
   const el=make();el.preload=loop?'metadata':'auto';el.loop=loop;el.src=spec.src;
   const row={id,bus,el,token:0,pending:false,active:false,mix:0,target:1,gain:spec.gain===undefined?1:spec.gain};
   el.addEventListener('error',()=>{failed.add(row.id);stop(row);});
   el.addEventListener('ended',()=>{row.active=false;});return row;
  }
  function desired(){return {music:scene==='combat'?'combat':scene==='dungeon'?'dungeon':scene==='town'||scene==='title'?'town':'exploration',ambience:scene==='title'?null:environment==='dungeon'?'tomb':'forest'};}
  function reconcile(){
   if(!unlocked||paused)return;
   const wanted=desired();
   for(const bus of ['music','ambience']){
    const id=level(bus)>0?wanted[bus]:null;
    for(const row of loops.filter(r=>r.bus===bus))row.target=row.id===id?1:0;
    if(id&&!loops.some(r=>r.bus===bus&&r.id===id)){
     // At most two streams per bus, even under rapid scene changes.
     const old=loops.filter(r=>r.bus===bus);if(old.length>=2){const victim=old.find(r=>r.target===0)||old[0];release(victim);loops.splice(loops.indexOf(victim),1);}
     const row=rowFor(id,bus,true);if(row){row.el.volume=0;loops.push(row);safePlay(row);}
    }
   }
  }
  function tick(){
   if(paused)return;
   for(const row of [...loops]){
    row.mix+=Math.max(-.08,Math.min(.08,row.target-row.mix));
    row.el.volume=Math.max(0,Math.min(1,level(row.bus)*row.gain*row.mix));
    if(row.target===0&&row.mix<=.001){release(row);loops.splice(loops.indexOf(row),1);}
   }
  }
  function set(bus,change){
   if(!prefs[bus])return;
   if(typeof change.volume==='number'&&Number.isFinite(change.volume))prefs[bus].volume=Math.max(0,Math.min(1,change.volume));
   if(typeof change.muted==='boolean')prefs[bus].muted=change.muted;
   try{storage.setItem('thornhaven_audio_v1',JSON.stringify(prefs));if(bus==='effects'){storage.setItem('thornhaven_sound_volume',String(prefs.effects.volume));storage.setItem('emberfall_sound_effects_v1',prefs.effects.muted?'off':'on');}}catch(_){}
   for(const row of [...voices,...loops]){row.el.volume=Math.max(0,Math.min(1,level(row.bus)*row.gain*(row.bus==='effects'?1:row.mix)));if(!level(row.bus))stop(row);}
   reconcile();for(const row of loops)if(row.target&&level(row.bus))safePlay(row);
  }
  function effect(id){
   if(!unlocked||paused||!level('effects')||!catalog[id]||failed.has(id))return false;
   const time=now(),delay=id==='step'?220:70;if(time-(cooldown.get(id)??-Infinity)<delay)return false;cooldown.set(id,time);
   let row=voices.find(r=>r.id===id&&!r.active&&!r.pending);
   if(!row){if(voices.length>=8){row=voices.find(r=>!r.active&&!r.pending);if(!row)return false;release(row);voices.splice(voices.indexOf(row),1);}row=rowFor(id,'effects',false);if(!row)return false;voices.push(row);}
   try{row.el.currentTime=0;}catch(_){return false;}row.el.volume=Math.min(1,level('effects')*row.gain);safePlay(row);return true;
  }
  function pause(){paused=true;for(const row of [...voices,...loops])stop(row);cooldown.clear();}
  function resume(){paused=false;reconcile();for(const row of loops)if(row.target&&level(row.bus))safePlay(row);}
  function unlock(){unlocked=true;resume();}
  function setScene(value,place=value){if(!['title','town','exploration','dungeon','combat'].includes(value))return;if(scene!==value||environment!==place){scene=value;environment=place;reconcile();}}
  return {effect,set,pause,resume,unlock,setScene,tick,preferences:()=>JSON.parse(JSON.stringify(prefs)),status:()=>({unlocked,paused,scene,voices:voices.length,loops:loops.length,failed:[...failed]})};
 }
 root.ThornhavenCreateAudio=createAudio;
 if(typeof module!=='undefined'&&module.exports)module.exports=createAudio;
})(typeof window!=='undefined'?window:globalThis);

/* Native Android offline device speech. No Web Speech, network or generated models. */
(function(root){
 'use strict';
 function create(options={}){
  const bridge=options.bridge||root.ThornhavenNativeVoice;
  let storage=options.storage;try{storage=storage||root.localStorage;}catch(_){}
  let pref={volume:.85,muted:false},active=true,generation=0;
  try{const p=JSON.parse(storage.getItem('thornhaven_voice_v1')||'null');if(p){if(typeof p.volume==='number'&&Number.isFinite(p.volume))pref.volume=Math.max(0,Math.min(1,p.volume));pref.muted=p.muted===true;}}catch(_){}
  function status(){try{return bridge&&typeof bridge.status==='function'?String(bridge.status()):'unavailable';}catch(_){return 'unavailable';}}
  function stop(){generation++;try{if(bridge)bridge.stop();}catch(_){} }
  function speak({speakerId,profile='merchant',text}={}){
   stop();
   if(!active||pref.muted||pref.volume===0||typeof speakerId!=='string'||!speakerId||speakerId.length>120||typeof text!=='string'||!text.trim()||text.length>3500||status()!=='ready')return false;
   try{bridge.speak(speakerId,['merchant','carpenter','courier'].includes(profile)?profile:'merchant',text,pref.volume);return true;}catch(_){return false;}
  }
  function set(change){stop();if(typeof change.volume==='number'&&Number.isFinite(change.volume))pref.volume=Math.max(0,Math.min(1,change.volume));if(typeof change.muted==='boolean')pref.muted=change.muted;try{storage.setItem('thornhaven_voice_v1',JSON.stringify(pref));}catch(_){} }
  function suspend(){active=false;stop();}
  function resume(){active=true;} // Never replay stale dialogue automatically.
  return {speak,stop,set,suspend,resume,status,generation:()=>generation,preferences:()=>({...pref})};
 }
 root.ThornhavenCreateVoice=create;
 if(typeof module!=='undefined'&&module.exports)module.exports=create;
})(typeof window!=='undefined'?window:globalThis);

/* Runs after the game and its presentation extensions. Audio never drives simulation. */
(function(){
 'use strict';
 const audio=window.ThornhavenAudio=window.ThornhavenCreateAudio();
 let hidden=document.hidden, departed=false, blurred=false, combatUntil=0, lastSceneMap=null;
 function active(){return !hidden&&!departed&&!blurred;}
 function resume(){if(active())audio.resume();else audio.pause();}
 document.addEventListener('visibilitychange',()=>{hidden=document.hidden;resume();});
 window.addEventListener('pagehide',()=>{departed=true;audio.pause();});
 window.addEventListener('pageshow',()=>{departed=false;blurred=false;hidden=document.hidden;resume();});
 window.addEventListener('blur',()=>{blurred=true;audio.pause();});
 window.addEventListener('focus',()=>{blurred=false;resume();});
 for(const type of ['pointerdown','keydown'])document.addEventListener(type,event=>{
  if(event.isTrusted&&active())audio.unlock();
 },{capture:true,passive:true});
 // Preserve the established effects controls and keys; add independent buses.
 const volume=document.getElementById('soundVolume'),toggle=document.getElementById('soundToggle');
 volume.addEventListener('input',()=>audio.set('effects',{volume:Number(volume.value)/100}));
 toggle.addEventListener('click',()=>audio.set('effects',{muted:!soundEnabled}));
 const effects=audio.preferences().effects;soundEnabled=!effects.muted;soundVolume=effects.volume;
 volume.value=String(Math.round(soundVolume*100));document.getElementById('soundVolumeValue').textContent=volume.value+'%';updateSoundButton();
 const container=document.getElementById('audioSettings');
 for(const bus of ['music','ambience']){
  const pref=audio.preferences()[bus],name=bus==='music'?'Music':'Ambience';
  const label=document.createElement('label'),out=document.createElement('output'),slider=document.createElement('input'),button=document.createElement('button');
  slider.id='audio-'+bus;slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.value=String(Math.round(pref.volume*100));slider.style.cssText='width:100%;min-height:44px;accent-color:#edc874';
  label.htmlFor=slider.id;label.className='optionsLabel';label.textContent=name+' volume ';label.appendChild(out);button.type='button';
  const paint=()=>{out.textContent=slider.value+'%';const muted=audio.preferences()[bus].muted;button.textContent=name+': '+(muted?'OFF':'ON');button.setAttribute('aria-pressed',String(!muted));};
  slider.addEventListener('input',()=>{audio.set(bus,{volume:Number(slider.value)/100});paint();});
  button.addEventListener('click',()=>{audio.set(bus,{muted:!audio.preferences()[bus].muted});paint();});
  container.append(label,slider,button);paint();
 }
 document.addEventListener('click',event=>{const b=event.target.closest&&event.target.closest('button');if(b&&!b.disabled&&b.id!=='attack'&&b.id!=='skillButton')audio.effect('menu');});
 function scene(){
  if(!active())return;
  const current=typeof mapId==='string'?mapId:null;
  if(lastSceneMap!==current){lastSceneMap=current;combatUntil=0;}
  if(!hasStarted||titleMenuActive){combatUntil=0;audio.setScene('title');return;}
  const safe=activeMap.town||activeMap.interior;
  // Real proximity/windup plus a release tail avoids rapid score switching.
  if(!safe&&combatReady()&&enemies.some(e=>e.alive&&Math.hypot(e.x-player.x,e.y-player.y)<240&&(e.windup>0||e.attack>0||e.hitTime>0||player.attack>0)))combatUntil=Date.now()+6500;
  const place=safe?'town':activeMap.dungeon||mapId==='emberdeep'||mapId==='mosslight'?'dungeon':'exploration';
  audio.setScene(!safe&&Date.now()<combatUntil?'combat':place,place);
 }
 setInterval(()=>{scene();audio.tick();},100);
})();

'use strict';
const assert=require('node:assert/strict');
const create=require('../app/src/main/assets/game-audio.js');
(async()=>{
 let time=1000,mode='ok',made=[];const data={};
 const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v};
 class Media{
  constructor(){this.events={};this.paused=true;this.volume=1;made.push(this);}
  addEventListener(k,fn){this.events[k]=fn;} removeAttribute(){this.src='';}load(){}
  play(){this.plays=(this.plays||0)+1;this.paused=false;if(mode==='blocked')return Promise.reject({name:'NotAllowedError'});if(mode==='deferred')return new Promise(r=>this.resolve=r);return Promise.resolve();}
  pause(){this.paused=true;}
 }
 const catalog=Object.fromEntries(['step','hit','spell','town','combat','dungeon','exploration','forest','tomb'].map(id=>[id,{src:id+'.ogg',gain:.8}]));
 const audio=create({makeAudio:()=>new Media(),storage,now:()=>time,catalog});
 const flush=()=>new Promise(r=>setImmediate(r));
 assert.equal(audio.effect('step'),false);assert.equal(made.length,0);
 mode='blocked';audio.unlock();await flush();assert.equal(audio.status().loops,1);
 const town=made[0];assert.equal(town.plays,1);audio.tick();assert.equal(town.plays,1,'No automatic blocked-play retry storm');
 mode='ok';audio.unlock();await flush();assert.equal(town.plays,2,'Next gesture retries');
 assert.equal(audio.effect('step'),true);assert.equal(audio.effect('step'),false);await flush();time+=300;assert.equal(audio.effect('step'),true,'Repeated effects may overlap');await flush();
 for(let i=0;i<30;i++){time+=100;audio.effect('hit');}assert.ok(audio.status().voices<=8);
 audio.set('effects',{volume:0});assert.equal(audio.effect('hit'),false);assert.ok(made.filter(m=>['hit.ogg','step.ogg'].includes(m.src)).every(m=>m.paused&&m.volume===0));
 audio.set('music',{volume:0});assert.equal(town.volume,0);assert.ok(town.paused);
 audio.set('music',{volume:.5});audio.set('ambience',{muted:true});assert.equal(audio.preferences().ambience.muted,true);
 const saved=create({makeAudio:()=>new Media(),storage,catalog});assert.equal(saved.preferences().music.volume,.5);assert.equal(saved.preferences().effects.volume,0);assert.equal(saved.preferences().ambience.muted,true);
 audio.set('effects',{volume:.6});audio.set('ambience',{muted:false});
 for(const scene of ['combat','exploration','dungeon','town','combat','dungeon']){audio.setScene(scene);audio.tick();assert.ok(audio.status().loops<=4);}
 await flush();for(let i=0;i<35;i++)audio.tick();assert.equal(audio.status().loops,2);
 audio.pause();assert.ok(made.every(m=>m.paused));assert.equal(audio.effect('spell'),false);audio.resume();await flush();assert.equal(audio.status().paused,false);
 assert.equal(audio.effect('not-found'),false);audio.effect('spell');const spell=made.find(m=>m.src==='spell.ogg');spell.events.error();time+=1000;assert.equal(audio.effect('spell'),false,'Failed asset is not retried every frame');
 mode='deferred';time+=300;audio.effect('hit');const pending=made.findLast(m=>m.resolve);audio.pause();pending.resolve();await flush();assert.ok(pending.paused,'Late play resolution cannot restart after pause');
 const broken=create({makeAudio:()=>new Media(),storage:{getItem(){throw Error('blocked')},setItem(){throw Error('quota')}},catalog});broken.set('effects',{volume:0});assert.equal(broken.preferences().effects.volume,0);
 audio.set('music',{volume:NaN});assert.equal(audio.preferences().music.volume,.5);
 mode='ok';const cross=create({makeAudio:()=>new Media(),storage:{getItem:()=>null,setItem(){}},now:()=>time,catalog});
 cross.set('ambience',{muted:true});cross.unlock();await flush();for(let i=0;i<35;i++)cross.tick();
 const outgoing=made.at(-1),before=outgoing.volume;mode='deferred';cross.setScene('exploration');const incoming=made.at(-1);
 for(let i=0;i<35;i++)cross.tick();assert.equal(outgoing.volume,before,'Outgoing stays audible until incoming starts');assert.equal(incoming.volume,0);
 incoming.resolve();await flush();cross.tick();assert.ok(outgoing.volume>0&&incoming.volume>0,'Both streams overlap');
 for(let i=0;i<35;i++)cross.tick();assert.ok(outgoing.paused);assert.equal(cross.status().loops,1);
 incoming.duration=10;incoming.currentTime=7.1;cross.tick();const restart=made.at(-1);assert.notEqual(restart,incoming);assert.equal(restart.src,incoming.src);
 restart.resolve();await flush();for(let i=0;i<35;i++)cross.tick();assert.ok(incoming.paused);assert.equal(cross.status().loops,1,'Loop handoff remains bounded');
 time+=1000;cross.effect('hit');const delayed=made.at(-1);time+=301;delayed.resolve();await flush();assert.ok(delayed.paused,'Expired effect cannot sound after delayed decode');cross.pause();
 console.log('PASS audio: gesture retry, repeated events, voice/stream bounds, zero/mutes, preferences/storage failure, absent/broken assets, late play, pause/resume and scene transitions');
})().catch(e=>{console.error(e);process.exitCode=1;});

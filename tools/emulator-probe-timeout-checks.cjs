#!/usr/bin/env node
'use strict';
// Exercise the real DevTools transport with a fake clock/socket, not a real
// emulator. Android CI must still verify the complete preference matrix.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/emulator-webview-probe.cjs','utf8');
const transport=source.slice(source.indexOf('async function session('),source.indexOf('const create='));
const budget=source.match(/evaluate\(scripts\[phase\],([^\n]+)\)\);/);
assert(budget,'Phase-specific deadline must be passed to the real evaluator');
const deadline=phase=>vm.runInNewContext(budget[1],{phase});
assert.equal(deadline('control-preferences'),45000);
assert.equal(deadline('orientation-controls'),15000);
assert.equal(deadline('verify'),15000);

async function fixture(phase){
  let now=0,nextTimer=0,socket;
  const timers=new Map();
  class Socket{
    constructor(){socket=this;this.listeners=new Map();queueMicrotask(()=>this.emit('open',{}));}
    addEventListener(type,fn,options){
      if(!this.listeners.has(type))this.listeners.set(type,new Map());
      this.listeners.get(type).set(fn,options);
    }
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    emit(type,event){
      for(const [fn,options] of [...(this.listeners.get(type)||[])]){
        if(options?.once)this.removeEventListener(type,fn);
        fn(event);
      }
    }
    send(text){this.sent=JSON.parse(text);}
    answer(result){this.emit('message',{data:JSON.stringify({id:this.sent.id,result})});}
  }
  const session=vm.runInNewContext(transport+'\nsession',{
    URL,WebSocket:Socket,phase,
    setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id;},
    clearTimeout(id){timers.delete(id);}
  });
  const api=await session('ws://localhost/devtools/page/test');
  return {api,socket,timers,advance(ms){
    now+=ms;
    for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}
  }};
}

(async()=>{
  const normal=await fixture('verify');
  const normalFailure=assert.rejects(normal.api.evaluate('pending'),/15000ms \(verify\)/);
  normal.advance(15000);await normalFailure;
  assert.equal(normal.socket.listeners.get('message').size,0);

  const matrix=await fixture('control-preferences');
  let settled=false;
  const result=matrix.api.evaluate('matrix',deadline('control-preferences')).finally(()=>{settled=true;});
  matrix.advance(20000);await Promise.resolve();
  assert.equal(settled,false,'A valid matrix may outlive the old 15s deadline');
  matrix.socket.answer({result:{value:'matrix passed'}});
  assert.equal(await result,'matrix passed');
  assert.equal(matrix.timers.size,0);
  assert.equal(matrix.socket.sent.params.awaitPromise,true);

  const hung=await fixture('control-preferences');
  const hungFailure=assert.rejects(hung.api.evaluate('hung',45000),/45000ms \(control-preferences\)/);
  hung.advance(45000);await hungFailure;
  assert.equal(hung.socket.listeners.get('message').size,0);

  const fault=await fixture('control-preferences');
  const faultFailure=assert.rejects(fault.api.evaluate('fault',45000),/game assertion failed/);
  fault.socket.answer({exceptionDetails:{exception:{description:'game assertion failed'}}});
  await faultFailure;
  assert.equal(fault.timers.size,0);
  console.log('PASS emulator probe deadlines: default 15s, delayed matrix, bounded 45s, cleanup, assertion propagation');
})().catch(error=>{console.error(error);process.exitCode=1;});

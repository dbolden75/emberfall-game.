#!/usr/bin/env node
// Execute the real production Android Back handler using a fake WebView.
// Also execute its embedded JavaScript save confirmation. No device is claimed.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/MainActivity.java','utf8');
const at=src.indexOf('public void onBackPressed()');
assert(at>=0,'Android Back override missing');
const open=src.indexOf('{',at);
let depth=0,end=-1;
for(let i=open;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&--depth===0){end=i+1;break;}}
assert(end>open,'Unbalanced Back handler');
const method=src.slice(at,end);
assert(method.includes('backSaveFailed(closingView)'),'Back must stay open after unverified save');
assert(method.includes('1500'),'Missing bounded callback timeout');
assert(src.includes('backExitPending = false; // A later Back can retry'),'Back must be retryable');
const call=method.match(/closingView\.evaluateJavascript\(\s*([\s\S]*?),\s*result\s*->/);
assert(call,'Missing JavaScript save confirmation');
const saveScript=Function('return '+call[1])();
assert(saveScript.includes('snapshotGameState()')&&saveScript.includes('saveGame()')&&saveScript.includes('SAVE_SLOTS_KEY')&&saveScript.includes('JSON.stringify(row.state)'),'Must verify authoritative saved character state, not merely event completion');
function runSave({write=true,hasStarted=true,titleMenuActive=false,switchingCharacter=false,throwSave=false}={}){
 const state={player:{name:'Save Tester',level:8},townQuestState:{someQuest:true},mapId:'ashvale'};
 let raw=null;
 const env={hasStarted,titleMenuActive,switchingCharacter,SAVE_SLOTS_KEY:'slots',activeSlotId:'slot1',
  snapshotGameState:()=>JSON.parse(JSON.stringify(state)),
  saveGame:()=>{if(throwSave)throw Error('quota exceeded');if(write)raw=JSON.stringify({slot1:{state}});},
  localStorage:{getItem:()=>raw},JSON};
 return vm.runInNewContext(saveScript,env);
}
assert.equal(runSave(),true,'Committed character state permits exit');
assert.equal(runSave({write:false}),false,'Silent failed write prevents exit');
assert.equal(runSave({throwSave:true}),false,'Throwing failed write prevents exit');
assert.equal(runSave({switchingCharacter:true}),false,'Character switch prevents exit');
assert.equal(runSave({hasStarted:false}),true,'Empty menu can exit');
assert.equal(runSave({titleMenuActive:true}),true,'Title menu can exit');
const java=`
import java.util.function.Consumer;
class BackBase {int finishes;public void onBackPressed(){finish();}void finish(){finishes++;}}
public class ThornhavenBackNavigationHarness extends BackBase {
 static class WebView {
  boolean history,failEvaluate;int backCalls,saveRequests;Consumer<String> callback;Runnable fallback;
  boolean canGoBack(){return history;}
  void goBack(){backCalls++;}
  void evaluateJavascript(String script,Consumer<String> cb){
   if(failEvaluate)throw new IllegalStateException("WebView evaluation unavailable");
   if(!script.contains("snapshotGameState()")||!script.contains("SAVE_SLOTS_KEY"))throw new AssertionError("No durable save verification");
   saveRequests++;callback=cb;
  }
  void postDelayed(Runnable run,long millis){if(millis!=1500)throw new AssertionError("Unexpected timeout");fallback=run;}
 }
 WebView game;boolean backExitPending;int warnings;
 void backSaveFailed(WebView view){if(game!=view)return;warnings++;backExitPending=false;}
 ${method}
 static void check(boolean ok,String msg){if(!ok)throw new AssertionError(msg);}
 public static void main(String[] args){
  ThornhavenBackNavigationHarness h=new ThornhavenBackNavigationHarness();h.game=new WebView();
  h.onBackPressed();check(h.finishes==0&&h.game.saveRequests==1&&h.game.callback!=null,"Back waits for verified save");
  h.onBackPressed();check(h.game.saveRequests==1,"Repeated Back cannot duplicate in-flight save");
  h.game.callback.accept("true");check(h.finishes==1&&h.warnings==0,"Confirmed save exits");
  h.game.fallback.run();check(h.finishes==1,"Timeout after callback cannot double-finish");
  h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.onBackPressed();
  h.game.callback.accept("false");check(h.finishes==0&&h.warnings==1&&!h.backExitPending,"Failed save keeps game open and allows retry");
  h.onBackPressed();check(h.game.saveRequests==2,"User can retry failed save");
  h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.onBackPressed();
  h.game.fallback.run();check(h.finishes==0&&h.warnings==1&&!h.backExitPending,"Missing callback must never presume saved");
  h.game.callback.accept("true");check(h.finishes==0,"Late callback after timeout must never exit");
  h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.game.history=true;h.onBackPressed();
  check(h.game.backCalls==1&&h.game.saveRequests==0&&h.finishes==0,"WebView history preserved");
  h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.game.failEvaluate=true;h.onBackPressed();
  check(h.finishes==0&&h.warnings==1&&!h.backExitPending,"JavaScript exception keeps game open");
  h=new ThornhavenBackNavigationHarness();h.onBackPressed();check(h.finishes==1,"No WebView can exit");
  h=new ThornhavenBackNavigationHarness();h.game=new WebView();WebView previous=h.game;h.onBackPressed();h.game=new WebView();
  previous.callback.accept("true");previous.fallback.run();check(h.finishes==0,"Replaced WebView cannot be closed by stale callback");
  System.out.println("PASS: verified Back save, refusal on quota/storage failure, timeout retry, stale callbacks and navigation. Mock WebView, not device.");
 }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-back-confirm-'));
try{
 const file=path.join(dir,'ThornhavenBackNavigationHarness.java');fs.writeFileSync(file,java);
 for(const [bin,args] of [['javac',['-encoding','UTF-8','-d',dir,file]],['java',['-cp',dir,'ThornhavenBackNavigationHarness']]]){
  const result=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,bin+' failed: '+(result.stderr||result.stdout||result.error));
  if(result.stdout)process.stdout.write(result.stdout);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}

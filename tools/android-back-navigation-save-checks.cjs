#!/usr/bin/env node
// Execute the actual production Android Back handler with fake WebView callbacks.
// This checks save/exit ordering; it is not an emulator or physical-device test.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const src = fs.readFileSync('app/src/main/java/com/emberfall/ashvale/MainActivity.java', 'utf8');
const marker = 'public void onBackPressed()';
const at = src.indexOf(marker);
assert(at >= 0, 'Missing Android Back override');
const open = src.indexOf('{', at);
let depth = 0, end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
}
assert(end > open, 'Unbalanced Back override');
const method = src.slice(at, end);
assert(method.includes("window.dispatchEvent(new Event('pagehide'))"),
       'Back exit must request the durable character-save event');
const java = `
import java.util.function.Consumer;
class BackBase {int finishes;public void onBackPressed(){finish();}void finish(){finishes++;}}
public class ThornhavenBackNavigationHarness extends BackBase {
 static class WebView {
   boolean history, failEvaluate;int backCalls, saveRequests;Consumer<String> callback;Runnable fallback;
   boolean canGoBack(){return history;}
   void goBack(){backCalls++;}
   void evaluateJavascript(String script, Consumer<String> cb){
     if(failEvaluate)throw new IllegalStateException("failed WebView evaluate");
     if(!script.contains("pagehide"))throw new AssertionError("No save event dispatched");
     saveRequests++;callback=cb;
   }
   void postDelayed(Runnable r,long delay){if(delay!=1000)throw new AssertionError("Unexpected timeout"); fallback=r;}
 }
 WebView game; boolean backExitPending;
 ${method}
 static void check(boolean condition,String name){if(!condition)throw new AssertionError(name);}
 public static void main(String[] args){
   ThornhavenBackNavigationHarness h=new ThornhavenBackNavigationHarness();h.game=new WebView();
   h.onBackPressed();
   check(h.finishes==0 && h.game.saveRequests==1 && h.game.callback!=null && h.game.fallback!=null,"Exit waits for save callback");
   h.onBackPressed();check(h.game.saveRequests==1,"Repeated Back must not dispatch a second exit");
   h.game.callback.accept("undefined");check(h.finishes==1,"Save completion exits Activity");
   h.game.fallback.run();check(h.finishes==1,"Fallback after callback cannot double-finish");
   h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.onBackPressed();
   h.game.fallback.run();check(h.finishes==1,"Missing WebView callback eventually exits");
   h.game.callback.accept("undefined");check(h.finishes==1,"Late save callback cannot double-finish");
   h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.game.history=true;h.onBackPressed();
   check(h.finishes==0 && h.game.backCalls==1 && h.game.saveRequests==0,"WebView history is preserved");
   h=new ThornhavenBackNavigationHarness();h.game=new WebView();h.game.failEvaluate=true;h.onBackPressed();
   check(h.finishes==1,"Failed JS dispatch cannot trap user in Activity");
   h=new ThornhavenBackNavigationHarness();h.onBackPressed();check(h.finishes==1,"Absent WebView exits safely");
   h=new ThornhavenBackNavigationHarness();h.game=new WebView();WebView old=h.game;h.onBackPressed();h.game=new WebView();
   old.callback.accept("undefined");old.fallback.run();check(h.finishes==0,"Destroyed/replaced WebView cannot finish replacement Activity");
   System.out.println("PASS: Android Back save ordering, timeout, duplicate, history and failure regression scenarios (mock WebView; no device)");
 }
}
`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thornhaven-back-'));
try {
  const file = path.join(dir, 'ThornhavenBackNavigationHarness.java');
  fs.writeFileSync(file, java);
  for (const [bin,args] of [
      ['javac',['-encoding','UTF-8','-d',dir,file]],
      ['java',['-cp',dir,'ThornhavenBackNavigationHarness']]]) {
    const result = cp.spawnSync(bin, args, {encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,bin+' failed: '+(result.stderr||result.stdout||result.error));
    if (result.stdout) process.stdout.write(result.stdout);
  }
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

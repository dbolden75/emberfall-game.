#!/usr/bin/env node
'use strict';
// Executes the *production* CloudSaveDocuments.onActivityResult method in a
// deterministic Java harness, not a source-text ordering assertion. The Android
// picker and a real document provider remain covered separately by emulator QA.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const source=fs.readFileSync('app/src/main/java/com/emberfall/ashvale/CloudSaveDocuments.java','utf8');
assert.equal((source.match(/startActivityForResult\(intent, pending\.requestCode\);/g)||[]).length,2,
  'Both Android document-picker launches must use the unique pending request code');
const marker='boolean onActivityResult(int requestCode, int resultCode, Intent data)';
const start=source.indexOf(marker);
assert(start>=0,'Production Android document-picker callback is missing');
const brace=source.indexOf('{',start);let depth=0,end=-1;
for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&--depth===0){end=i+1;break;}
}
assert(end>brace,'Production picker callback has unbalanced braces');
const production=source.slice(start,end);
const java=`package com.emberfall.ashvale;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public final class CloudPickerCallbackHarness {
  static final int CREATE_DOCUMENT_REQUEST=7193,OPEN_DOCUMENT_REQUEST=7194;
  static final int REQUEST_CODE_GENERATIONS=12000;
  static final int MAX_BYTES=8*1024*1024;
  static class Uri {}
  static class Intent {
    final Uri uri;
    Intent(Uri u){uri=u;}
    Uri getData(){return uri;}
  }
  static class Resolver {
    byte[] stored=new byte[0];
    boolean corruptRead,failRead,failWrite;
    OutputStream openOutputStream(Uri uri,String mode) throws IOException {
      if(failWrite)throw new IOException("Synthetic provider write failure");
      return new ByteArrayOutputStream(){
        @Override public void close() throws IOException {super.close();stored=toByteArray();}
      };
    }
    InputStream openInputStream(Uri uri) throws IOException {
      if(failRead)throw new IOException("Synthetic provider read failure");
      byte[] content=stored.clone();
      if(corruptRead&&content.length>0)content[0]^=1;
      return new ByteArrayInputStream(content);
    }
  }
  static class Activity {
    static final int RESULT_OK=-1;
    final Resolver resolver=new Resolver();
    Resolver getContentResolver(){return resolver;}
    void runOnUiThread(Runnable task){task.run();}
  }
  static class Worker {
    Runnable queued;
    int submissions;
    boolean reject;
    void execute(Runnable task){
      submissions++;
      if(reject)throw new IllegalStateException("Executor closed");
      if(queued!=null)throw new AssertionError("Two documents submitted concurrently");
      queued=task;
    }
    void finish(){
      if(queued==null)throw new AssertionError("No queued document I/O");
      Runnable task=queued;queued=null;task.run();
    }
  }
  static class Pending {
    final String id,action;
    final byte[] bytes;
    final int requestCode;
    Pending(String id,String action,byte[] bytes){
      this(id,action,bytes,"save".equals(action)?CREATE_DOCUMENT_REQUEST:OPEN_DOCUMENT_REQUEST);
    }
    Pending(String id,String action,byte[] bytes,int requestCode){
      this.id=id;this.action=action;this.bytes=bytes;this.requestCode=requestCode;
    }
  }
  final Activity activity=new Activity();
  final Worker io=new Worker();
  boolean closed,documentIoActive;
  Pending pending;
  int callbackCount;
  String callbackId,callbackAction,callbackMessage,callbackText;
  boolean callbackOk,callbackCancelled;
  void result(String id,String action,boolean ok,boolean cancelled,String message,String text){
    if(closed)return;
    callbackCount++;callbackId=id;callbackAction=action;
    callbackOk=ok;callbackCancelled=cancelled;
    callbackMessage=message;callbackText=text;
  }
  void finishDocument(Pending req,boolean ok,String message,String text){
    activity.runOnUiThread(()->{
      documentIoActive=false;
      result(req.id,req.action,ok,false,message,text);
    });
  }
  ${production}
  static void check(boolean ok,String what){if(!ok)throw new AssertionError(what);}
  static Intent selected(){return new Intent(new Uri());}
  static CloudPickerCallbackHarness saving(){
    CloudPickerCallbackHarness h=new CloudPickerCallbackHarness();
    h.pending=new Pending("export_1","save","{\\"hero\\":\\"Éryn\\"}".getBytes(StandardCharsets.UTF_8));
    return h;
  }
  static CloudPickerCallbackHarness loading(){
    CloudPickerCallbackHarness h=new CloudPickerCallbackHarness();
    h.pending=new Pending("import_1","load",null);
    return h;
  }
  public static void main(String[] args){
    CloudPickerCallbackHarness h=saving();
    Pending active=h.pending;
    check(!h.onActivityResult(5678,Activity.RESULT_OK,selected()),
        "Unrelated Android callbacks must be handed back to Activity");
    check(h.pending==active&&h.io.submissions==0&&h.callbackCount==0,
        "Unrelated callback may not consume a pending save");

    h=saving();active=h.pending;
    check(h.onActivityResult(OPEN_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "The stale load result is a Thornhaven result and must be consumed");
    check(h.pending==active&&!h.documentIoActive&&h.io.submissions==0&&h.callbackCount==0,
        "A delayed LOAD callback cannot clear or write a newer SAVE request");
    check(h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "The matching SAVE response should be accepted");
    check(h.pending==null&&h.documentIoActive&&h.io.submissions==1&&h.callbackCount==0,
        "A matching SAVE should queue precisely one asynchronous write");
    h.io.finish();
    check(!h.documentIoActive&&h.callbackCount==1&&h.callbackOk,
        "Verified export must complete after the document worker finishes");
    check(Arrays.equals(h.activity.resolver.stored,active.bytes),
        "Exported document must contain exact backup UTF-8 bytes");

    // Older CREATE responses must not overwrite the document for another SAVE.
    h=saving();
    active=new Pending("export_2","save","fresh save".getBytes(StandardCharsets.UTF_8),
        CREATE_DOCUMENT_REQUEST+2);
    h.pending=active;
    check(h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "Old SAVE result should be consumed as stale");
    check(h.pending==active&&h.io.submissions==0&&h.callbackCount==0,
        "Old SAVE may not consume another SAVE");
    check(h.onActivityResult(CREATE_DOCUMENT_REQUEST+2,Activity.RESULT_OK,selected()),
        "New-generation SAVE must be handled");
    h.io.finish();
    check(h.callbackOk&&Arrays.equals(h.activity.resolver.stored,active.bytes),
        "New-generation SAVE writes its selected data");

    h=loading();active=h.pending;
    check(h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "Stale CREATE result should be handled without affecting LOAD");
    check(h.pending==active&&h.io.submissions==0&&h.callbackCount==0,
        "A delayed SAVE callback cannot consume newer LOAD request");
    h.activity.resolver.stored="{\\"name\\":\\"Sylvi\\"}".getBytes(StandardCharsets.UTF_8);
    check(h.onActivityResult(OPEN_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "Matching LOAD response should be handled");
    check(h.documentIoActive&&h.pending==null,"LOAD worker must be pending until read");
    h.io.finish();
    check(h.callbackOk&&!h.callbackCancelled&&h.callbackText.equals("{\\"name\\":\\"Sylvi\\"}"),
        "A selected UTF-8 document must be returned without altering its content");

    // Older OPEN responses must not import the wrong file for another LOAD.
    h=loading();
    active=new Pending("import_2","load",null,OPEN_DOCUMENT_REQUEST+2);
    h.pending=active;
    check(h.onActivityResult(OPEN_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "Old LOAD result should be consumed as stale");
    check(h.pending==active&&h.io.submissions==0&&h.callbackCount==0,
        "Old LOAD may not consume another LOAD");
    h.activity.resolver.stored="fresh load".getBytes(StandardCharsets.UTF_8);
    check(h.onActivityResult(OPEN_DOCUMENT_REQUEST+2,Activity.RESULT_OK,selected()),
        "New-generation LOAD must be handled");
    h.io.finish();
    check(h.callbackOk&&"fresh load".equals(h.callbackText),
        "New-generation LOAD must return only its selected document");

    h=saving();active=h.pending;
    check(h.onActivityResult(CREATE_DOCUMENT_REQUEST,0,null),"Cancelled SAVE should be handled");
    check(h.pending==null&&!h.documentIoActive&&h.io.submissions==0
        &&h.callbackCount==1&&h.callbackCancelled&&!h.callbackOk,
        "Cancel must notify its own request without writing a document");

    h=loading();
    check(h.onActivityResult(OPEN_DOCUMENT_REQUEST,Activity.RESULT_OK,null),
        "Missing document data must be handled like cancellation");
    check(h.callbackCount==1&&h.callbackCancelled&&h.io.submissions==0,
        "Missing Intent cannot trigger a document operation");

    h=saving();h.activity.resolver.corruptRead=true;
    h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected());h.io.finish();
    check(h.callbackCount==1&&!h.callbackOk&&!h.documentIoActive
        &&h.callbackMessage.contains("could not be verified"),
        "Provider read-back mismatch must not claim backup success");

    h=loading();h.activity.resolver.stored=new byte[]{(byte)0xc3,(byte)0x28};
    h.onActivityResult(OPEN_DOCUMENT_REQUEST,Activity.RESULT_OK,selected());h.io.finish();
    check(!h.callbackOk&&h.callbackMessage.contains("characters have not been replaced"),
        "Malformed UTF-8 import cannot be handed to game restore UI");

    h=loading();h.activity.resolver.stored=new byte[MAX_BYTES+1];
    h.onActivityResult(OPEN_DOCUMENT_REQUEST,Activity.RESULT_OK,selected());h.io.finish();
    check(!h.callbackOk&&h.callbackCount==1,
        "Oversize provider document must fail before delivering the import");

    h=saving();h.io.reject=true;
    h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected());
    check(h.io.submissions==1&&!h.documentIoActive&&h.pending==null
        &&h.callbackCount==1&&!h.callbackOk&&h.callbackMessage.contains("worker is unavailable"),
        "Rejected document executor must clear busy and return failure safely");

    h=new CloudPickerCallbackHarness();
    check(h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected()),
        "Orphan callback should be consumed by Thornhaven");
    check(h.io.submissions==0&&h.callbackCount==0,
        "An orphan picker result may not use a document URI");

    h=saving();h.closed=true;
    h.onActivityResult(CREATE_DOCUMENT_REQUEST,Activity.RESULT_OK,selected());
    check(h.io.submissions==0&&h.callbackCount==0,
        "Destroyed Activity may not schedule a document write");

    System.out.println("PASS: production Android picker callback: 13 stale, cancelled, save, load, damaged, oversize, rejected-worker and closed scenarios");
    System.out.println("NOT VERIFIED: real Android out-of-order provider delivery, physical Samsung phone, or Play-signing update");
  }
}
`;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-picker-callback-'));
try {
  const file=path.join(tmp,'CloudPickerCallbackHarness.java');
  fs.writeFileSync(file,java,'utf8');
  const integrity='app/src/main/java/com/emberfall/ashvale/BackupDocumentIntegrity.java';
  assert(fs.existsSync(integrity),'Missing production backup read-back integrity implementation');
  for(const [bin,args] of [
    ['javac',['-encoding','UTF-8','-d',tmp,file,integrity]],
    ['java',['-cp',tmp,'com.emberfall.ashvale.CloudPickerCallbackHarness']]
  ]){
    const r=cp.spawnSync(bin,args,{encoding:'utf8',timeout:30000});
    assert.equal(r.status,0,bin+' failed: '+(r.stderr||r.stdout||r.error));
    if(r.stdout)process.stdout.write(r.stdout);
  }
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
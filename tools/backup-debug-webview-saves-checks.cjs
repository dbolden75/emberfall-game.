#!/usr/bin/env node
'use strict';
// Only synthetic files and mocked adb commands; never touches a device.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-backup-test-'));
try{
 const bin=path.join(tmp,'bin'),data=path.join(tmp,'fixture'),dest=path.join(tmp,'backup.tar'),trace=path.join(tmp,'calls');
 fs.mkdirSync(bin);fs.mkdirSync(path.join(data,'app_webview','Local Storage','leveldb'),{recursive:true});
 fs.writeFileSync(path.join(data,'app_webview','Local Storage','leveldb','000003.log'),'synthetic snapshot');
 const adb=path.join(bin,'adb');
 fs.writeFileSync(adb,[
  '#!/usr/bin/env bash','set -eu','echo "$*" >> "$TRACE"',
  'if [[ "$1" == devices ]]; then',
  '  if [[ "$TWO" == 1 ]]; then printf "List of devices attached\\na\\tdevice\\nb\\tdevice\\n";',
  '  else printf "List of devices attached\\na\\tdevice\\n"; fi; exit 0; fi',
  'if [[ "$1" == -s ]]; then shift 2; fi',
  'if [[ "$1" == shell && "$2" == pm && "$3" == path ]]; then echo "package:/data/app/base.apk"; exit 0; fi',
  'if [[ "$1" == shell && "$2" == run-as ]]; then [[ "$DEBUGGABLE" == 1 ]]; exit; fi',
  'if [[ "$1" == exec-out && "$2" == run-as ]]; then',
  '  if [[ "$BROKEN" == 1 ]]; then echo "not an archive";',
  '  else ( cd "$FIXTURE" && tar -cf - "app_webview/Local Storage/leveldb" ); fi; exit 0; fi',
  'exit 91'
 ].join('\n')+'\n',{mode:0o755});
 const script=path.join(__dirname,'backup-debug-webview-saves.sh');
 function run(override={}){
  fs.writeFileSync(trace,'');
  const result=spawnSync('bash',[script,dest],{encoding:'utf8',env:{...process.env,ADB_BIN:adb,TRACE:trace,FIXTURE:data,TWO:'0',DEBUGGABLE:'1',BROKEN:'0',...override}});
  const calls=fs.readFileSync(trace,'utf8');
  assert.doesNotMatch(calls,/(^| )(install|uninstall|clear|force-stop|rm)( |$)/m);
  return {result,calls};
 }
 let r=run();assert.equal(r.result.status,0,r.result.stderr);assert.equal(fs.statSync(dest).mode&0o777,0o600);
 assert.match(spawnSync('tar',['-tf',dest],{encoding:'utf8'}).stdout,/leveldb\/000003.log/);
 console.log('PASS: exported read-only archive with private permissions');
 r=run();assert.notEqual(r.result.status,0);assert.match(r.result.stderr,/already exists/);assert.equal(r.calls,'');
 console.log('PASS: never overwrite an existing backup');
 fs.unlinkSync(dest);
 r=run({DEBUGGABLE:'0'});assert.notEqual(r.result.status,0);assert.match(r.result.stderr,/not debuggable/);
 r=run({TWO:'1'});assert.notEqual(r.result.status,0);assert.match(r.result.stderr,/exactly one/);
 r=run({BROKEN:'1'});assert.notEqual(r.result.status,0);assert.match(r.result.stderr,/invalid archive/);
 assert(!fs.existsSync(dest));
 console.log('PASS: non-debuggable, ambiguous device and corrupt transfer all block safely');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}

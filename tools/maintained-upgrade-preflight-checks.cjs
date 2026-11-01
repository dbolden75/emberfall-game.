#!/usr/bin/env node
'use strict';
// All Android commands below are mocks: no phone, secrets, or APK installation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'thornhaven-preflight-'));
const cert='38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22';
try {
  const bin=path.join(tmp,'bin');fs.mkdirSync(bin);
  const candidate=path.join(tmp,'candidate.apk');fs.writeFileSync(candidate,'fake candidate');
  function mock(name,lines){fs.writeFileSync(path.join(bin,name),lines.join('\n')+'\n',{mode:0o755});}
  mock('adb',[
    '#!/bin/bash','set -eu','echo "$*" >> "$TEST_LOG"',
    'case "$1" in',
    'devices) printf "List of devices attached\\nemulator-5554\\tdevice\\n";;',
    '-s) shift 2; case "$1" in',
    'shell) if [[ "$2" == getprop ]]; then printf "%s\\n" "$DEVICE_SDK"; else echo "package:/data/app/com.vaelbrink.ashvale.newjourney/base.apk"; fi;;',
    'pull) echo installed > "$3";;',
    '*) exit 71;; esac;;',
    '*) exit 72;; esac'
  ]);
  mock('aapt',[
    '#!/bin/bash','set -eu',
    'if [[ "$3" == *installed-base.apk ]]; then',
    'echo "package: name=\'com.vaelbrink.ashvale.newjourney\' versionCode=\'$INSTALLED_CODE\' versionName=\'1.0.57\'"; echo "sdkVersion:\'$INSTALLED_MIN_SDK\'"',
    'else echo "package: name=\'$CANDIDATE_PACKAGE\' versionCode=\'$CANDIDATE_CODE\' versionName=\'1.0.64\'"; echo "sdkVersion:\'$CANDIDATE_MIN_SDK\'"; fi',
    'if [[ "${BADGING_EXTRA_LINES:-0}" -gt 0 ]]; then',
    "  awk -v n=\"$BADGING_EXTRA_LINES\" 'BEGIN { for(i=0;i<n;i++) print \"application-label-en: Thornhaven\" }'",
    'fi'
  ]);
  mock('apksigner',[
    '#!/bin/bash','set -eu',
    'if [[ "$*" == *installed-base.apk ]]; then cert="$INSTALLED_CERT"; else cert="$CANDIDATE_CERT"; fi',
    'echo "Signer #1 certificate SHA-256 digest: $cert"'
  ]);
  const script=path.join(__dirname,'maintained-upgrade-preflight.sh');
  function check(label,override,pass,match){
    const log=path.join(tmp,'calls');fs.writeFileSync(log,'');
    const env={...process.env,ADB_BIN:path.join(bin,'adb'),AAPT_BIN:path.join(bin,'aapt'),APKSIGNER_BIN:path.join(bin,'apksigner'),TEST_LOG:log,
      CANDIDATE_PACKAGE:'com.vaelbrink.ashvale.newjourney',CANDIDATE_CODE:'166',INSTALLED_CODE:'159',
      INSTALLED_CERT:cert,CANDIDATE_CERT:cert,DEVICE_SDK:'34',CANDIDATE_MIN_SDK:'24',INSTALLED_MIN_SDK:'24',...override};
    const run=spawnSync('bash',[script,candidate],{encoding:'utf8',env});
    assert.equal(run.status===0,pass,label+' '+run.stderr+' '+run.stdout);
    assert((run.stdout+run.stderr).includes(match),label+' expected message not found');
    assert.doesNotMatch(fs.readFileSync(log,'utf8'),/(^| )(install|uninstall|clear)( |$)/m,label+' wrote to device');
    console.log('PASS:',label);
  }
  check('maintained signer 159->166',{},true,'PASS: candidate signer matches');
  check('large aapt dump under pipefail',{BADGING_EXTRA_LINES:'20000'},true,'PASS: candidate signer matches');
  check('Play-signed base blocks sideload',{INSTALLED_CERT:'0'.repeat(64)},false,'different certificate');
  check('equal version blocked',{INSTALLED_CODE:'166'},false,'not newer');
  check('wrong app id blocked',{CANDIDATE_PACKAGE:'org.example.wrong'},false,'candidate package/version wrong');
  check('wrong candidate signing key blocked',{CANDIDATE_CERT:'f'.repeat(64)},false,'not signed with the historical');
  check('minimum supported API is allowed',{DEVICE_SDK:'24'},true,'PASS: candidate signer matches');
  check('candidate too new for device is blocked',{CANDIDATE_MIN_SDK:'35'},false,'requires Android API 35');
  check('device API cannot be determined is blocked',{DEVICE_SDK:''},false,'device SDK level is missing');
  check('multiline device API cannot be reinterpreted',{DEVICE_SDK:'3\n4'},false,'device SDK level is missing');
  check('candidate missing minimum SDK blocks',{CANDIDATE_MIN_SDK:''},false,'no valid minimum Android SDK');
  console.log('PASS: all eleven read-only preflight checks (mock Android commands; no device)');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}

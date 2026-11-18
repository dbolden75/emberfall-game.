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
    'if [[ "$1" == "-s" ]]; then shift 2; fi',
    'case "$1" in',
    'shell) case "$2" in',
    'getprop) printf "%s\\n" "$DEVICE_SDK";;',
    'pm) if [[ "${DUPLICATE_BASE:-0}" == 1 ]]; then',
    '      echo "package:/data/app/pkg/base.apk"; echo "package:/data/app/pkg-copy/base.apk";',
    '    else echo "package:/data/app/pkg/base.apk"; fi;;',
    '*) exit 71;; esac;;',
    'pull) echo installed > "$3";;',
    '*) exit 72;; esac'
  ]);
  mock('aapt',[
    '#!/bin/bash','set -eu',
    'if [[ "$3" == *installed-base.apk ]]; then',
    'echo "package: name=\'com.vaelbrink.ashvale.newjourney\' versionCode=\'$INSTALLED_CODE\' versionName=\'1.0.57\'"; echo "sdkVersion:\'$INSTALLED_MIN_SDK\'"',
    'else echo "package: name=\'$CANDIDATE_PACKAGE\' versionCode=\'$CANDIDATE_CODE\' versionName=\'$CANDIDATE_NAME\'"; echo "sdkVersion:\'$CANDIDATE_MIN_SDK\'"; fi',
    'if [[ "$3" != *installed-base.apk && "${CANDIDATE_DEBUGGABLE:-0}" == 1 ]]; then echo "application-debuggable"; fi',
    'if [[ "$3" != *installed-base.apk && "${CANDIDATE_TEST_ONLY:-0}" == 1 ]]; then echo "application-testOnly"; fi',
    'if [[ "${BADGING_EXTRA_LINES:-0}" -gt 0 ]]; then',
    "  awk -v n=\"$BADGING_EXTRA_LINES\" 'BEGIN { for(i=0;i<n;i++) print \"application-label-en: Thornhaven\" }'",
    'fi'
  ]);
  mock('apksigner',[
    '#!/bin/bash','set -eu',
    'if [[ "$*" == *installed-base.apk ]]; then',
    '  cert="$INSTALLED_CERT"; v2="${INSTALLED_V2:-true}"; v3="${INSTALLED_V3:-true}";',
    'else',
    '  cert="$CANDIDATE_CERT"; v2="${CANDIDATE_V2:-true}"; v3="${CANDIDATE_V3:-true}";',
    'fi',
    'echo "Signer #1 certificate SHA-256 digest: $cert"',
    'echo "Verified using v2 scheme (APK Signature Scheme v2): $v2"',
    'echo "Verified using v3 scheme (APK Signature Scheme v3): $v3"'
  ]);
  const script=path.join(__dirname,'maintained-upgrade-preflight.sh');
  function check(label,override,pass,match,expectNoAdb=false){
    const log=path.join(tmp,'calls');fs.writeFileSync(log,'');
    const env={...process.env,ADB_BIN:path.join(bin,'adb'),AAPT_BIN:path.join(bin,'aapt'),APKSIGNER_BIN:path.join(bin,'apksigner'),TEST_LOG:log,
      CANDIDATE_PACKAGE:'com.vaelbrink.ashvale.newjourney',CANDIDATE_CODE:'172',CANDIDATE_NAME:'1.0.70',INSTALLED_CODE:'159',
      INSTALLED_CERT:cert,CANDIDATE_CERT:cert,DEVICE_SDK:'34',CANDIDATE_MIN_SDK:'24',INSTALLED_MIN_SDK:'24',...override};
    const run=spawnSync('bash',[script,candidate],{encoding:'utf8',env});
    assert.equal(run.status===0,pass,label+' '+run.stderr+' '+run.stdout);
    assert((run.stdout+run.stderr).includes(match),label+' expected message not found');
    assert.doesNotMatch(fs.readFileSync(log,'utf8'),/(^| )(install|uninstall|clear)( |$)/m,label+' wrote to device');
    if(expectNoAdb)assert.equal(fs.readFileSync(log,'utf8').trim(),'','Rejected candidate must never consult the device');
    console.log('PASS:',label);
  }
  check('maintained signer 159->172',{},true,'PASS: installed com.vaelbrink.ashvale.newjourney versionCode 159');
  check('maintained 1.0.69 installed signer can upgrade to 1.0.70',
    {INSTALLED_CODE:'171'},true,'PASS: installed com.vaelbrink.ashvale.newjourney versionCode 171');
  check('stale signed candidate code blocked before device access',
    {CANDIDATE_CODE:'169'},false,'Candidate release identity is stale',true);
  check('stale signed candidate name blocked before device access',
    {CANDIDATE_NAME:'1.0.67'},false,'Candidate release identity is stale',true);
  check('large aapt dump under pipefail',{BADGING_EXTRA_LINES:'20000'},true,'PASS: installed com.vaelbrink.ashvale.newjourney versionCode 159');
  check('installed v1-only with same signing key is blocked',
    {INSTALLED_V2:'false',INSTALLED_V3:'false'},false,
    'Archived APK has no verified v2/v3 signing');
  check('legacy development v1-only signer is blocked with recovery warning',
    {INSTALLED_CERT:'09ed9284b3e16e0181f7e9b428e5ed882bc66cf325c900212d40baf9dc817099',
      INSTALLED_V2:'false',INSTALLED_V3:'false'},false,'DO NOT uninstall, clear data, or sideload');
  check('Play-signed base blocks sideload',{INSTALLED_CERT:'0'.repeat(64)},false,'Installed signer differs');
  check('debuggable candidate rejected before device access',{CANDIDATE_DEBUGGABLE:'1'},false,'debuggable or testOnly',true);
  check('testOnly candidate rejected before device access',{CANDIDATE_TEST_ONLY:'1'},false,'debuggable or testOnly',true);
  check('candidate missing v2 signature blocked',{CANDIDATE_V2:'false'},false,'Candidate APK does not verify with Android');
  check('candidate missing v3 signature blocked',{CANDIDATE_V3:'false'},false,'Candidate APK does not verify with Android');
  check('equal version blocked',{INSTALLED_CODE:'172'},false,'not newer');
  check('installed version newer than candidate blocked',{INSTALLED_CODE:'173'},false,'not newer');
  check('wrong app id blocked',{CANDIDATE_PACKAGE:'org.example.wrong'},false,'Candidate has incorrect package or signing certificate');
  check('wrong candidate signing key blocked',{CANDIDATE_CERT:'f'.repeat(64)},false,'Candidate has incorrect package or signing certificate');
  check('minimum supported API is allowed',{DEVICE_SDK:'24'},true,'PASS: installed com.vaelbrink.ashvale.newjourney versionCode 159');
  check('candidate too new for device is blocked',{CANDIDATE_MIN_SDK:'35'},false,'requires Android API 35');
  check('device API cannot be determined is blocked',{DEVICE_SDK:''},false,'Could not identify device Android SDK');
  check('multiline device API cannot be reinterpreted',{DEVICE_SDK:'3\n4'},false,'Could not identify device Android SDK');
  check('candidate missing minimum SDK blocks',{CANDIDATE_MIN_SDK:''},false,'Candidate has no unambiguous minimum Android SDK');
  check('ambiguous installed base APKs are rejected', {DUPLICATE_BASE:'1'}, false, 'Could not uniquely locate');
  console.log('PASS: all twenty-two read-only preflight checks (mock Android commands; no device)');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}

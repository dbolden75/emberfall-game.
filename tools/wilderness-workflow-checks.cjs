// Track source state across steps, not only within each run block. The upgrade
// job formerly checked the release hash many steps after applying the overlay.
const fs=require('fs'),assert=require('assert');
const baseline='801d9f3394aaa4987410b0cf6e96517a3952686546b6d613e2e95f4bda2a2e24';
function check(source){
 let overlaid=false,verified=false,overlays=0;
 for(const line of source.split('\n')){
  if(/^  [\w-]+:$/.test(line)){overlaid=false;verified=false;}
  if(line.trim()==='python3 tools/restore-1.0.69.py'){overlaid=false;verified=false;}
  const hash=line.includes(baseline)&&line.includes('sha256sum -c');
  const gate=line.trim()==='python3 tools/verify-release-candidate-169.py'||line.trim()==='node tools/release-identity-checks.cjs';
  if(hash||gate){assert(!overlaid,'Baseline hash gate after wilderness overlay');verified=true;}
  if(line.trim()==='python3 tools/apply-wilderness-slice.py'){
   assert(verified,'Wilderness overlay before explicit baseline authentication');overlaid=true;overlays++;
  }
 }
 return overlays;
}
const emulator=fs.readFileSync('.github/workflows/thornhaven-emulator-smoke.yml','utf8');
assert.equal(check(emulator),2);
assert.equal(check(fs.readFileSync('.github/workflows/thornhaven-android-build.yml','utf8')),1);
assert.equal(check(fs.readFileSync('.github/workflows/thornhaven-release.yml','utf8')),0);
assert.equal((emulator.match(/node tools\/wilderness-slice-checks.cjs/g)||[]).length,2,'Both emulator jobs must test overlay output');
const actualHashLine=emulator.split('\n').find(line=>line.includes(baseline));
const reordered=emulator.replace(actualHashLine+'\n          python3 tools/apply-wilderness-slice.py','          python3 tools/apply-wilderness-slice.py\n'+actualHashLine);
assert.notEqual(reordered,emulator);assert.throws(()=>check(reordered),'Actual workflow reorder must fail');
const hash=`printf '${baseline}' | sha256sum -c -`;
assert.throws(()=>check(`python3 tools/restore-1.0.69.py\npython3 tools/apply-wilderness-slice.py\n${hash}`));
assert.throws(()=>check(`${hash}\npython3 tools/apply-wilderness-slice.py\n- name: later build step\n${hash}`));
assert.equal(check(`${hash}\npython3 tools/apply-wilderness-slice.py\nnode tools/wilderness-slice-checks.cjs`),1);
console.log('PASS: all restore/hash/overlay orderings; both premature overlay and delayed baseline hash mutations rejected; emulator overlay gates retained');

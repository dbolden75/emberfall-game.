/* Licensed media existence, catalog coverage, hash, decode and signal checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');

/** Inspect full native-rate decoded audio without buffering raw PCM in Node.
 * ffmpeg astats writes a tiny summary to stderr instead of an unbounded
 * multi-minute stereo PCM stream, which exhausted subprocess memory in CI.
 */
function nativeDecodedPeak(file) {
  const result=cp.spawnSync('ffmpeg',[
    '-nostdin','-hide_banner','-v','info','-i',file,
    '-vn','-sn','-dn','-af','astats=metadata=0:reset=0','-f','null','-'
  ],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:120000});
  assert.ifError(result.error);
  assert.equal(result.status,0,
    'FFmpeg failed for '+file+': '+(result.signal||result.stderr?.slice(-1600)||'unknown error'));
  const overall=result.stderr.split(/\bOverall\s*\r?\n/).at(-1);
  assert.notEqual(overall,result.stderr,'No overall FFmpeg astats for '+file);
  const peakMatch=overall.match(/Peak level dB:\s*(-?Infinity|-?inf|-?\d+(?:\.\d+)?)/i);
  const countMatch=overall.match(/Number of samples:\s*(\d+)/);
  assert(peakMatch&&countMatch&&Number(countMatch[1])>100,'Incomplete FFmpeg decode for '+file);
  const peakDb=Number(peakMatch[1]),peak=10**(peakDb/20);
  assert(Number.isFinite(peak)&&peak>.001&&peak<1,
    file+' invalid/silent/clipped native decoded peak '+peak+' ('+peakDb+' dBFS)');
  return peak;
}
module.exports={nativeDecodedPeak};

if(require.main===module){
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(assets,'audio-catalog.js'),'utf8'),ctx);
const catalog=ctx.window.ThornhavenAudioCatalog,provenance=JSON.parse(fs.readFileSync(path.join(root,'art-licenses/audio/provenance.json'))),pins=JSON.parse(fs.readFileSync(path.join(root,'source-payload/audio-sha256.json')));
const expected=['step','attack','hit','quest','level','menu','spell','heal','loot','mining','woodcutting','fishing','town','exploration','combat','dungeon','forest','tomb'];
assert.deepEqual(Object.keys(catalog).sort(),expected.sort());
const used=new Set();for(const [id,spec] of Object.entries(catalog)){assert.match(spec.src,/^audio\/[a-z]+\.ogg$/);assert(spec.gain>0&&spec.gain<=1);assert(fs.existsSync(path.join(assets,spec.src)),id);used.add(spec.src);}
const files=fs.readdirSync(path.join(assets,'audio')).map(x=>'audio/'+x);assert.deepEqual([...used].sort(),files.sort(),'unused media');assert.equal(provenance.assets.length,files.length);
for(const src of used){const key='app/src/main/assets/'+src,p=path.join(root,key),data=fs.readFileSync(p),hash=crypto.createHash('sha256').update(data).digest('hex'),record=provenance.assets.find(x=>x.path===key);assert(record);assert.equal(record.license,'CC0-1.0');assert.equal(hash,record.sha256);assert.equal(hash,pins[key]);assert(record.author&&record.source_url&&record.source_sha256&&record.transformation);nativeDecodedPeak(p);}
console.log('PASS: 18 catalog cues, 17 media files, CC0 provenance, SHA256 pins, bounded-memory native-rate FFmpeg decoding and non-silent unclipped peaks');
}

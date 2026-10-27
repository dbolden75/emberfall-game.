const fs=require('fs'),vm=require('vm'),assert=require('assert');
const made=[];function context(){return {builds:0,stamps:0,setTransform(){this.builds++},createRadialGradient(){return {addColorStop(){}}},fillRect(){},drawImage(){this.stamps++}};}
const root={document:{createElement(){const c={width:0,height:0,ctx:context(),getContext(){return this.ctx}};made.push(c);return c}},window:{localExplorationRevision:1},mapId:'a',townQuestState:{_localExploration:{a:{'0,0':1}}}};
vm.createContext(root);vm.runInContext(fs.readFileSync('app/src/main/assets/soft-fog.js','utf8'),root);
let draws=0;const target={save(){},restore(){},drawImage(){draws++}};
const b={minX:-512,minY:-256,maxX:4096,maxY:2048};
root.window.drawSoftExplorationFog(target,b);assert(made[0].width<=1024&&made[0].height<=1024);assert.equal(made[0].ctx.stamps,1);
root.window.drawSoftExplorationFog(target,b);assert.equal(made[0].ctx.builds,1,'stationary frames reuse fog image');
root.townQuestState._localExploration.a['1,0']=1;root.window.localExplorationRevision++;root.window.drawSoftExplorationFog(target,b);assert.equal(made[0].ctx.builds,2);assert.equal(made[0].ctx.stamps,3);
root.townQuestState._localExploration.a={'9,9':1};root.window.drawSoftExplorationFog(target,b);assert.equal(made[0].ctx.builds,3,'loaded characters invalidate fog cache');
root.mapId='b';root.window.drawSoftExplorationFog(target,b);assert.equal(made[0].ctx.builds,4,'regions keep their own discovery');
assert.equal(draws,5);assert.equal(made[0].ctx.globalCompositeOperation,'source-over');
console.log('PASS: fog cache, discovery updates, character/region isolation, bounded canvas and compositing restoration. Visual appearance needs live browser.');

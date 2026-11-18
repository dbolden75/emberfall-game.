const fs=require('fs');
let harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8');
harness=harness.replace('try{vm.runInContext(code,root,', `if(src?.[1]==='wilderness-slice.js')code=\`window.coreBefore=[];for(let y=-850;y<1460;y+=47)for(let x=-1410;x<2370;x+=53)coreBefore.push([x,y,mapPlacementBlocked('elderwood',x,y,14)]);window.entitiesBefore=JSON.stringify(maps.elderwood);\`+code+";if(JSON.stringify(maps.elderwood)!==entitiesBefore)throw Error('Changed existing entities');";try{vm.runInContext(code,root,`);
const extra=String.raw`
root.measureNow=()=>require('perf_hooks').performance.now();
vm.runInContext(\`
 const assertSlice=(ok,msg)=>{if(!ok)throw Error(msg);};
 for(const [x,y,blocked] of coreBefore)assertSlice(mapPlacementBlocked('elderwood',x,y,14)===blocked,'Legacy collision changed');
 setMap('elderwood',480,315,false);
 const bounds=worldBounds(),geo=regionalGeometry();
 assertSlice(bounds.maxX-bounds.minX===15316&&bounds.maxY-bounds.minY===9520,'geometry');
 assertSlice(worldBounds('westwood').maxX-worldBounds('westwood').minX===3796,'global multiplication');
 const endpoints=['north','east','south','west'].map(side=>{const [x,y]=edgeMapEntry('elderwood',side);return{x,y};});
 const objectives=[...maps.elderwood.npcs,...(maps.elderwood.worldObjects||[]),...maps.elderwood.gatherNodes].map(p=>safeMapPosition('elderwood',p.x,p.y,14));
 const timings=[],lengths=[];
 for(const radius of [12,14,20])for(const rawTarget of [...endpoints,...objectives]){
  const target=safeMapPosition('elderwood',rawTarget.x,rawTarget.y,radius);
  const start={x:480,y:315},t=measureNow(),path=findWalkingPath('elderwood',start,target,radius);timings.push(measureNow()-t);
  assertSlice(path?.length,'Unreachable '+JSON.stringify(target)+' radius '+radius);
  let prev=start,length=0;for(const p of path){assertSlice(walkingLine('elderwood',prev,p,radius),'Path crosses collision '+JSON.stringify({prev,p,radius,target}));length+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}lengths.push(length);
 }
 for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){const path=findWalkingPath('elderwood',endpoints[i],endpoints[j],14);assertSlice(path?.length,'Exit pair unreachable');let a=endpoints[i];for(const b of path){assertSlice(walkingLine('elderwood',a,b,14),'Exit pair collision');a=b;}}
 for(const exit of mapConnections.elderwood.exits.filter(e=>e.trigger==='edge')){setMap('elderwood',480,315,false);assertSlice(takeMapExit(exit,true)&&mapId===exit.to,'Exit transition failed');const back=mapConnections[mapId].exits.find(e=>e.to==='elderwood');assertSlice(back&&takeMapExit(back,true)&&mapId==='elderwood','Return transition failed');assertSlice(!overlaps(player.x,player.y,14),'Blocked edge entry');}
 // Every authored route segment and loop is walkable; sample fixed-length movement
 // with the production follower steering function, including both road bends.
 for(const route of wildernessSlice.routes){let actor={x:route[0][0],y:route[0][1]};for(const [x,y] of route.slice(1)){
  assertSlice(walkingLine('elderwood',actor,{x,y},20),'Authored road blocked');
  let steps=0;while(Math.hypot(x-actor.x,y-actor.y)>3&&steps++<6000)steerActor(actor,x,y,200,1/30,14);
  assertSlice(Math.hypot(x-actor.x,y-actor.y)<=3,'Follower steering stuck');
 }}
 for(const zoom of [.6,1,1.8])for(const [w,h] of [[960,600],[412,915],[915,412]])for(const p of endpoints){
  viewW=w;viewH=h;cameraZoom=zoom;Object.assign(player,p);updateCamera();const screen=mapToScreen(p.x,p.y),back=screenToMap(screen.x,screen.y);
  assertSlice(Math.hypot(back.x-p.x,back.y-p.y)<1e-8,'Camera roundtrip');
  assertSlice(cameraX>=0&&cameraX<=geo.width-viewW/roomScale&&cameraY>=0&&cameraY<=geo.height-viewH/roomScale,'Camera bounds');
  draw();
 }
 for(const p of [{x:480,y:315},{x:-1300,y:-700},{x:2200,y:1300}]){const safe=safeMapPosition('elderwood',p.x,p.y,14);assertSlice(!mapPlacementBlocked('elderwood',safe.x,safe.y,14),'Old save spawn');}
 setMap('elderwood',480,315,false);const snap=snapshotGameState();assertSlice(snap.mapStates.elderwood.enemies.length===maps.elderwood.enemies.length,'Enemy save layout');
 setMap('elderwood',7900,315,false);saveGame();const encoded=ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId);const parsed=ThornhavenCloudSaveCore.parse(encoded);assertSlice(parsed.slots[activeSlotId].state.player.x===player.x,'Expanded cloud position lost');
 assertSlice([...walkGridCache.keys()].filter(k=>k.startsWith('elderwood:')).length<=2,'Regional cache limit');
 timings.sort((a,b)=>a-b);
 console.log('WILDERNESS_METRICS '+JSON.stringify({bounds,treeCount:wildernessSlice.treeCount,objectives:objectives.length,queries:timings.length,p50ms:timings[Math.floor(timings.length*.5)],p95ms:timings[Math.floor(timings.length*.95)],maxMs:timings.at(-1),firstFourRouteLengths:lengths.slice(0,4),gridCells:walkingGrid('elderwood',14).free.length}));
\`,root);
`;
new Function('require',harness+extra.replaceAll('\\`','`'))(require);

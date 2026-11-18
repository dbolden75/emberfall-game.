/* Elderwood wilderness slice. Runtime-only geometry; no entities or save schema added. */
(() => {
 'use strict';
 const id='elderwood', core={minX:-1418,maxX:2378,minY:-855,maxY:1465};
 // Authored belts: western lakes, northern rock shoulders, eastern woods,
 // southern wetland islands. Ellipse footprints drive both collision and paint.
 const features=[
  [-4600,-1600,1550,650,'water'],[-4800,1500,1000,720,'water'],
  [-2300,-2900,850,550,'stone'],[1800,-3000,1700,500,'stone'],
  [5200,-1600,720,1200,'forest'],[5900,1700,1100,650,'forest'],
  [-900,3300,1200,500,'water'],[3000,3500,950,680,'water'],
  [-5900,-3400,600,450,'forest'],[5900,-3500,950,430,'stone'],
  [-5200,3500,900,600,'forest'],[6400,3800,600,500,'stone']
 ];
 // Connected main arms and two unequal outer loops, all joining the old road.
 const routes=[
  [[-7178,315],[-6200,315],[-3200,315],[-1400,315]],
  [[2350,315],[3900,315],[4900,500],[7000,315],[8138,315]],
  [[480,-4455],[480,-2100],[480,-850]],
  [[480,1450],[480,2400],[1100,3500],[480,5065]],
  [[-6200,315],[-6500,-2600],[-4000,-2500],[-3400,-1200],[-2300,-1400],[480,-2100],[3800,-2400],[7000,-2900],[7000,315]],
  [[-6200,315],[-6400,2300],[-3400,2700],[-2400,1900],[480,2400],[2100,2200],[4400,2500],[7000,2200],[7000,315]]
 ];
 const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
 const roadSegments=routes.flatMap(route=>route.slice(1).map((b,i)=>[route[i],b]));
 const onRoad=(x,y,r=0)=>{const width=95+r;for(const [a,b] of roadSegments){if(x<Math.min(a[0],b[0])-width||x>Math.max(a[0],b[0])+width||y<Math.min(a[1],b[1])-width||y>Math.max(a[1],b[1])+width)continue;if(segmentDistance(x,y,a,b)<width)return true;}return false;};
 const inCore=(x,y,pad=0)=>x>=core.minX-pad&&x<=core.maxX+pad&&y>=core.minY-pad&&y<=core.maxY+pad;
 const buckets=new Map(),size=256;
 const key=(x,y)=>Math.floor(x/size)+','+Math.floor(y/size);
 const add=p=>{const k=key(p[0],p[1]);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);};
 // Deterministic clustered understory, open meadow bands and clear route shoulders.
 // Never append these to saved enemy/gather arrays or legacy scenery arrays.
 let seed=7391;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=-4300;y<5000;y+=100)for(let x=-7000;x<8000;x+=100){
  const px=x+random()*80,py=y+random()*80;
  const density=(Math.sin(px*.0017)+Math.cos(py*.0023)+Math.sin((px+py)*.0011))/3;
  if(inCore(px,py,100)||onRoad(px,py,60)||density<.12||random()>.60)continue;
  if(features.some(([fx,fy,rx,ry])=>((px-fx)/(rx+80))**2+((py-fy)/(ry+80))**2<1))continue;
  add([px,py,density>.45?'oak':'pine']);
 }
 const candidates=(x,y,r)=>{const out=[];for(let gy=Math.floor((y-r)/size);gy<=Math.floor((y+r)/size);gy++)for(let gx=Math.floor((x-r)/size);gx<=Math.floor((x+r)/size);gx++)out.push(...(buckets.get(gx+','+gy)||[]));return out;};
 const legacyAreas=fixedSceneryAreas(id),legacyPools=[...(marshSceneryPools[id]||[]),...(fishingSpotCoords[id]||[]).map(p=>[...p,48,28])];
 const legacyBuckets=new Map();
 for(const [points,radius] of [[maps[id].trees,20],[maps[id].stones,14]])for(const [x,y] of points){const k=key(x,y);if(!legacyBuckets.has(k))legacyBuckets.set(k,[]);legacyBuckets.get(k).push([x,y,radius]);}
 const oldBlocked=mapPlacementBlocked;
 mapPlacementBlocked=function(map,x,y,r=14){
  if(map!==id)return oldBlocked(map,x,y,r);
  const b=worldBounds(id);if(!Number.isFinite(x)||!Number.isFinite(y)||x<b.minX||x>b.maxX||y<b.minY||y>b.maxY)return true;
  if(legacyAreas.some(a=>x>a[0]-r&&x<a[2]+r&&y>a[1]-r&&y<a[3]+r))return true;
  if(legacyPools.some(([px,py,rx,ry])=>((x-px)/(rx+r+3))**2+((y-py)/(ry+r+3))**2<1))return true;
  for(let gy=Math.floor((y-r-20)/size);gy<=Math.floor((y+r+20)/size);gy++)for(let gx=Math.floor((x-r-20)/size);gx<=Math.floor((x+r+20)/size);gx++)for(const [tx,ty,tr] of legacyBuckets.get(gx+','+gy)||[])if(Math.hypot(x-tx,y-ty)<r+tr)return true;
  // Roads are cut through belts; shoulders are wider than all actor radii.
  if(!onRoad(x,y,-r))for(const [fx,fy,rx,ry] of features)if(((x-fx)/(rx+r))**2+((y-fy)/(ry+r))**2<1)return true;
  return candidates(x,y,r+20).some(([tx,ty])=>Math.hypot(x-tx,y-ty)<r+20);
 };
 const visible=(x,y,rx,ry)=>{const a=screenToMap(0,0),b=screenToMap(viewW,viewH);return x+rx>a.x&&x-rx<b.x&&y+ry>a.y&&y-ry<b.y;};
 function terrain(g,overview=false){
  for(const [x,y,rx,ry,type] of features){if(!overview&&!visible(x,y,rx,ry))continue;g.fillStyle={water:'#28545d',stone:'#777767',forest:'#253e2b'}[type];g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();if(!overview){g.save();g.clip();paintSurface(type==='forest'?'marsh':type,x-rx,y-ry,rx*2,ry*2);g.restore();}g.strokeStyle=type==='water'?'#7b916a':'#536044';g.lineWidth=18;g.stroke();if(!overview&&type!=='water'){for(let a=0;a<Math.PI*2;a+=.08){const px=x+Math.cos(a)*rx,py=y+Math.sin(a)*ry;if(!onRoad(px,py,160)&&visible(px,py,160,160))standArt(type==='forest'?'oak':'rock',px,py,type==='forest'?160:90);}}}
  g.lineCap='round';g.lineJoin='round';for(const route of routes){g.beginPath();route.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));for(const [width,color,alpha] of [[230,'#65804a',.18],[210,'#65804a',.35],[190,'#65804a',1],[140,'#94774e',.35],[110,'#94774e',.6],[85,'#94774e',.8]]){g.save();g.globalAlpha*=alpha;g.strokeStyle=color;g.lineWidth=width;g.stroke();g.restore();}}
 }
 window.drawWildernessLocalTerrain=g=>{if(mapId===id)terrain(g,true);};
 const oldExpanded=drawExpandedWorldScenery;
 drawExpandedWorldScenery=function(){
  if(mapId!==id)return oldExpanded();
  terrain(ctx);
  const a=screenToMap(-200,-200),b=screenToMap(viewW+200,viewH+200);
  for(let gy=Math.floor(a.y/size);gy<=Math.floor(b.y/size);gy++)for(let gx=Math.floor(a.x/size);gx<=Math.floor(b.x/size);gx++)for(const [x,y,type] of buckets.get(gx+','+gy)||[])standArt(type,x,y,type==='oak'?150:125);
 };
 // Suppress template-wide secondary roads; preserve original core road painting.
 const oldOrganic=drawOrganicRoads;
 drawOrganicRoads=function(ox,oy,w,h,routesArg=null){if(mapId!==id)return oldOrganic(ox,oy,w,h,routesArg);oldOrganic(1440,900,3840,2400,routesArg);if(!routesArg)oldOrganic(1440,900,3840,2400,[...[-48,690].map(y=>[true,-1440,2400,y+17,12]),...[-170,1110].map(x=>[false,-900,1500,x+17,12])]);};
 const oldGrid=walkingGrid;
 walkingGrid=function(map,r){
  if(map!==id){if(walkGridCache.size>=8)walkGridCache.delete(walkGridCache.keys().next().value);return oldGrid(map,r);}
  const k=map+':'+r;if(walkGridCache.has(k))return walkGridCache.get(k);
  // 64-unit coarse graph, lazily sampled; exact segment collision remains authoritative.
  const b=worldBounds(map),step=64,cols=Math.floor((b.maxX-b.minX)/step)+1,rows=Math.floor((b.maxY-b.minY)/step)+1;
  const free=new Int8Array(cols*rows);free.fill(-1);
  const grid={b,step,cols,rows,free,point:i=>({x:b.minX+i%cols*step,y:b.minY+Math.floor(i/cols)*step})};
  const regionalKeys=[...walkGridCache.keys()].filter(k=>k.startsWith(id+':'));if(regionalKeys.length>=2)walkGridCache.delete(regionalKeys[0]);
  if(walkGridCache.size>=8)walkGridCache.delete(walkGridCache.keys().next().value);
  walkGridCache.set(k,grid);return grid;
 };
 const oldPath=findWalkingPath;
 findWalkingPath=function(map,start,target,r=14){
  if(map!==id)return oldPath(map,start,target,r);
  if(walkingLine(map,start,target,r))return [target];
  const g=walkingGrid(map,r),{cols,rows,free,point,b,step}=g;
  const usable=i=>{if(free[i]<0){const p=point(i);free[i]=+!mapPlacementBlocked(map,p.x,p.y,r);}return free[i]===1;};
  const nearest=p=>{let best=-1,dist=Infinity;const cx=Math.round((p.x-b.minX)/step),cy=Math.round((p.y-b.minY)/step);for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=cols||y>=rows)continue;const i=y*cols+x,q=point(i),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<dist&&usable(i)&&walkingLine(map,p,q,r)&&walkingLine(map,q,p,r)){best=i;dist=d;}}return best;};
  const source=nearest(start),goal=nearest(target);if(source<0||goal<0)return null;
  const prev=new Int32Array(free.length);prev.fill(-1);const cost=new Float32Array(free.length);cost.fill(Infinity);
  const heap=[],score=i=>Math.abs(i%cols-goal%cols)+Math.abs(Math.floor(i/cols)-Math.floor(goal/cols));
  const push=(i,f)=>{let n=heap.length;heap.push([i,f]);while(n){const p=(n-1)>>1;if(heap[p][1]<=f)break;heap[n]=heap[p];n=p;}heap[n]=[i,f];};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let n=0;while(n*2+1<heap.length){let c=n*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[n]=heap[c];n=c;}heap[n]=last;}return top;};
  cost[source]=0;prev[source]=source;push(source,score(source));let expanded=0;
  while(heap.length&&expanded<12000){const [i,f]=pop();if(f!==cost[i]+score(i))continue;if(i===goal)break;expanded++;const x=i%cols,y=Math.floor(i/cols);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const j=ny*cols+nx;if(cost[j]<=cost[i]+1||!usable(j)||!walkingLine(map,point(i),point(j),r))continue;cost[j]=cost[i]+1;prev[j]=i;push(j,cost[j]+score(j));}}
  if(prev[goal]<0)return null;
  const path=[target];for(let i=goal;i!==source;i=prev[i])path.push(point(i));path.push(point(source));path.reverse();return path;
 };
 function clearTrees(test){for(const [k,points] of buckets){const kept=points.filter(p=>!test(p[0],p[1]));if(kept.length)buckets.set(k,kept);else buckets.delete(k);}for(const k of walkGridCache.keys())if(k.startsWith(id+':'))walkGridCache.delete(k);}
 function addTrail(route){routes.push(route);for(let i=1;i<route.length;i++)roadSegments.push([route[i-1],route[i]]);clearTrees((x,y)=>route.slice(1).some((b,i)=>segmentDistance(x,y,route[i],b)<140));}
 function reserveClearing(x,y,r){clearTrees((px,py)=>Math.hypot(px-x,py-y)<r);}
 function addObstacle(x,y,r){const k=key(x,y);if(!legacyBuckets.has(k))legacyBuckets.set(k,[]);legacyBuckets.get(k).push([x,y,r]);for(const k of walkGridCache.keys())if(k.startsWith(id+':'))walkGridCache.delete(k);}
 window.wildernessSlice={id,features,routes,core,addTrail,reserveClearing,addObstacle,get treeCount(){return [...buckets.values()].reduce((n,a)=>n+a.length,0)},cacheCellLimit:Math.ceil(15360/64)*Math.ceil(9600/64),queryExpansionLimit:12000};
})();

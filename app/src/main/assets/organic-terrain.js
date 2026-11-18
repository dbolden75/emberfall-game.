/* Local gameplay ground rendering only. No movement, collision, save or map data changes. */
function organicRoadShape(horizontal,start,end,center,halfWidth,edge){
 const points=[],count=Math.max(12,Math.ceil((end-start)/36));
 for(let i=0;i<=count;i++){
  const t=i/count,v=start+(end-start)*t,envelope=Math.sin(Math.PI*t)**2;
  const bend=Math.sin(v*.006+1.2)*Math.sin(v*.0021)*envelope*(horizontal?11:7);
  const width=halfWidth+(Math.sin(v*.031)*2.5+Math.sin(v*.013+2)*3)*envelope+edge;
  points.push({v,center:center+bend,width});
 }
 ctx.beginPath();
 points.forEach((p,i)=>{const x=horizontal?p.v:p.center-p.width,y=horizontal?p.center-p.width:p.v;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
 for(let i=points.length-1;i>=0;i--){const p=points[i];ctx.lineTo(horizontal?p.v:p.center+p.width,horizontal?p.center+p.width:p.v)}
 ctx.closePath();
}
function drawOrganicRoads(ox,oy,worldW,worldH,routes=null){
 // Same route centers and exits, gently varying shoulders rather than rectangles.
 const roads=routes||[[true,-ox,worldW-ox,324,38],[false,-oy,worldH-oy,480,18]];
 for(const [horizontal,start,end,center,width] of roads){
  for(const [edge,alpha] of [[14,.13],[9,.19],[4,.28],[0,.72]]){
   ctx.save();organicRoadShape(horizontal,start,end,center,width,edge);ctx.clip();ctx.globalAlpha*=alpha;
   paintSurface('dirt',-ox,-oy,worldW,worldH);ctx.restore();
  }
  // Worn soil flecks taper the shoulder into the surrounding grass.
  ctx.save();ctx.fillStyle='#b39a6b';
  for(let v=start+19;v<end;v+=33){const envelope=Math.sin(Math.PI*(v-start)/(end-start))**2,bend=Math.sin(v*.006+1.2)*Math.sin(v*.0021)*envelope*(horizontal?11:7),variation=(Math.sin(v*.031)*2.5+Math.sin(v*.013+2)*3)*envelope;
   for(const side of [-1,1]){const cross=center+bend+side*(width+variation+6+Math.sin(v)*3);ctx.globalAlpha=.08+(Math.sin(v*.7)+1)*.04;ctx.beginPath();ctx.ellipse(horizontal?v:cross,horizontal?cross:v,1.8,1.1,v*.1,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
 }
}
function drawOrganicClearing(x,y,w,h){
 for(const [margin,alpha] of [[9,.18],[4,.26],[0,.8]]){
  ctx.save();ctx.beginPath();
  for(let i=0;i<64;i++){const a=i*Math.PI/32,r=1+Math.sin(a*5+.3)*.025+Math.sin(a*9)*.018,px=x+w/2+Math.cos(a)*(w/2+margin)*r,py=y+h/2+Math.sin(a)*(h/2+margin)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}
  ctx.closePath();ctx.clip();ctx.globalAlpha*=alpha;paintSurface('dirt',x-22,y-22,w+44,h+44);ctx.restore();
 }
}

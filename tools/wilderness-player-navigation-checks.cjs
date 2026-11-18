const fs=require('fs');const harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8');
const extra=String.raw`
vm.runInContext(\`
(()=>{
// Regression: valid near-tangent departure after gathering at the hardwood
// grove previously cleared tapTarget during the intermediate X-only step.
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
setMap('elderwood',4280,-1940,false);for(const e of maps.elderwood.enemies){e.alive=false;e.respawnAt=Date.now()+3600000;}
window.jarvisPaused=false;renderScene=()=>{};
let cases=0;
for(let angle=0;angle<6.28;angle+=.3){
 const start=safeMapPosition('elderwood',4280,-1940,player.r);
 start.x+=Math.cos(angle)*7;start.y+=Math.sin(angle)*7;
 if(mapPlacementBlocked('elderwood',start.x,start.y,player.r))continue;
 Object.assign(player,start);tapTarget={x:3800,y:-2400};let count=0;
 while(tapTarget&&count++<500){frame(last+16);check(!overlaps(player.x,player.y,player.r),'Player entered collision');}
 check(Math.hypot(player.x-3800,player.y+2400)<8,'Tree tangent cancelled a valid tap route '+angle);cases++;
}
check(cases>=10,'Insufficient safe departure samples');console.log('PASS: '+cases+' real frame-loop tree departures, standard speed, collision free');
})();
\`,root);
`;
new Function('require',harness+extra.replaceAll('\\`','`'))(require);

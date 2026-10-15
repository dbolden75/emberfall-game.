const {webkit}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
(async()=>{
 const root=path.resolve('thornhaven/app/src/main/assets');
 const server=http.createServer((req,res)=>{try{let body=fs.readFileSync(path.join(root,req.url==='/'?'index.html':req.url));if(req.url==='/')body=Buffer.from(body.toString().replace('})().catch(presentLoadError);','window.qaRun=s=>eval(s);})().catch(presentLoadError);'));res.end(body)}catch{res.statusCode=404;res.end()}});
 await new Promise(r=>server.listen(8299,'127.0.0.1',r));
 const browser=await webkit.launch({headless:true});const errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8299');
  await page.waitForFunction(()=>typeof qaRun==='function');
  await page.locator('#characterName').fill('iPhone Trial');await page.locator('#characterForm').evaluate(f=>f.requestSubmit());
  const run=s=>page.evaluate(s=>qaRun(s),s);
  await run("closePanel('adventureScreen');soundEnabled=false;setMap('ashvale',480,315,false)");
  checks.push('WebKit creates normal character and renders game');
  for(const viewport of [{width:393,height:852},{width:852,height:393}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(200);
   await page.locator('#optionsToggle').tap();
   const b=await page.locator('#optionsMenu').boundingBox();assert(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,'options fit');
   await page.locator('#inventoryButton').tap();assert(await page.locator('#inventoryScreen').isVisible());
   await run("closePanel('inventoryScreen')");
   checks.push(`${viewport.width}x${viewport.height}: touch menu and inventory work`);
  }
  await run('saveGame()');const saved=await run('({name:player.name,level:player.level,map:mapId})');
  await page.reload();await page.waitForFunction(()=>typeof qaRun==='function');
  assert.deepEqual(await run('({name:player.name,level:player.level,map:mapId})'),saved);
  checks.push('WebKit save reload preserves player and map');assert.deepEqual(errors,[]);
  fs.writeFileSync('qa-results/webkit-mobile.json',JSON.stringify({checks,errors,physicalIOS:false},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

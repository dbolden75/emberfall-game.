const { chromium } = require('playwright');
const path = require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.THORNHAVEN_BROWSER,headless:true,args:['--no-sandbox']});
 const errors=[]; const page=await browser.newPage({viewport:{width:915,height:412},isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.resolve('app/src/main/assets/index.html'));
 await page.waitForTimeout(2500);
 const result=await page.evaluate(()=>({title:document.title,buttons:document.querySelectorAll('button').length,canvas:document.querySelectorAll('canvas').length}));
 await page.screenshot({path:'reports/startup.png'});
 if(errors.length||!result.buttons||!result.canvas)throw Error(JSON.stringify({errors,result}));
 // Regression: Ashvale and the nearby Wayfarer's Camp must be independently tappable.
 // Normal pointer clicks (not force-clicks) catch overlapping hit boxes.
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Start New Game'}).click();
 await page.getByRole('button',{name:'Tap to Continue'}).click();
 await page.locator('#characterName').fill('AtlasSmoke');
 await page.getByRole('button',{name:'Begin Journey'}).click();
 await page.waitForFunction(()=>typeof hasStarted!=='undefined'&&hasStarted,null,{timeout:15000});
 await page.evaluate(()=>openTravelScreen());
 const ash=page.locator('.atlasNode[data-travel-to="ashvale"]');
 const camp=page.locator('.atlasNode[data-travel-to="wayfarers_camp"]');
 async function assertAtlasSelection(pin,expected,mode){
  await pin.click({timeout:8000});
  const details=await page.locator('#atlasSelection').innerText();
  if(!details.startsWith(expected))throw Error(`Atlas ${mode}: expected ${expected} but selected ${JSON.stringify(details)}`);
  const location=await page.evaluate(()=>mapId);
  if(location!=='wayfarers_camp')throw Error(`Atlas ${mode}: map tap unexpectedly moved player to ${location}`);
 }
 await assertAtlasSelection(ash,'Ashvale','detail');
 await assertAtlasSelection(camp,'Wayfarer','detail');
 await page.locator('#atlasFit').click();
 await assertAtlasSelection(ash,'Ashvale','fit');
 await assertAtlasSelection(camp,'Wayfarer','fit');
 await page.screenshot({path:'reports/atlas-taps.png'});
 if(errors.length)throw Error(JSON.stringify({errors}));
 await browser.close();
 console.log(JSON.stringify({status:'passed',scope:'Startup and Ashvale/Wayfarer atlas pointer interaction (not native device testing)',...result}));
})().catch(e=>{console.error(e);process.exit(1)});

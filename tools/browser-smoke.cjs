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
 await browser.close();
 if(errors.length||!result.buttons||!result.canvas)throw Error(JSON.stringify({errors,result}));
 console.log(JSON.stringify({status:'passed',scope:'Startup only; not a complete gameplay test',...result}));
})().catch(e=>{console.error(e);process.exit(1)});

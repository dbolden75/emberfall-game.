#!/usr/bin/env python3
"""Comparable isolated browser save/JSON profile; in-memory QA storage, not disk."""
import json,runpy,shutil,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
html_for_browser=runpy.run_path(str(Path(__file__).with_name('browser-interactive-qa.py')))['html_for_browser']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':915,'height':412})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html_for_browser(Path('app/src/main/assets')),wait_until='domcontentloaded',timeout=60000)
 page.get_by_role('button',name='Start New Game',exact=False).click();page.get_by_role('button',name='Tap to Continue').click();page.locator('#characterName').fill('SaveProfile');page.get_by_role('button',name='Begin Journey').click()
 result=page.evaluate('''() => {
  window.jarvisPaused=true;setMap('elderwood',480,315,false);const cases=[];
  for(const count of [0,512,36150])for(const slots of [1,4]){
   const cells={};let n=0;const b=worldBounds();for(let y=Math.floor(b.minY/64);y<=Math.floor(b.maxY/64);y++)for(let x=Math.floor(b.minX/64);x<=Math.floor(b.maxX/64);x++)if(n++<count)cells[x+','+y]=1;
   townQuestState._localExploration={elderwood:cells};saveSlots={};localStorage.setItem(SAVE_SLOTS_KEY,'{}');activeSlotId='slot1';
   for(let i=1;i<=slots;i++)saveSlots['slot'+i]={id:'slot'+i,name:player.name,class:player.class,level:player.level,updated:Date.now(),state:snapshotGameState()};
   localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(saveSlots));const samples=[];saveGame();
   for(let i=0;i<7;i++){
    const originalParse=JSON.parse,originalStringify=JSON.stringify;let parseMs=0,stringifyMs=0,parses=0,stringifies=0;
    JSON.parse=function(...args){const t=performance.now();try{return originalParse(...args);}finally{parseMs+=performance.now()-t;parses++;}};
    JSON.stringify=function(...args){const t=performance.now();try{return originalStringify(...args);}finally{stringifyMs+=performance.now()-t;stringifies++;}};
    const t=performance.now();try{saveGame();}finally{samples.push({totalMs:performance.now()-t,parseMs,stringifyMs,parses,stringifies});JSON.parse=originalParse;JSON.stringify=originalStringify;}
    if(document.getElementById('saveFailureWarning'))throw Error('Save warning');
   }
   const text=ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId);ThornhavenCloudSaveCore.parse(text);
   cases.push({cells:count,slots,bytes:new TextEncoder().encode(localStorage.getItem(SAVE_SLOTS_KEY)).length,samples,cloudRoundtrip:true});
  }
  return cases;
 }''')
 assert not errors,errors
 b.close()
 Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/wilderness-save-performance.json').write_text(json.dumps(result,indent=2))
 for c in result:
  samples=c['samples'];print(c['cells'],c['slots'],'median_ms',sorted(s['totalMs'] for s in samples)[3],'max_ms',max(s['totalMs'] for s in samples),'JSON_calls',samples[-1]['parses'],samples[-1]['stringifies'],flush=True)

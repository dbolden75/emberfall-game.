#!/usr/bin/env python3
"""Thornhaven packaged-game joystick steering/layout/save preference browser QA.

Only synthetic browser storage and headless Chromium are exercised; not Android,
Google Play, maintained-key installation, or physical touch hardware.
"""
import argparse
import json
import re
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

SCRIPT_TAG = re.compile(r'<script\s+src="([^"]+)"\s*>\s*</script>')


def html_for_browser(assets: Path, seed=None) -> str:
    html = (assets / 'index.html').read_text(encoding='utf-8')
    refs = SCRIPT_TAG.findall(html)
    assert len(refs) >= 5, 'Incomplete game script list'
    for name in refs:
        assert ':' not in name and not name.startswith('/') and '..' not in Path(name).parts, name
        html = html.replace(f'<script src="{name}"></script>',
                            '<script>\n' + (assets / name).read_text(encoding='utf-8') + '\n</script>')
    assert not SCRIPT_TAG.search(html), 'Unresolved game script'
    shim = r'''<script>
window.__qaStorage=__SEED__;
function qaStorage(prefix){
  const keys=()=>Object.keys(__qaStorage).filter(k=>k.startsWith(prefix));
  return {
    getItem(k){return Object.hasOwn(__qaStorage,prefix+k)?__qaStorage[prefix+k]:null},
    setItem(k,v){__qaStorage[prefix+k]=String(v)},
    removeItem(k){delete __qaStorage[prefix+k]},
    clear(){for(const k of keys())delete __qaStorage[k]},
    key(i){return keys()[i]?.slice(prefix.length)??null},
    get length(){return keys().length}
  }
}
Object.defineProperty(window,'localStorage',{configurable:true,value:qaStorage('local:')});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:qaStorage('session:')});
</script>'''.replace('__SEED__', json.dumps(seed or {}, separators=(',', ':')))
    return html.replace('<head>', '<head>' + shim, 1)


def check_layout(page, side, mode, orientation):
    return page.evaluate('''([side,mode])=>{
      setControlSide(side);setMovementMode(mode);
      const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();
        return {x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(e).display}};
      return {side:document.body.dataset.controlSide,mode:document.body.dataset.movementMode,
        pad:rect('.shell .controls'),actions:rect('.shell .actions'),
        attack:rect('#attack'),skill:rect('#skillButton'),
        w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth};
    }''', [side, mode])


def assert_layout(box):
    a, p = box['actions'], box['pad']
    assert box['scrollW'] <= box['w'], f'Horizontal gameplay overflow: {box}'
    assert 0 <= a['x'] and a['x'] + a['w'] <= box['w'] + 1, f'Actions clipped: {box}'
    assert 0 <= a['y'] and a['y'] + a['h'] <= box['h'] + 1, f'Actions vertically clipped: {box}'
    assert box['attack']['w'] >= 60 and box['skill']['w'] >= 44, f'Action controls too small: {box}'
    if box['mode'] == 'arrows':
        assert p['display'] != 'none' and p['w'] >= 120, f'Joystick hidden: {box}'
        assert 0 <= p['x'] and p['x'] + p['w'] <= box['w'] + 1, f'Joystick clipped: {box}'
        assert 0 <= p['y'] and p['y'] + p['h'] <= box['h'] + 1, f'Joystick vertically clipped: {box}'
        gap = max(a['x'] - (p['x'] + p['w']), p['x'] - (a['x'] + a['w']))
        assert gap >= 8, f'Joystick overlaps actions: {box}'
        assert (p['x'] < a['x']) == (box['side'] == 'right'), f'Side swap failed: {box}'
    else:
        assert p['display'] == 'none', f'Touch mode should hide joystick: {box}'
        # Compare the group center, not its left edge: on a 320px viewport a
        # correctly right-aligned 158px group starts at x=157 (left of midpoint).
        # Strict comparisons also reject an incorrectly centered action group.
        center = a['x'] + a['w']/2
        correct_side = center < box['w']/2 if box['side'] == 'left' else center > box['w']/2
        assert correct_side, f'Touch mode action side failed: {box}'


def assert_hit_targets(page, mode):
    """Check real hit-testing, not only element rectangles.

    A control can be within the viewport yet be covered by another overlay;
    center taps must reach the joystick and all three battle actions.
    """
    selectors = ['#attack', '#skillButton', '#dodgeButton',\n                 '#explorationActions button:first-child',\n                 '#explorationActions button:last-child']
    if mode == 'arrows':
        selectors.append('.shell .controls')
    hits = page.evaluate("""selectors => selectors.map(selector => {
      const target = document.querySelector(selector);
      if (!target) return {selector, hit: false, reason: 'missing'};
      const rect = target.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2,
                                            rect.y + rect.height / 2);
      return {selector, hit: rect.width > 0 && rect.height > 0 &&
              !!top && (top === target || target.contains(top)),
              top: top && (top.id || top.className || top.tagName)};
    })""", selectors)
    assert all(hit['hit'] for hit in hits), f'Controls covered by another UI layer: {hits}'


def steer(page):
    pad = page.locator('.shell .controls').bounding_box()
    assert pad and pad['width'] >= 120, pad
    cx = pad['x'] + pad['width']/2
    cy = pad['y'] + pad['height']/2
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx, cy-39, steps=4)
    up = page.evaluate("({held:[...keys].filter(x=>x.startsWith('Touch:')),count:movementTouches.size})")
    assert up == {'held':['Touch:ArrowUp'],'count':1}, f'Joystick held-up failure: {up}'
    # Sliding the same finger must change direction without lifting.
    page.mouse.move(cx+39, cy, steps=6)
    right = page.evaluate("({held:[...keys].filter(x=>x.startsWith('Touch:')),count:movementTouches.size})")
    assert right == {'held':['Touch:ArrowRight'],'count':1}, f'Continuous turn failure: {right}'
    page.mouse.move(cx, cy, steps=3)
    neutral = page.evaluate("[...keys].filter(x=>x.startsWith('Touch:'))")
    assert neutral == [], f'Neutral joystick did not stop: {neutral}'
    page.mouse.up()
    released = page.evaluate("({held:[...keys].filter(x=>x.startsWith('Touch:')),count:movementTouches.size,x:movementPad.style.getPropertyValue('--stick-x'),y:movementPad.style.getPropertyValue('--stick-y')})")
    assert released == {'held':[], 'count':0, 'x':'0px', 'y':'0px'}, f'Stuck joystick after release: {released}'


def check_case(browser, assets: Path, evidence: Path, name: str, w: int, h: int):
    page = browser.new_page(viewport={'width':w,'height':h}, is_mobile=True, has_touch=True)
    page.set_default_timeout(15000)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    try:
        page.set_content(html_for_browser(assets), wait_until='domcontentloaded', timeout=60000)
        page.get_by_role('button', name=re.compile('Start New Game')).click()
        page.get_by_role('button', name='Tap to Continue').click()
        hero='QASteer'+name.capitalize()
        page.locator('#characterName').fill(hero)
        page.get_by_role('button', name='Begin Journey').click()
        cases=[]
        for side in ('right','left'):
            box=check_layout(page,side,'arrows',name)
            assert_layout(box)
            assert_hit_targets(page, 'arrows')
            steer(page)
            cases.append(f'{side}-joystick')
            box=check_layout(page,side,'touch',name)
            assert_layout(box)
            assert_hit_targets(page, 'touch')
            cases.append(f'{side}-touch')
        # Exact preference keys must be persisted by the real game setters.
        assert page.evaluate("localStorage.getItem('emberfall_control_side_v1')") == 'left'
        assert page.evaluate("localStorage.getItem('thornhaven_movement_mode_v2')") == 'touch'
        page.evaluate('saveGame()')
        seed=page.evaluate('window.__qaStorage')
        evidence.mkdir(parents=True,exist_ok=True)
        page.evaluate("setMovementMode('arrows')")
        page.screenshot(path=str(evidence / (name + '-left-joystick.png')),timeout=20000)
        page.evaluate("setMovementMode('touch')")
        page.screenshot(path=str(evidence / (name + '-left-touch.png')),timeout=20000)
        resumed=browser.new_page(viewport={'width':w,'height':h},is_mobile=True,has_touch=True)
        resume_errors=[]
        resumed.on('pageerror',lambda e:resume_errors.append(str(e)))
        try:
            resumed.set_content(html_for_browser(assets,seed),wait_until='domcontentloaded',timeout=60000)
            resumed.locator('#titleContinue').click()
            state=resumed.evaluate("({name:player.name,side:document.body.dataset.controlSide,mode:document.body.dataset.movementMode})")
            assert state=={'name':hero,'side':'left','mode':'touch'},f'Preferences lost on reload: {state}'
        finally:
            resumed.close()
        assert not errors and not resume_errors, f'Uncaught game JS errors: {errors+resume_errors}'
        return {'orientation':name,'viewport':[w,h],'tested':cases,
                'held_turn_and_release':True,'preferences_restored_after_reload':True,
                'uncaught_errors':0}
    finally:
        page.close()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--assets',default='app/src/main/assets')
    ap.add_argument('--browser',default=(shutil.which('chromium') or shutil.which('google-chrome')))
    ap.add_argument('--evidence-dir',default='reports/browser-joystick-qa')
    args=ap.parse_args()
    if not args.browser:raise SystemExit('Chromium missing')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            results=[check_case(browser,Path(args.assets),Path(args.evidence_dir),name,w,h)
                     for name,w,h in [('portrait',420,900),('landscape',900,420),
                                      ('p360',360,780),('l780',780,360),
                                      ('p320',320,568),('l568',568,320),\n                                      ('l480',480,320)]]
        finally:
            browser.close()
    print(json.dumps({'status':'PASS','scope':'Headless Chromium, real packaged HTML, synthetic storage; not Android/Play or hardware','results':results},indent=2))

if __name__=='__main__':main()

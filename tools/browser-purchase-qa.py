#!/usr/bin/env python3
"""Thornhaven packaged HTML and native-billing-bridge simulation regression.

No real Play Billing, receipt verification, checkout, Android/WebView, or device
storage is exercised. Fake native callbacks are injected ONLY in Chromium QA.
"""
import argparse
import json
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

SCRIPT_TAG = re.compile(r'<script\s+src="([^"]+)"\s*>\s*</script>')
PRODUCT = 'thornhaven_levels_1'
STYLE = 'emberfall_aura_embers'


def make_html(assets, seed=None):
    html = (assets / 'index.html').read_text(encoding='utf-8')
    for script in SCRIPT_TAG.findall(html):
        assert not script.startswith('/') and ':' not in script and '..' not in Path(script).parts, script
        html = html.replace(f'<script src="{script}"></script>',
                            '<script>\n' + (assets / script).read_text(encoding='utf-8') + '\n</script>')
    assert not SCRIPT_TAG.search(html), 'Unresolved external script'
    shim = r'''<script>
window.__qaStorage = __SEED__;
function qaStore(scope) {
  const prefix=scope+':';
  const keys=()=>Object.keys(window.__qaStorage).filter(k=>k.startsWith(prefix));
  return {
    getItem:k=>Object.prototype.hasOwnProperty.call(window.__qaStorage,prefix+k)?window.__qaStorage[prefix+k]:null,
    setItem:(k,v)=>{window.__qaStorage[prefix+k]=String(v)},
    removeItem:k=>{delete window.__qaStorage[prefix+k]},
    clear:()=>{for(const k of keys())delete window.__qaStorage[k]},
    key:i=>keys()[i]?.slice(prefix.length)??null,
    get length(){return keys().length}
  };
}
Object.defineProperty(window,'localStorage',{configurable:true,value:qaStore('local')});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:qaStore('session')});
window.__qaBilling = {
  products: {'thornhaven_levels_1':{price:'$0.99'}, 'emberfall_aura_embers':{price:'$1.99'}},
  owned: [], deliveries: [], buys: [], acks: [], restores: 0,
  state() {return JSON.stringify({products:this.products, owned:this.owned,
    deliveries:this.deliveries, busy:false, message:'QA simulated native bridge'});}
};
window.ThornhavenPlayPurchases={
  state:()=>window.__qaBilling.state(),
  buy:(product,profile)=>window.__qaBilling.buys.push({product,profile}),
  delivered:id=>{window.__qaBilling.acks.push(id);window.__qaBilling.deliveries=window.__qaBilling.deliveries.filter(r=>r.id!==id)},
  restore:()=>{window.__qaBilling.restores++}
};
</script>'''.replace('__SEED__',json.dumps(seed or {},separators=(',',':')))
    assert '<head>' in html
    return html.replace('<head>','<head>'+shim,1)


def check(browser, assets, evidence, name, width, height):
    page = browser.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_default_timeout(12000)
    try:
        page.set_content(make_html(assets), wait_until='domcontentloaded',timeout=60000)
        assert page.evaluate("ThornhavenMonetization.mode") == 'google-play'
        assert page.evaluate("ThornhavenMonetization===EmberfallMonetization")
        unavailable=page.evaluate(f"() => ThornhavenMonetization.purchase('{PRODUCT}')")
        assert unavailable['status']=='unavailable' and not page.evaluate('window.__qaBilling.buys'),unavailable
        page.get_by_role('button',name=re.compile('Start New Game')).click()
        page.get_by_role('button',name='Tap to Continue').click()
        page.locator('#characterName').fill('QAPurchase'+name.title())
        page.get_by_role('button',name='Begin Journey').click()
        before=page.evaluate("({level:player.level,paid:townQuestState._paidStyles||{}})")
        assert before['level']==1 and before['paid']=={},before
        page.evaluate('pollPlayStore()')
        requested=page.evaluate(f"() => ThornhavenMonetization.purchase('{PRODUCT}')")
        buys=page.evaluate('window.__qaBilling.buys')
        assert requested['status']=='requested' and len(buys)==1 and buys[0]['product']==PRODUCT,(requested,buys)
        profile=buys[0]['profile'];assert re.fullmatch('[a-f0-9]{64}',profile),profile
        stored=page.evaluate("JSON.parse(localStorage.getItem('emberfall_character_slots_v1'))")
        assert any(item['state']['townQuestState'].get('_purchaseProfile')==profile for item in stored.values())
        assert page.evaluate('player.level')==before['level'],'Pending checkout granted levels'
        # Simulated native bridge only: no signature or payment is forged/validated.
        rec='a'*64
        page.evaluate("([id,profile])=>{window.__qaBilling.deliveries=[{id,product:'thornhaven_levels_1',profile}];pollPlayStore()}",[rec,profile])
        lvl=page.evaluate('player.level')
        assert lvl==before['level']+1,('Missing paid level delivery',lvl)
        assert page.evaluate('window.__qaBilling.acks')==[rec],'Not acknowledged after durable save'
        page.evaluate('pollPlayStore()')
        assert page.evaluate('player.level')==lvl,'Repeated native callback duplicated level reward'
        # Even a valid-looking native callback for a different character must stay pending.
        page.evaluate("() => {window.__qaBilling.deliveries=[{id:'"+'b'*64+"',product:'thornhaven_levels_1',profile:'"+'f'*64+"'}];pollPlayStore()}")
        assert page.evaluate('player.level')==lvl,'Wrong profile receipt changed player level'
        assert page.evaluate('window.__qaBilling.acks')==[rec],'Wrong profile was acknowledged'
        # The authoritative slot write must succeed BEFORE native delivery is confirmed.
        page.evaluate("""() => {
          const prior=localStorage.setItem.bind(localStorage);
          localStorage.setItem=(key,value)=>{if(key===SAVE_SLOTS_KEY)throw Error('QA no storage');return prior(key,value)};
          window.__qaBilling.deliveries=[{id:'"""+'c'*64+"""',product:'thornhaven_levels_1',profile:townQuestState._purchaseProfile}];
          pollPlayStore(); localStorage.setItem=prior;
        }""")
        assert page.evaluate('player.level')==lvl,'Storage failure granted uncommitted reward'
        assert page.evaluate('window.__qaBilling.acks')==[rec],'Storage failure acknowledged receipt'
        # A valid new native delivery can retry after storage recovers.
        page.evaluate('pollPlayStore()')
        assert page.evaluate('player.level')==lvl+1
        assert page.evaluate('window.__qaBilling.acks')==[rec,'c'*64]
        # Cosmetic ownership is from native state, not a preview alone.
        page.evaluate("() => {window.__qaBilling.deliveries=[{id:'"+'d'*64+"',product:'emberfall_aura_embers',profile:''}];window.__qaBilling.owned=['emberfall_aura_embers'];pollPlayStore()}")
        assert page.evaluate("townQuestState._paidStyles.emberfall_aura_embers===true")
        assert page.evaluate("purchaseOwned('emberfall_aura_embers')")
        assert page.evaluate('window.__qaBilling.acks')==[rec,'c'*64,'d'*64]
        assert page.evaluate("Object.keys(townQuestState._playReceipts).length")==3
        # Native restore must be wired to both public API and visible shop button.
        page.evaluate('() => ThornhavenMonetization.restorePurchases()')
        assert page.evaluate('window.__qaBilling.restores')==1
        page.evaluate('openPremiumShop()')
        page.locator('#restorePurchasesButton').click()
        assert page.evaluate('window.__qaBilling.restores')==2
        assert page.locator('#forumShopButton').is_hidden(), 'Forbidden external payment link visible'
        assert not errors,errors[:5]
        evidence.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(evidence / f'{name}-purchase-simulated.png'),timeout=20000)
        page.evaluate('saveGame()')
        slots=page.evaluate("JSON.parse(localStorage.getItem('emberfall_character_slots_v1'))")
        assert any(slot['state']['player']['level']==lvl+1 and
                   len(slot['state']['townQuestState'].get('_playReceipts',{}))==3
                   for slot in slots.values()),'Paid purchases not durably stored in character slots'
        return {'orientation':name,'native_bridge':'simulated-only','level_grants':2,'idempotent':True,
                'wrong_profile_rejected':True,'failed_save_no_ack':True,'cosmetic_saved':True,
                'restore_ui':True,'saved_slot_verified':True,'uncaught_errors':0}
    finally:page.close()


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--assets',default='app/src/main/assets')
    p.add_argument('--evidence-dir',default='reports/browser-purchase-qa')
    p.add_argument('--browser',default=shutil.which('chromium') or shutil.which('google-chrome'))
    p.add_argument('--orientation',choices=['portrait','landscape'],default='portrait')
    args=p.parse_args();assert args.browser,'Chromium missing'
    with sync_playwright() as pl:
        browser=pl.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            width,height=(420,900) if args.orientation=='portrait' else (900,420)
            results=[check(browser,Path(args.assets),Path(args.evidence_dir),args.orientation,width,height)]
        finally:browser.close()
    print(json.dumps({'status':'PASS','scope':'Offline Chromium plus MOCK native bridge; no actual purchase/Play verification','results':results},indent=2))

if __name__=='__main__':main()

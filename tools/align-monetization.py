"""Apply reviewed shop changes after authenticated historical HTML reconstruction."""
import json,re

def align(content):
    text=content.decode()
    match=re.search(r'const PREMIUM_PRODUCTS=(\[.*?\]);',text)
    products=json.loads(match[1])
    for p in products:
        if p['category'] in ('xp','levels'):
            p['saleEnabled']=False
            p['legacyRestoreOnly']=True
    for p in [
        dict(id='thornhaven_crowns_100',name='100 Crowns',category='crowns',crowns=100,icon='♛',description='Adds 100 crowns to this character. Draft pack; contents and price await approval.'),
        dict(id='thornhaven_pet_dragon',name='Sol · Paid Pet',category='pet',petId='ember_dragon',petHealth=96,petClass='mage',icon='🐉',description='Draft dragon companion for this character. Sale disabled pending quest-gate and price approval.')
    ]:
        p.update(productType='consumable',gameplayBonus=True,launchStatus='draft',saleEnabled=False,color='#e4bf66')
        products.append(p)
    text=text[:match.start(1)]+json.dumps(products,ensure_ascii=False,separators=(',',':'))+text[match.end(1):]
    text=text.replace("PREMIUM_PRODUCTS.filter(p=>premiumCategory", "PREMIUM_PRODUCTS.filter(p=>p.saleEnabled!==false).filter(p=>premiumCategory")
    text=text.replace("['xp','builder','levels'].includes(p.category)","['xp','builder','levels','crowns','pet'].includes(p.category)")
    old='saveSlots=slots;townQuestState=next.townQuestState;player.level=next.player.level;'
    assert text.count(old)==1
    text=text.replace(old,old+'player.coins=next.player.coins;if(next.companions)companions=next.companions;')
    text=text.replace("if(!p)return;const next=snapshotGameState()", "if(!p||p.saleEnabled===false)return;const next=snapshotGameState()")
    text=text.replace("buy.disabled=!owned&&(!details||playStore.busy||danTesting());", "buy.disabled=p.saleEnabled===false||(!owned&&(!details||playStore.busy||danTesting()));")
    text=text.replace("if(danTesting()){const test=document.createElement('button');", "if(danTesting()&&p.saleEnabled!==false){const test=document.createElement('button');")
    text=text.replace('Levels and boost credits belong to the selected character', 'Crowns, pets and builder credits belong to the selected character')
    return text.encode()

"""Apply reviewed shop changes after authenticated historical HTML reconstruction."""
import json, re


def replace_exact(text, old, new, expected=1):
    count = text.count(old)
    if count != expected:
        raise ValueError(f'Monetization source template drift: expected {expected} occurrence(s) of {old!r}, found {count}')
    return text.replace(old, new)


def align(content):
    text = content.decode()
    matches = list(re.finditer(r'const PREMIUM_PRODUCTS=(\[.*?\]);', text))
    if len(matches) != 1:
        raise ValueError(f'Monetization catalog drift: expected exactly one PREMIUM_PRODUCTS array, found {len(matches)}')
    match = matches[0]
    products = json.loads(match[1])
    for p in products:
        if p['category'] in ('xp', 'levels'):
            p['saleEnabled'] = False
            p['legacyRestoreOnly'] = True
    for p in [
        dict(id='thornhaven_crowns_100', name='100 Crowns', category='crowns', crowns=100, icon='♛', description='Adds 100 crowns to this character. Draft pack; contents and price await approval.'),
        dict(id='thornhaven_pet_dragon', name='Sol · Paid Pet', category='pet', petId='ember_dragon', petHealth=96, petClass='mage', icon='🐉', description='Draft dragon companion for this character. Sale disabled pending quest-gate and price approval.')
    ]:
        p.update(productType='consumable', gameplayBonus=True, launchStatus='draft', saleEnabled=False, color='#e4bf66')
        products.append(p)
    text = text[:match.start(1)] + json.dumps(products, ensure_ascii=False, separators=(',', ':')) + text[match.end(1):]
    text = replace_exact(text, 'PREMIUM_PRODUCTS.filter(p=>premiumCategory', 'PREMIUM_PRODUCTS.filter(p=>p.saleEnabled!==false).filter(p=>premiumCategory')
    text = replace_exact(text, "['xp','builder','levels'].includes(p.category)", "['xp','builder','levels','crowns','pet'].includes(p.category)", expected=4)
    old = 'saveSlots=slots;townQuestState=next.townQuestState;player.level=next.player.level;'
    text = replace_exact(text, old, old + 'player.coins=next.player.coins;if(next.companions)companions=next.companions;')
    text = replace_exact(text, 'if(!p)return;const next=snapshotGameState()', 'if(!p||p.saleEnabled===false)return;const next=snapshotGameState()')
    text = replace_exact(text, 'buy.disabled=!owned&&(!details||playStore.busy||danTesting());', 'buy.disabled=p.saleEnabled===false||(!owned&&(!details||playStore.busy||danTesting()));')
    text = replace_exact(text, "if(danTesting()){const test=document.createElement('button');", "if(danTesting()&&p.saleEnabled!==false){const test=document.createElement('button');")
    text = replace_exact(text, 'Levels and boost credits belong to the selected character', 'Crowns, pets and builder credits belong to the selected character')
    return text.encode()

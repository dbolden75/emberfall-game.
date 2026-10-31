#!/usr/bin/env python3
"""Packaged-game browser QA: starter pet fighting, death, healer and save/resume.

Uses QA-only enemy placement, health and currency plus in-memory browser storage.
Never treats a passing browser test as evidence of Android or Google Play delivery.
"""
import argparse
import json
import re
import runpy
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

html_for_browser = runpy.run_path(
    str(Path(__file__).resolve().parent / 'browser-interactive-qa.py')
)['html_for_browser']


def run_orientation(browser, assets, evidence, orientation, width, height):
    page = browser.new_page(
        viewport={'width': width, 'height': height},
        is_mobile=True, has_touch=True, device_scale_factor=1
    )
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    try:
        page.set_content(html_for_browser(assets), wait_until='domcontentloaded', timeout=60000)
        page.get_by_role('button', name=re.compile('Start New Game')).click()
        page.get_by_role('button', name='Tap to Continue').click()
        hero = 'QAPetPortrait' if orientation == 'portrait' else 'QAPetLandscape'
        page.locator('#characterName').fill(hero)
        page.get_by_role('button', name='Begin Journey').click()
        starter = page.evaluate("""() => ({
            pets:companions.map(c=>({id:c.id,active:c.active,hp:c.hp,max:c.max,level:c.level})),
            active:activeCompanions().map(c=>c.id),heroLevel:player.level,
            expected:petLevel()
        })""")
        assert len(starter['pets']) == 1 and starter['pets'][0]['id'] == 'dalen', starter
        assert starter['active'] == ['dalen'] and starter['pets'][0]['hp'] > 0, starter
        assert starter['pets'][0]['level'] == starter['expected'] == 1, starter

        # Only the test's starting positions and enemy HP are controlled.
        # The real updateCompanions function must steer and damage the target.
        combat = page.evaluate("""() => {
            const entry=mapEntry('northridge','default');
            if (!setMap('northridge',...entry)) throw Error('Missing wilderness map');
            const pet=activeCompanions()[0], target=enemies.find(e=>e.alive);
            if (!pet||!target||activeMap.town) throw Error('Missing live pet or enemy');
            player.x=480;player.y=315;pet.x=510;pet.y=315;
            Object.assign(target,{x:550,y:315,hp:200,max:200,alive:true});
            if (!clearCombatLine(pet.x,pet.y,target.x,target.y)) throw Error('QA path blocked');
            const initial=target.hp;
            let hits=0,facing=0,direction=0;
            for(let i=0;i<90;i++){
                const before=target.hp; updateCompanions(.15);
                if(target.hp<before){
                    hits++; direction=Math.hypot(pet.faceX||0,pet.faceY||0);
                    facing=pet.faceX*(target.x-pet.x)+pet.faceY*(target.y-pet.y);
                }
            }
            return {map:mapId,initial,remaining:target.hp,hits,facing,direction,
                    power:petAttackPower(pet),petHp:pet.hp};
        }""")
        assert combat['map'] == 'northridge' and combat['remaining'] < combat['initial'], combat
        assert combat['hits'] >= 1 and combat['facing'] > 0, combat
        assert combat['direction'] > .5 and combat['power'] > 0, combat

        # A fallen pet cannot attack or be reselected before healing.
        dead = page.evaluate("""() => {
            const pet=companions.find(c=>c.id==='dalen'),target=enemies.find(e=>e.alive);
            pet.hp=0; target.hp=200;
            for(let i=0;i<40;i++) updateCompanions(.15);
            const remaining=target.hp;
            setCompanionActive('dalen');
            return {enemyHp:remaining,petHp:pet.hp,active:activeCompanions().length};
        }""")
        assert dead == {'enemyHp':200,'petHp':0,'active':0}, dead

        # No free revival: a town healer charges five crowns and revives the pet.
        # Restored-but-inactive pets must remain selectable (not forced active).
        healed = page.evaluate("""() => {
            const entry=mapEntry('ashvale','default');setMap('ashvale',...entry);
            const npc=activeMap.npcs.find(n=>n.role==='healer');
            const pet=companions.find(c=>c.id==='dalen');
            if(!npc||!activeMap.town||enemies.some(e=>e.alive))throw Error('Town healer unavailable');
            player.coins=0; healAtTown(npc);
            const denied={coins:player.coins,hp:pet.hp};
            player.coins=5; healAtTown(npc);
            if(!activeCompanions().length)setCompanionActive('dalen');
            const restored={coins:player.coins,hp:pet.hp,max:pet.max,
                            active:activeCompanions().map(c=>c.id)};
            ui();saveGame();
            return {map:mapId,denied,restored};
        }""")
        assert healed['map'] == 'ashvale' and healed['denied'] == {'coins':0,'hp':0}, healed
        assert healed['restored']['coins'] == 0, healed
        assert healed['restored']['hp'] == healed['restored']['max'], healed
        assert healed['restored']['active'] == ['dalen'], healed

        expected = page.evaluate("""() => ({
            name:player.name,map:mapId,coins:player.coins,
            pets:companions.map(c=>({id:c.id,active:c.active,hp:c.hp,max:c.max,level:c.level}))
        })""")
        seed = page.evaluate('window.__qaStorage')
        assert 'local:emberfall_character_slots_v1' in seed, 'Character not saved'
        evidence.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(evidence / (orientation + '-pet-healer.png')), timeout=20000)

        reopened = browser.new_page(
            viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True
        )
        reload_errors = []
        reopened.on('pageerror', lambda err:reload_errors.append(str(err)))
        try:
            reopened.set_content(html_for_browser(assets, seed),
                                 wait_until='domcontentloaded',timeout=60000)
            reopened.locator('#titleContinue').click()
            actual = reopened.evaluate("""() => ({
                name:player.name,map:mapId,coins:player.coins,
                pets:companions.map(c=>({id:c.id,active:c.active,hp:c.hp,max:c.max,level:c.level}))
            })""")
            assert actual == expected, f'Pet save/Continue mismatch: {expected} != {actual}'
            assert not reload_errors, f'Reload errors: {reload_errors[:4]}'
            reopened.screenshot(path=str(evidence / (orientation + '-pet-resume.png')),timeout=20000)
        finally:
            reopened.close()
        assert not errors, f'Game JS errors: {errors[:4]}'
        return {'orientation':orientation,'starter_pet':'dalen',
                'pet_damage':combat['initial']-combat['remaining'],
                'pet_faced_target_when_attacking':True,'death_disables_attack':True,
                'healer_fee_enforced':True,'healer_revived_pet':True,
                'save_continue_restored_pet':True,'uncaught_js_errors':0}
    finally:
        page.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--assets',default='app/src/main/assets')
    parser.add_argument('--browser',default=(shutil.which('google-chrome')
                        or shutil.which('chromium') or shutil.which('chromium-browser')))
    parser.add_argument('--evidence-dir',default='reports/browser-pet-combat-qa')
    parser.add_argument('--orientation',choices=['both','portrait','landscape'],default='both')
    a=parser.parse_args()
    if not a.browser:raise SystemExit('Chromium/Chrome required')
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(
            executable_path=a.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            cases=[('portrait',420,900),('landscape',900,420)]
            results=[run_orientation(browser,Path(a.assets).resolve(),
                    Path(a.evidence_dir).resolve(),name,w,h)
                for name,w,h in cases if a.orientation in ('both',name)]
        finally:
            browser.close()
    print(json.dumps({'status':'PASS',
        'scope':'Packaged game assets, Chromium synthetic storage, QA battle positioning; not Android or Play',
        'results':results},indent=2))


if __name__=='__main__':
    main()

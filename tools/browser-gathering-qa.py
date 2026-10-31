#!/usr/bin/env python3
"""Thornhaven novice gathering regression from actual packaged game assets.

Browser-only QA: uses in-memory storage and QA relocations to resource nodes.
Checks purchased tools, real INTERACT button, gathering rewards and skill XP,
resource cooldown, all four town mining copper accessibility, and save resume.
Not proof of Android touch, Play delivery, or device storage durability.
"""
import argparse
import json
import re
import runpy
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

html_for_browser = runpy.run_path(str(Path(__file__).resolve().parent / 'browser-interactive-qa.py'))['html_for_browser']

TOWNS = ('ashvale', 'sunmere', 'brackenford', 'stonewatch')
TOOLS = {'mining': 'mining_pick', 'woodcutting': 'woodcutting_hatchet', 'fishing': 'fishing_rod'}


def snapshot(page, skill):
    return page.evaluate('''skill => {
      const node=activeMap.gatherNodes.find(n=>n.skill===skill);
      if (!node) throw Error('No '+skill+' node in '+mapId);
      const product=gatherOutput(node);
      return {town:mapId, node:node.id, product, count:bagCount(product),
        xp:gatheringSkills[skill].xp, level:gatheringSkills[skill].level,
        cooldown:node.readyAt>Date.now(),coins:player.coins};
    }''', skill)


def stand_at_resource(page, skill):
    # QA-only relocation; actual collection uses the visible game's INTERACT button.
    page.evaluate('''skill => {
      const node=activeMap.gatherNodes.find(n=>n.skill===skill);
      if (!node) throw Error('Missing '+skill+' gathering resource');
      player.x=node.x; player.y=node.y; ui();
    }''', skill)


def run_orientation(browser, assets, evidence_dir, orientation, width, height):
    page = browser.new_page(viewport={'width':width, 'height':height},
                            is_mobile=True, has_touch=True, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(12000)
    try:
        page.set_content(html_for_browser(assets), wait_until='domcontentloaded', timeout=60000)
        page.get_by_role('button', name=re.compile('Start New Game')).click()
        page.get_by_role('button', name='Tap to Continue').click()
        hero = 'QAGatherPortrait' if orientation == 'portrait' else 'QAGatherLandscape'
        page.locator('#characterName').fill(hero)
        page.get_by_role('button', name='Begin Journey').click()

        page.evaluate("() => {const e=mapEntry('ashvale','default');setMap('ashvale',...e);ui();}")
        # A novice MUST NOT be allowed to mine without a pick.
        stand_at_resource(page, 'mining')
        no_tool = snapshot(page, 'mining')
        assert no_tool['product'] == 'copper_ore' and no_tool['level'] == 1, no_tool
        page.get_by_role('button', name='INTERACT').click()
        after_no_tool = snapshot(page, 'mining')
        assert after_no_tool['xp'] == no_tool['xp'] and after_no_tool['count'] == no_tool['count'], after_no_tool
        assert 'Mining Pick' in page.locator('body').inner_text(), 'Missing tool instruction'

        # Coins are QA-only setup; purchase paths, pricing and inventory remain
        # the application's own functions. No forged gathered items or XP.
        setup = page.evaluate('''() => {
          player.coins=50; activeShopId='ashvale_market';
          const before=player.coins;
          const prices=['mining_pick','woodcutting_hatchet','fishing_rod'].map(id=>itemDefs[id].price);
          for(const id of ['mining_pick','woodcutting_hatchet','fishing_rod'])buyItem(id);
          return {before,after:player.coins,prices,owned:
            ['mining_pick','woodcutting_hatchet','fishing_rod'].map(id=>bagCount(id))};
        }''')
        assert setup['owned'] == [1,1,1], f'Unable to buy novice gathering tools: {setup}'
        assert setup['after'] == setup['before'] - sum(setup['prices']), f'Tools charged wrong prices: {setup}'

        records = []
        for town in TOWNS:
            page.evaluate("id=>{const entry=mapEntry(id,'default');setMap(id,...entry);ui();}", town)
            for skill, tool in TOOLS.items():
                stand_at_resource(page, skill)
                before = snapshot(page, skill)
                assert before['town'] == town and not before['cooldown'], before
                assert before['level'] == 1, f'Expected novice level until fourth town: {before}'
                if skill == 'mining':
                    assert before['product'] == 'copper_ore', f'Novice town blocked by high-tier ore: {before}'
                page.get_by_role('button', name='INTERACT').click()
                after = snapshot(page, skill)
                assert after['xp'] == before['xp'] + 12, f'Gathering XP missing: {before} {after}'
                assert after['count'] == before['count'] + 1, f'Gathering item missing: {before} {after}'
                assert after['cooldown'], f'Depleted node not on cooldown: {after}'
                # Repeated interaction must not yield another item while depleted.
                page.get_by_role('button', name='INTERACT').click()
                repeat = snapshot(page, skill)
                assert repeat['count'] == after['count'] and repeat['xp'] == after['xp'], (
                    f'Cooldown allowed reward farming: {after} {repeat}')
                records.append({'town': town, 'skill':skill, 'product':after['product']})

        # Fifth novice gather upgrades all three skills from level 1 to level 2.
        # Woodcutting/mining use unused Ashvale nodes; for its single fishing
        # node, simulate the passage of the 30-second cooldown in QA only.
        page.evaluate("() => {const e=mapEntry('ashvale','default');setMap('ashvale',...e);ui();}")
        for skill in TOOLS:
            page.evaluate('''skill=>{
              let node=activeMap.gatherNodes.filter(n=>n.skill===skill).find(n=>!n.readyAt || n.readyAt<=Date.now());
              if(!node && skill==='fishing') {
                node=activeMap.gatherNodes.find(n=>n.skill==='fishing');
                if(node)node.readyAt=Date.now()-1; // QA simulated cooldown expiry, no free items/XP.
              }
              if(!node)throw Error('No available '+skill+' node');
              player.x=node.x;player.y=node.y;ui();
            }''', skill)
            page.get_by_role('button', name='INTERACT').click()
            stats = page.evaluate('skill=>gatheringSkills[skill]', skill)
            assert stats == {'xp':60,'level':2}, f'Level up did not occur for {skill}: {stats}'

        expected = page.evaluate('''() => ({name:player.name, map:mapId,
          skills:JSON.stringify(gatheringSkills), inventory:JSON.stringify(player.inventory)})''')
        page.evaluate('saveGame()')
        seed = page.evaluate('window.__qaStorage')
        assert 'local:emberfall_character_slots_v1' in seed
        evidence_dir.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(evidence_dir / f'{orientation}-gathering-skills.png'), timeout=20000)
        reopened = browser.new_page(viewport={'width':width,'height':height},
                                    is_mobile=True,has_touch=True,device_scale_factor=1)
        reload_errors = []
        reopened.on('pageerror', lambda error: reload_errors.append(str(error)))
        try:
            reopened.set_content(html_for_browser(assets, seed), wait_until='domcontentloaded', timeout=60000)
            assert reopened.locator('#titleContinue').is_enabled(), 'No saved hero to Continue'
            reopened.locator('#titleContinue').click()
            actual = reopened.evaluate('''() => ({name:player.name, map:mapId,
              skills:JSON.stringify(gatheringSkills), inventory:JSON.stringify(player.inventory)})''')
            assert actual == expected, f'Gathering progress lost on save/reload: {expected} vs {actual}'
            assert not reload_errors, f'Errors after reload: {reload_errors[:4]}'
        finally:
            reopened.close()
        assert not errors, f'Uncaught game errors: {errors[:4]}'
        return {'orientation':orientation,'towns':list(TOWNS),'gathering_checks':len(records),
                'novice_town_ore':'copper_ore', 'tool_purchase':True,
                'no_tool_denial':True, 'node_cooldown':True,
                'skills_level_2':True, 'fresh_page_save_restore':True,
                'page_errors':0}
    finally:
        page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets',default='app/src/main/assets')
    parser.add_argument('--browser',default=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser'))
    parser.add_argument('--evidence-dir',default='reports/browser-gathering-qa')
    parser.add_argument('--orientation',choices=['both','portrait','landscape'],default='both')
    args = parser.parse_args()
    if not args.browser: raise SystemExit('Chromium/Chrome required')
    evidence = Path(args.evidence_dir).resolve()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.browser,headless=True,
                     args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            orientations=[('portrait',420,900),('landscape',900,420)]
            results = [run_orientation(browser,Path(args.assets).resolve(),evidence,name,w,h)
                for name,w,h in orientations if args.orientation in ('both',name)]
        finally:
            browser.close()
    print(json.dumps({'status':'PASS',
          'scope':'Packaged assets, Chromium in-memory saves, QA repositioning; not Android or Play delivery',
          'results':results},indent=2))

if __name__ == '__main__':main()

#!/usr/bin/env python3
"""Browser-only Thornhaven camp tutorial, bidirectional gate, and save QA.

Uses the same hash-restored, unmodified release assets and in-memory storage
polyfill as browser-interactive-qa.py. Teleports near story objects to test
interaction paths deterministically; the return to Ashvale additionally uses
real ArrowDown keyboard movement through the camp's south edge. This does NOT
prove physical movement on a touchscreen, Android persistence, or Play delivery.
"""
import argparse
import json
import re
import runpy
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

html_for_browser = runpy.run_path(str(Path(__file__).resolve().parent / "browser-interactive-qa.py"))["html_for_browser"]


def game_state(page):
    return page.evaluate("""() => ({
        map: mapId, name: player.name, cls: player.class,
        level: player.level, coins: player.coins,
        stage: townQuestState._camp?.stage ?? 0,
        claimed: !!townQuestState._camp?.claimed,
        notes: (townQuestState._camp?.notes || []).map(row => row.id),
        tracking: townQuestState._tracking?.id || null
    })""")


def move_to_and_interact(page, x, y):
    # The relocation is QA-only. Interaction is the actual gameplay UI button.
    page.evaluate("([x,y]) => {player.x=x;player.y=y;ui();}", [x, y])
    page.get_by_role("button", name="INTERACT").click()


def run_orientation(browser, assets, evidence_dir, orientation, width, height):
    page = browser.new_page(viewport={"width": width, "height": height},
                            is_mobile=True, has_touch=True, device_scale_factor=1)
    page.set_default_timeout(15000)
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    hero = "QAStoryPortrait" if orientation == "portrait" else "QAStoryLandscape"
    try:
        page.set_content(html_for_browser(assets), wait_until="domcontentloaded", timeout=60000)
        page.get_by_role("button", name=re.compile("Start New Game")).click()
        page.get_by_role("button", name="Tap to Continue").click()
        page.locator("#characterName").fill(hero)
        page.get_by_role("button", name="Begin Journey").click()
        initial = game_state(page)
        assert initial["map"] == "wayfarers_camp" and initial["stage"] == 0, initial
        assert not initial["claimed"] and not initial["notes"], initial

        # The order is part of the introductory narrative, not just a UI detail.
        move_to_and_interact(page, 480, 505)  # footprints before fire/letter
        assert game_state(page)["stage"] == 0, "Footprints skipped the camp story prerequisites"
        move_to_and_interact(page, 335, 260)  # sealed letter before fire
        assert game_state(page)["stage"] == 0, "Letter skipped the dying campfire"

        move_to_and_interact(page, 480, 310)
        assert game_state(page)["stage"] == 1, "Campfire did not start the story"
        page.get_by_role("button", name="Record the clue").click()
        move_to_and_interact(page, 335, 260)
        assert game_state(page)["stage"] == 2, "Letter did not advance the story"
        page.get_by_role("button", name="Keep the letter in my journal").click()
        move_to_and_interact(page, 480, 505)
        completion = game_state(page)
        assert completion["stage"] == 3 and completion["claimed"], completion
        assert completion["notes"] == ["embers", "message", "tracks"], completion
        assert completion["coins"] == initial["coins"] + 20, (
            f"Intro reward mismatch: {initial['coins']} -> {completion['coins']}")
        assert completion["tracking"] == "briar_hollow", completion
        page.get_by_role("button", name="Follow the south road to Ashvale").click()
        town = page.evaluate("""() => ({map: mapId, town: !!activeMap.town,
                                         enemies: activeMap.enemies.length,
                                         npcs: activeMap.npcs.length})""")
        assert town["map"] == "ashvale" and town["town"] and not town["enemies"] and town["npcs"], town

        # Interact with the named in-game return marker, not a direct setMap.
        move_to_and_interact(page, 300, 500)
        assert game_state(page)["map"] == "wayfarers_camp", "Ashvale camp return marker failed"
        # Repeating the chapter's last object must not duplicate the reward.
        move_to_and_interact(page, 480, 505)
        repeat = game_state(page)
        assert repeat["claimed"] and repeat["coins"] == completion["coins"], (
            f"Camp quest reward granted again on revisit: {repeat}")
        page.get_by_role("button", name="Stay and explore camp").click()

        # An actual keyboard-held movement path (not setMap or takeMapExit).
        # Advance from south of the camp center to its edge until the game
        # automatically transfers to Ashvale.
        page.evaluate("() => {player.x=550;player.y=505;ui();}")
        page.keyboard.down("ArrowDown")
        try:
            page.wait_for_function("mapId === 'ashvale'", timeout=7000)
        finally:
            page.keyboard.up("ArrowDown")
        assert game_state(page)["map"] == "ashvale", "Camp south edge movement did not enter Ashvale"
        page.screenshot(path=str(evidence_dir / f"{orientation}-camp-south-edge-ashvale.png"), timeout=20000)

        # Use the game's real save routine; no synthetic edits to the saved slot.
        page.evaluate("() => {ui();saveGame();}")
        expected = game_state(page)
        assert expected["claimed"] and expected["notes"] == completion["notes"], expected
        seed = page.evaluate("window.__qaStorage")
        assert "local:emberfall_character_slots_v1" in seed, "No saved character slot"
        restarted = browser.new_page(viewport={"width": width, "height": height},
                                     is_mobile=True, has_touch=True, device_scale_factor=1)
        restart_errors = []
        restarted.on("pageerror", lambda err: restart_errors.append(str(err)))
        try:
            restarted.set_content(html_for_browser(assets, seed), wait_until="domcontentloaded", timeout=60000)
            assert restarted.locator("#titleContinue").is_enabled(), "Saved camp story cannot Continue"
            restarted.locator("#titleContinue").click()
            actual = game_state(restarted)
            assert actual == expected, f"Camp story changed on saved-slot restore: {expected} -> {actual}"
            assert not restart_errors, f"Errors after restoring camp chapter: {restart_errors[:4]}"
            restarted.screenshot(path=str(evidence_dir / f"{orientation}-camp-story-save-resume.png"), timeout=20000)
        finally:
            restarted.close()
        assert not errors, f"Uncaught gameplay errors: {errors[:4]}"
        return {"orientation": orientation, "viewport": [width, height], "chapter": "completed once",
                "notes": completion["notes"], "camp_to_ashvale_dialog": True,
                "ashvale_return_marker": True, "camp_south_edge_keyboard_exit": True,
                "revisit_no_duplicate_reward": True, "fresh_page_save_resume": True,
                "page_errors": len(errors)}
    finally:
        page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", default="app/src/main/assets")
    parser.add_argument("--browser", default=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser"))
    parser.add_argument("--evidence-dir", default="reports/browser-camp-story-qa")
    args = parser.parse_args()
    if not args.browser:
        raise SystemExit("Chromium/Chrome is required")
    assets = Path(args.assets).resolve()
    evidence_dir = Path(args.evidence_dir).resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.browser, headless=True,
                                             args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            results = [run_orientation(browser, assets, evidence_dir, name, w, h)
                       for name, w, h in (("portrait", 420, 900), ("landscape", 900, 420))]
        finally:
            browser.close()
    print(json.dumps({"status": "PASS", "scope": "Browser-only, QA repositioning and in-memory saves; not Android/Play/device",
                      "results": results}, indent=2))


if __name__ == "__main__":
    main()

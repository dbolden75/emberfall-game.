#!/usr/bin/env python3
"""Thornhaven UI regression: actual packaged HTML, Chromium, no release secrets.

Run after tools/restore-game-source.py has populated app/src/main/assets.
For sandboxed headless Chromium, script assets and session/localStorage are
provided in-memory. This tests visual browser gameplay, NOT Android/WebView,
Google Play, device install, or real filesystem-backed Android save durability.
"""

import argparse
import json
import re
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright


SCRIPT_TAG = re.compile(r'<script\s+src="([^"]+)"\s*>\s*</script>')


def html_for_browser(assets: Path, seed: dict | None = None) -> str:
    html = (assets / "index.html").read_text(encoding="utf-8")
    scripts = SCRIPT_TAG.findall(html)
    if len(scripts) < 5:
        raise AssertionError(f"Unexpectedly few game script references ({len(scripts)})")
    for script_name in scripts:
        if ":" in script_name or script_name.startswith("/") or ".." in Path(script_name).parts:
            raise AssertionError(f"Invalid external script path: {script_name!r}")
        script = (assets / script_name).read_text(encoding="utf-8")
        # Script tags here are QA's in-memory transport, NOT changes to the app.
        html = html.replace(f'<script src="{script_name}"></script>', f"<script>\n{script}\n</script>")
    if SCRIPT_TAG.search(html):
        raise AssertionError("Unresolved external game script")
    polyfill = r"""
<script>
window.__qaStorage = __SEED__;
function qaStorage(id) {
  const prefix = id + ':';
  const keys = () => Object.keys(window.__qaStorage).filter(k => k.startsWith(prefix));
  return {
    getItem: k => Object.prototype.hasOwnProperty.call(window.__qaStorage, prefix + k) ? window.__qaStorage[prefix + k] : null,
    setItem: (k, v) => { window.__qaStorage[prefix + k] = String(v); },
    removeItem: k => { delete window.__qaStorage[prefix + k]; },
    clear: () => { for (const k of keys()) delete window.__qaStorage[k]; },
    key: i => keys()[i]?.slice(prefix.length) ?? null,
    get length() { return keys().length; }
  };
}
Object.defineProperty(window, 'localStorage', {configurable: true, value: qaStorage('local')});
Object.defineProperty(window, 'sessionStorage', {configurable: true, value: qaStorage('session')});
</script>
""".replace("__SEED__", json.dumps(seed or {}, separators=(",", ":")))
    if "<head>" not in html:
        raise AssertionError("Missing <head> in game HTML")
    return html.replace("<head>", "<head>" + polyfill, 1)


def check_orientation(browser, assets: Path, output: Path, orientation: str, width: int, height: int) -> dict:
    page = browser.new_page(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page.set_default_timeout(10000)
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.set_content(html_for_browser(assets), wait_until="domcontentloaded", timeout=60000)
    assert "THORNHAVEN" in page.title().upper(), f"Unexpected browser title: {page.title()!r}"
    page.get_by_role("button", name=re.compile("Start New Game")).click()
    page.get_by_role("button", name="Tap to Continue").click()
    hero = "QAPortrait" if orientation == "portrait" else "QALandscape"
    page.locator("#characterName").fill(hero)
    page.get_by_role("button", name="Begin Journey").click()
    page.locator("body").get_by_text(hero + " · Warrior", exact=False).first.wait_for(state="visible")
    assert page.get_by_role("button", name="INTERACT").is_visible(), "No gameplay interaction button"
    save = page.evaluate("window.__qaStorage")
    assert "local:emberfall_character_slots_v1" in save, "No character slots persisted by game"
    assert hero in save["local:emberfall_character_slots_v1"], "Created character absent from stored slots"
    page.get_by_role("button", name="☰ MENU").click()
    page.get_by_role("button", name=re.compile("World Map")).click()
    atlas = page.locator("#atlasSelection")
    before = atlas.inner_text()
    node_id = page.evaluate("document.querySelector('.atlasNode[data-travel-to]')?.dataset.travelTo")
    assert node_id, "World map has no clickable regions"
    page.evaluate("id => document.querySelector('.atlasNode[data-travel-to=\"' + id + '\"]')?.click()", node_id)
    after = atlas.inner_text()
    assert after != before and len(after) > 15, "World map region tap did not reveal details"
    assert not errors, f"Uncaught game JavaScript errors: {errors[:5]}"
    output.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(output / (orientation + "-world-map-detail.png")), timeout=20000)
    result = {"orientation": orientation, "viewport": [width, height], "created_hero": hero,
              "character_in_save": True, "world_map_region": node_id, "world_map_detail_updated": True,
              "page_errors": len(errors)}
    page.close()
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", default="app/src/main/assets")
    parser.add_argument("--browser", default=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser"))
    parser.add_argument("--evidence-dir", default="reports/browser-interactive-qa")
    args = parser.parse_args()
    if not args.browser:
        raise SystemExit("No system Chromium/Chrome executable found")
    assets = Path(args.assets).resolve()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.browser, headless=True,
                                             args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            results = [
                check_orientation(browser, assets, Path(args.evidence_dir), "portrait", 420, 900),
                check_orientation(browser, assets, Path(args.evidence_dir), "landscape", 900, 420),
            ]
        finally:
            browser.close()
    print(json.dumps({"status": "PASS", "scope": "Headless Chromium in-memory storage only; not Play/Android/native device",
                      "results": results}, indent=2))


if __name__ == "__main__":
    main()

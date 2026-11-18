#!/usr/bin/env python3
"""Actual Chromium UI/integration checks; does not claim listening or Android testing."""
import importlib.util
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('browser_qa',root/'tools/browser-interactive-qa.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=(shutil.which('chromium') or shutil.which('google-chrome')),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':412,'height':915})
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(helper.html_for_browser(root/'app/src/main/assets'),wait_until='load')
 page.wait_for_function('window.ThornhavenAudio && !document.getElementById("titleMenu").hidden')
 assert not page.evaluate('ThornhavenAudio.status().unlocked')
 page.locator('#titleSettings').click()
 page.locator('#audioSettings > summary').click()
 assert page.evaluate('ThornhavenAudio.status().unlocked')
 for bus in ['music','ambience']:
  slider=page.locator('#audio-'+bus);assert slider.is_visible()
  slider.evaluate("el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));}")
  assert page.evaluate('(bus)=>ThornhavenAudio.preferences()[bus].volume',bus)==0
 page.evaluate("window.dispatchEvent(new Event('pagehide'))")
 assert page.evaluate('ThornhavenAudio.status().paused')
 page.evaluate("window.dispatchEvent(new Event('pageshow'))")
 assert not page.evaluate('ThornhavenAudio.status().paused')
 seed=page.evaluate('window.__qaStorage')
 page.close();page=browser.new_page(viewport={'width':412,'height':915})
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(helper.html_for_browser(root/'app/src/main/assets',seed),wait_until='load')
 page.wait_for_function('window.ThornhavenAudio')
 assert page.evaluate('ThornhavenAudio.preferences().music.volume')==0
 assert page.evaluate('ThornhavenAudio.preferences().ambience.volume')==0
 assert not errors,errors
 browser.close()
print('PASS: Chromium settings UI, trusted gesture unlock, zero volumes, persistence and pagehide/pageshow; no phone audition')

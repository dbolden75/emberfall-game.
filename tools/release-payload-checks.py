#!/usr/bin/env python3
"""Verify that release APK/AAB carry the exact audited assets and retain save origin.

Use on unsigned CI outputs before signing or on maintained-key signed candidates.
This is a static artifact gate, NOT a device/Google Play update test.
"""
import argparse
import hashlib
import re
import subprocess
import zipfile
from pathlib import Path

PACKAGE = 'com.vaelbrink.ashvale.newjourney'
SAVE_TOKENS = (
    "SAVE_KEY='emberfall_singleplayer_v1'",
    "SAVE_SLOTS_KEY='emberfall_character_slots_v1'",
    "ACTIVE_SLOT_KEY='emberfall_active_character_slot_v1'",
    "SAVE_SLOT_IDS=['slot1','slot2','slot3','slot4']",
)


def required(condition, message):
    if not condition:
        raise SystemExit('FAIL: ' + message)


def bundled_assets(archive, prefix):
    return {name[len(prefix):] for name in archive.namelist()
            if name.startswith(prefix) and not name.endswith('/')}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--apk', type=Path, required=True)
    p.add_argument('--aab', type=Path, required=True)
    p.add_argument('--assets', type=Path, required=True)
    p.add_argument('--gradle', type=Path, required=True)
    p.add_argument('--activity', type=Path)
    p.add_argument('--aapt', type=Path)
    args = p.parse_args()
    gradle = args.gradle.read_text()
    code = re.search(r'\bversionCode\s+(\d+)', gradle)
    version = re.search(r"\bversionName\s+'([^']+)'", gradle)
    required(f"applicationId '{PACKAGE}'" in gradle, 'package identity changed')
    required(code and int(code[1]) > 164, 'versionCode must exceed archived 1.0.62 code 164')
    required(version, 'versionName missing')
    if args.activity:
        activity = args.activity.read_text()
        required('game.loadUrl("file:///android_asset/index.html")' in activity,
                 'WebView origin changed, risking localStorage saves')
        required('settings.setDomStorageEnabled(true)' in activity,
                 'WebView DOM storage disabled, risking saved characters')
        required('localStorage.clear(' not in activity and '.deleteDatabase(' not in activity,
                 'possible automatic data deletion in Android activity')
    source = {str(path.relative_to(args.assets)).replace('\\', '/') : path
              for path in args.assets.rglob('*') if path.is_file()}
    required('index.html' in source, 'restored index.html missing')
    html = source['index.html'].read_bytes()
    for marker in SAVE_TOKENS:
        required(marker.encode() in html, 'historical save compatibility token missing: ' + marker)
    with zipfile.ZipFile(args.apk) as apk, zipfile.ZipFile(args.aab) as aab:
        required(apk.testzip() is None and aab.testzip() is None, 'APK/AAB ZIP integrity failure')
        apk_paths = bundled_assets(apk, 'assets/')
        aab_paths = bundled_assets(aab, 'base/assets/')
        # Android may inject baseline profile metadata in the APK assets directory.
        apk_game_paths = {name for name in apk_paths if not name.startswith('dexopt/')}
        required(apk_game_paths == set(source),
                 f'APK game asset manifest differs: missing {sorted(set(source)-apk_game_paths)}, extra {sorted(apk_game_paths-set(source))}')
        required(aab_paths == set(source),
                 f'AAB game asset manifest differs: missing {sorted(set(source)-aab_paths)}, extra {sorted(aab_paths-set(source))}')
        for name, path in source.items():
            original = path.read_bytes()
            required(apk.read('assets/'+name) == original, 'APK asset differs from source: ' + name)
            required(aab.read('base/assets/'+name) == original, 'AAB asset differs from source: ' + name)
    if args.aapt:
        proc = subprocess.run([str(args.aapt), 'dump', 'badging', str(args.apk)],
                              capture_output=True, text=True, check=True)
        required(f"package: name='{PACKAGE}' versionCode='{code[1]}' versionName='{version[1]}'" in proc.stdout,
                 'APK package/version disagrees with Gradle source')
    else:
        print('NOTE: aapt omitted; APK binary package/version must be checked separately.')
    print(f'PASS: {len(source)} release game assets match source, APK and AAB byte-for-byte')
    print('PASS: save keys and Android WebView origin preserved where checked')
    print(f'PASS: source declares {PACKAGE}, versionCode {code[1]}, versionName {version[1]}')
    print('HTML SHA-256:', hashlib.sha256(html).hexdigest())
    print('NOT TESTED: APK signing certificate, Play upload, physical-device save upgrade')


if __name__ == '__main__':
    main()

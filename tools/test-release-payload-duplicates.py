#!/usr/bin/env python3
"""Regression: duplicate ZIP assets must not bypass release manifest parity.

All inputs are synthetic and generated locally. No Android SDK, signing key,
network access or phone is required.
"""
import subprocess
import sys
import tempfile
import warnings
import zipfile
from pathlib import Path

CHECKER = Path(__file__).with_name('release-payload-checks.py')


def package(path, prefix, source, duplicate=None, include_dexopt=False):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, payload in source.items():
            archive.writestr(prefix + name, payload)
        if include_dexopt:
            archive.writestr('assets/dexopt/baseline.prof', b'profile')
        if duplicate:
            # Duplicate bytes are deliberate: the prior set()/read() check
            # silently passed this archive despite two identical ZIP members.
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                archive.writestr(prefix + duplicate, source[duplicate])


def verify(root, apk, aab, should_pass, expected):
    cmd = [sys.executable, str(CHECKER), '--apk', str(apk),
           '--aab', str(aab), '--assets', str(root / 'assets'),
           '--gradle', str(root / 'build.gradle'),
           '--activity', str(root / 'MainActivity.java')]
    process = subprocess.run(cmd, capture_output=True, text=True, check=False)
    output = process.stdout + process.stderr
    if (process.returncode == 0) != should_pass or expected not in output:
        raise AssertionError(
            f'expected success={should_pass} containing {expected!r}; '
            f'got exit={process.returncode}: {output}')


def main():
    with tempfile.TemporaryDirectory(prefix='thornhaven-payload-parity-') as folder:
        root = Path(folder)
        assets = root / 'assets'
        assets.mkdir()
        # The real checker must continue protecting the historical save keys.
        html = ("<html><body>" +
                "SAVE_KEY='emberfall_singleplayer_v1' " +
                "SAVE_SLOTS_KEY='emberfall_character_slots_v1' " +
                "ACTIVE_SLOT_KEY='emberfall_active_character_slot_v1' " +
                "SAVE_SLOT_IDS=['slot1','slot2','slot3','slot4']" +
                "</body></html>").encode()
        source = {'index.html': html, 'cloud-save-core.js': b'console.log("synthetic");'}
        for name, payload in source.items():
            (assets / name).write_bytes(payload)
        (root / 'build.gradle').write_text(
            "applicationId 'com.vaelbrink.ashvale.newjourney'\n"
            "versionCode 169\nversionName '1.0.67'\n")
        (root / 'MainActivity.java').write_text(
            'game.loadUrl("file:///android_asset/index.html");\n'
            'settings.setDomStorageEnabled(true);\n')
        apk = root / 'app.apk'
        aab = root / 'app.aab'

        package(apk, 'assets/', source, include_dexopt=True)
        package(aab, 'base/assets/', source)
        verify(root, apk, aab, True, 'release game assets match source')
        print('PASS: normal APK/AAB with one baseline profile metadata entry')

        package(apk, 'assets/', source, duplicate='index.html')
        verify(root, apk, aab, False, 'duplicate ZIP game assets under assets/')
        print('PASS: identical duplicated APK index.html blocked')

        package(apk, 'assets/', source, include_dexopt=True)
        package(aab, 'base/assets/', source, duplicate='cloud-save-core.js')
        verify(root, apk, aab, False, 'duplicate ZIP game assets under base/assets/')
        print('PASS: identical duplicated AAB script blocked')

        package(aab, 'base/assets/', source)
        modified = dict(source)
        modified['index.html'] = b'<html>tampered</html>'
        package(apk, 'assets/', modified)
        verify(root, apk, aab, False, 'APK asset differs from source: index.html')
        print('PASS: modified packaged game content still blocked')


if __name__ == '__main__':
    main()

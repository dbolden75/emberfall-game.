#!/usr/bin/env python3
"""Reject compiled voice-enabled APK/AAB packages with missing native speech bridge.

This is a static compiled-artifact check, not on-device speech verification.
"""
import argparse
import re
import zipfile
from pathlib import Path

TTS_CLASS = b'Lcom/emberfall/ashvale/NpcSpeech;'
WEBVIEW_BRIDGE = b'ThornhavenNativeVoice'
SCRIPTS = ('npc-voice.js', 'npc-voice-integration.js')


def verify(package: Path, kind: str, assets: Path):
    asset_prefix = 'assets/' if kind == 'APK' else 'base/assets/'
    dex_prefix = '' if kind == 'APK' else 'base/dex/'
    with zipfile.ZipFile(package) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise AssertionError(f'{kind}: duplicate ZIP entries')
        if archive.testzip() is not None:
            raise AssertionError(f'{kind}: corrupted ZIP entries')
        for filename in SCRIPTS:
            path = asset_prefix + filename
            if path not in names or archive.read(path) != (assets / filename).read_bytes():
                raise AssertionError(f'{kind}: missing or changed {path}')
        html = archive.read(asset_prefix + 'index.html').decode('utf-8')
        if not re.search(
            r'<script\s+src="npc-voice\.js"\s*>\s*</script>\s*'
            r'<script\s+src="npc-voice-integration\.js"\s*>\s*</script>', html
        ):
            raise AssertionError(f'{kind}: voice scripts missing or incorrectly ordered')
        dex = [name for name in names if re.fullmatch(
            re.escape(dex_prefix) + r'classes(?:\d+)?\.dex', name
        )]
        if not dex:
            raise AssertionError(f'{kind}: missing DEX payload')
        if not any(TTS_CLASS in archive.read(name) for name in dex):
            raise AssertionError(f'{kind}: compiled NpcSpeech class is missing')
        if not any(WEBVIEW_BRIDGE in archive.read(name) for name in dex):
            raise AssertionError(f'{kind}: compiled ThornhavenNativeVoice bridge is missing')
    print(f'PASS: {kind} contains both voice scripts, correct order, native TTS class and bridge')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--aab', type=Path, required=True)
    parser.add_argument('--assets', type=Path, required=True)
    args = parser.parse_args()
    verify(args.apk, 'APK', args.assets)
    verify(args.aab, 'AAB', args.assets)
    print('NOT TESTED: device speech synthesis, installed offline voices, Play signing or live upgrades')


if __name__ == '__main__':
    main()

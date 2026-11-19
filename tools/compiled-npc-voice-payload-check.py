#!/usr/bin/env python3
"""Reject compiled voice-enabled APK/AAB packages with missing native speech bridge.

This is a static compiled-artifact check, not on-device speech verification.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

TTS_CLASS = b'Lcom/emberfall/ashvale/NpcSpeech;'
WEBVIEW_BRIDGE = b'ThornhavenNativeVoice'
SCRIPTS = ('audio-catalog.js', 'game-audio.js', 'audio-integration.js',
           'npc-voice.js', 'npc-voice-integration.js')
SOURCE_PREFIX = 'app/src/main/assets/'


def pinned_assets(assets: Path):
    """Check reviewed source digests before checking compiled packages."""
    manifest = Path(__file__).resolve().parents[1] / 'source-payload/audio-sha256.json'
    rows = json.loads(manifest.read_text(encoding='utf-8'))
    expected = {}
    for path, digest in rows.items():
        if not path.startswith(SOURCE_PREFIX):
            continue  # Overlay builder scripts aren't packaged app assets.
        relative = path[len(SOURCE_PREFIX):]
        source = assets / relative
        if not re.fullmatch(r'[a-f0-9]{64}', digest) or not source.is_file():
            raise AssertionError(f'Missing or invalid pinned source audio: {path}')
        if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise AssertionError(f'Pinned source audio changed: {path}')
        expected[relative] = digest
    if not all(name in expected for name in SCRIPTS):
        raise AssertionError('Unpinned playback or NPC voice script')
    if not any(name.startswith('audio/') and name.endswith('.ogg') for name in expected):
        raise AssertionError('No pinned OGG audio assets')
    return expected


def verify(package: Path, kind: str, assets: Path, expected):
    asset_prefix = 'assets/' if kind == 'APK' else 'base/assets/'
    dex_prefix = '' if kind == 'APK' else 'base/dex/'
    with zipfile.ZipFile(package) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise AssertionError(f'{kind}: duplicate ZIP entries')
        if archive.testzip() is not None:
            raise AssertionError(f'{kind}: corrupted ZIP entries')
        for filename, digest in expected.items():
            path = asset_prefix + filename
            if path not in names:
                raise AssertionError(f'{kind}: missing pinned audio/voice payload {path}')
            if hashlib.sha256(archive.read(path)).hexdigest() != digest:
                raise AssertionError(f'{kind}: changed pinned audio/voice payload {path}')
        html = archive.read(asset_prefix + 'index.html').decode('utf-8')
        order = r'\s*'.join(r'<script\s+src="' + re.escape(name) +
                              r'"\s*>\s*</script>' for name in SCRIPTS)
        if not re.search(order, html):
            raise AssertionError(f'{kind}: audio and NPC voice scripts missing or incorrectly ordered')
        dex = [name for name in names if re.fullmatch(
            re.escape(dex_prefix) + r'classes(?:\d+)?\.dex', name
        )]
        if not dex:
            raise AssertionError(f'{kind}: missing DEX payload')
        if not any(TTS_CLASS in archive.read(name) for name in dex):
            raise AssertionError(f'{kind}: compiled NpcSpeech class is missing')
        if not any(WEBVIEW_BRIDGE in archive.read(name) for name in dex):
            raise AssertionError(f'{kind}: compiled ThornhavenNativeVoice bridge is missing')
    audio_count = sum(n.startswith('audio/') and n.endswith('.ogg') for n in expected)
    print(f'PASS: {kind} includes {audio_count} hash-pinned sound files, {len(SCRIPTS)} ordered scripts and the native NPC voice bridge')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--aab', type=Path, required=True)
    parser.add_argument('--assets', type=Path, required=True)
    args = parser.parse_args()
    expected = pinned_assets(args.assets)
    verify(args.apk, 'APK', args.assets, expected)
    verify(args.aab, 'AAB', args.assets, expected)
    print('NOT TESTED: device speech synthesis, installed offline voices, Play signing or live upgrades')


if __name__ == '__main__':
    main()

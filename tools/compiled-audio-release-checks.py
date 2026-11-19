#!/usr/bin/env python3
"""Red/green ZIP fixtures for the compiled audio/NPC speech release guard.

No Android install, real speech synthesis or Google Play billing is exercised.
"""
import importlib.util
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'tools/compiled-npc-voice-payload-check.py'
spec = importlib.util.spec_from_file_location('compiled_audio_guard', path)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

def reject(needle, func):
    try:
        func()
    except AssertionError as error:
        if needle not in str(error):
            raise AssertionError(f'Wrong rejection: {error}') from error
        return
    raise AssertionError(f'Expected rejection containing {needle!r}')

def main():
    assets = ROOT / 'app/src/main/assets'
    pinned = guard.pinned_assets(assets)
    scripts = guard.SCRIPTS
    with tempfile.TemporaryDirectory(prefix='thornhaven-compiled-audio-') as directory:
        directory = Path(directory)
        count = [0]
        def fixture(kind, *, missing=None, change=None, reversed_scripts=False, no_bridge=False):
            count[0] += 1
            package = directory / f'fixture-{count[0]}.zip'
            prefix = 'assets/' if kind == 'APK' else 'base/assets/'
            dex_name = 'classes.dex' if kind == 'APK' else 'base/dex/classes.dex'
            with ZipFile(package, 'w', ZIP_STORED) as z:
                for relative in pinned:
                    if relative == missing:
                        continue
                    data = (assets / relative).read_bytes()
                    if relative == change:
                        data += b'ALTERED'
                    z.writestr(prefix + relative, data)
                order = tuple(reversed(scripts)) if reversed_scripts else scripts
                z.writestr(prefix + 'index.html',
                           '<body>' + ''.join(f'<script src="{name}"></script>' for name in order) + '</body>')
                z.writestr(dex_name, guard.TTS_CLASS + (b'' if no_bridge else guard.WEBVIEW_BRIDGE))
            return package
        for kind in ('APK', 'AAB'):
            def check(**kwargs):
                return guard.verify(fixture(kind, **kwargs), kind, assets, pinned)
            check()
            reject('missing pinned audio/voice payload', lambda: check(missing='audio/town.ogg'))
            reject('changed pinned audio/voice payload', lambda: check(change='audio/step.ogg'))
            reject('scripts missing or incorrectly ordered', lambda: check(reversed_scripts=True))
            reject('compiled ThornhavenNativeVoice bridge is missing', lambda: check(no_bridge=True))
    print('PASS: 10 synthetic APK/AAB fixture scenarios (2 valid; 8 expected rejections)')

if __name__ == '__main__':
    main()

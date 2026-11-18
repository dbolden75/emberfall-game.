#!/usr/bin/env python3
"""Restore byte-pinned 1.0.69 gameplay on top of authenticated 1.0.68 source.

Versioned binary payload is split into Git blobs to respect transfer limits.
No signing credentials or player saves are accessed.
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import io
import json
import re

root = Path(__file__).resolve().parent.parent
gradle = (root / 'app/build.gradle').read_text()
code = re.findall(r"(?m)^\s*versionCode\s+(\d+)\s*$", gradle)
version = re.findall(r"(?m)^\s*versionName\s+'([^']+)'\s*$", gradle)
assert len(code) == len(version) == 1, 'Missing Android version field'
if (code[0], version[0]) != ('171', '1.0.69'):
    assert (code[0], version[0]) == ('170', '1.0.68'), 'Unsupported source/version combination'
    print('1.0.69 overlay skipped for original 1.0.68')
    raise SystemExit(0)

parts = sorted((root / 'source-payload/release-1.0.69').glob('native-delta.part-*'))
assert len(parts) == 20 and [p.name for p in parts] == [f'native-delta.part-{i:03d}' for i in range(20)], 'Incomplete 1.0.69 asset transfer'
packed = b''.join(p.read_bytes() for p in parts)
assert hashlib.sha256(packed).hexdigest() == 'acefaad831e5c4939a060067e4dcdaa5824882f34e4f42bbdd2acaefb4b48673', 'Modified 1.0.69 asset bundle'

assets = ['app/src/main/assets/compact-hud.js', 'app/src/main/assets/immersive-atlas.css',
          'app/src/main/assets/immersive-atlas.js', 'app/src/main/assets/natural-followers.js',
          'app/src/main/assets/organic-terrain.js', 'app/src/main/assets/scene-scale.js',
          'app/src/main/assets/smooth-motion.js', 'app/src/main/assets/art/atlas-painted-v1.png',
          'source-payload/current-browser-1.0.69-patch.json']
with ZipFile(io.BytesIO(packed)) as archive:
    assert set(archive.namelist()) == set(assets) and archive.testzip() is None, 'Unexpected archive files or invalid CRC'
    for name in assets:
        destination = root / name
        data = archive.read(name)
        # The signed candidate exposed a short-landscape hit-test collision.
        # Apply this audited CSS-only repair deterministically after authenticating
        # the original bundle, so generated sources and checked-in assets agree.
        if name == 'app/src/main/assets/compact-hud.js':
            anchor = b'body.previewExpanded:has(#gameView:not([hidden])) .shell .top{padding-left:54px!important}'
            assert data.count(anchor) == 1, 'Party-panel stacking anchor changed'
            data = data.replace(anchor, b'/* Expanded Party controls must stay tappable above movement controls in short landscape. */\nbody:has(#gameView:not([hidden])) .shell .hud:has(.hudSide.detailsExpanded){z-index:9}\n' + anchor, 1)
            assert hashlib.sha256(data).hexdigest() == '31767d516d7d5afd78088627ce83c1bcc152d1a3de3ee7aea1e2ef2ada6f5fff', 'Party-panel repair digest mismatch'
        if destination.exists():
            assert destination.read_bytes() == data, f'Conflicting native asset: {name}'
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)

html_path = root / 'app/src/main/assets/index.html'
assert html_path.is_file(), 'Restore historical HTML before applying 1.0.69 changes'
original = html_path.read_bytes()
assert hashlib.sha256(original).hexdigest() == '9fa2d220141f329467e7d1978ca628f78dc2a6975c46eb7f2d55221e701cec88', 'Unexpected 1.0.68 game baseline'
base = original.splitlines(keepends=True)
changes = json.loads((root / 'source-payload/current-browser-1.0.69-patch.json').read_text())
merged, cursor = [], 0
for start, stop, insertion in changes:
    assert cursor <= start <= stop <= len(base), 'Invalid or overlapping browser patch'
    merged.extend(base[cursor:start])
    merged.append(insertion.encode('utf-8'))
    cursor = stop
merged.extend(base[cursor:])
updated = b''.join(merged)
assert hashlib.sha256(updated).hexdigest() == '801d9f3394aaa4987410b0cf6e96517a3952686546b6d613e2e95f4bda2a2e24', 'v1.0.69 release HTML digest mismatch'
html_path.write_bytes(updated)
print('PASS: 1.0.69 native game restored from hash-verified baseline and 20 immutable source chunks')

# Keep the historical payload immutable; apply the independently maintained audio delta.
import runpy
runpy.run_path(str(root / "tools/apply-audio-overlay.py"))

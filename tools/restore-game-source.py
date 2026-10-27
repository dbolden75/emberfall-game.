#!/usr/bin/env python3
"""Reconstruct Thornhaven from audited baseline + compact reviewed 1.0.63 source delta.

The delta was generated against the audited 1.0.56 HTML and independently
checked against Thornhaven's 1.0.62 Development Source ZIP, with only the
in-game version label advanced to 1.0.63. No proprietary reference assets.
"""
from pathlib import Path
import base64, hashlib, json, zlib

root = Path(__file__).resolve().parents[1]
parts = [root / 'source-payload' / f'index.html.part-{i:03}' for i in range(1, 4)]
source = b''.join(p.read_bytes() for p in parts)
assert hashlib.sha256(source).hexdigest() == '9e266784b17b65fcd11303f742e2d7f9fb91c727f2a3a1d7ebb6dd7e8d3c0e4f', 'Audited baseline hash mismatch'
lines = source.splitlines(keepends=True)
patch = (root / 'source-payload' / 'compact-1.0.63-patch.b64').read_text().strip()
edits = json.loads(zlib.decompress(base64.b64decode(patch)))
assembled = []
start = 0
for first, last, insertion in edits:
    if not (start <= first <= last <= len(lines)):
        raise ValueError('Patch has invalid or overlapping spans')
    assembled.extend(lines[start:first])
    assembled.append(insertion.encode('utf-8'))
    start = last
assembled.extend(lines[start:])
content = b''.join(assembled)
assert hashlib.sha256(content).hexdigest() == 'ddaf5af6e4e4310d774b9231d823bce5c4eafd5063ed105e379bfb3e3363fcf4', 'Migrated HTML hash mismatch'
target = root / 'app/src/main/assets/index.html'
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    assert target.read_bytes() == content, 'Refusing to overwrite a different game source'
else:
    target.write_bytes(content)
print('Thornhaven 1.0.63 HTML reconstructed, SHA-256 verified:', 'ddaf5af6e4e4310d774b9231d823bce5c4eafd5063ed105e379bfb3e3363fcf4')

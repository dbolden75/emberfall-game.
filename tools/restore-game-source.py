#!/usr/bin/env python3
"""Reassemble the exact audited HTML from bounded source-transfer parts."""
import hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts = [root / 'source-payload' / f'index.html.part-{i:03}' for i in range(1, 4)]
payload = b''.join(p.read_bytes() for p in parts)
expected = '9e266784b17b65fcd11303f742e2d7f9fb91c727f2a3a1d7ebb6dd7e8d3c0e4f'
assert hashlib.sha256(payload).hexdigest() == expected, 'Audited HTML hash mismatch'
target = root / 'app/src/main/assets/index.html'
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    assert target.read_bytes() == payload, 'Refusing to replace different game content'
else:
    target.write_bytes(payload)
print('Audited game HTML restored and SHA-256 verified:', expected)

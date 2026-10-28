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
# The reviewed 1.0.62 source retained one stale title-screen footer.
# Fix that single display label and authenticate the resulting 1.0.63 HTML.
stale = 'Version 1.0.62 · Ashvale Reach'.encode('utf-8')
correct = 'Version 1.0.63 · Ashvale Reach'.encode('utf-8')
assert content.count(stale) == 1, 'Expected exactly one stale title version label'
content = content.replace(stale, correct, 1)
assert hashlib.sha256(content).hexdigest() == 'c9085391c1ad9c76e42502682d16c717fc73b39a4e906759a3463845cf2f14a0', 'Migrated HTML hash mismatch'
content = content.replace(b'1.0.63', b'1.0.64')
assert hashlib.sha256(content).hexdigest() == 'bc14b9f38375c9dca31b14cf28a5dae467108001c7523f9aaa4bd6ebb4791c57', 'Patch version hash mismatch'
# A 1.0.57-era saved enemy can omit x/y. Never overwrite its live,
# valid spawn coordinates with undefined when restoring either save format.
# Keep this narrowly scoped after the authenticated 1.0.64 migration.
for old, new in [
    (b'Object.assign(enemy,{x:e.x,y:e.y,spawnX:Number.isFinite(e.spawnX)?e.spawnX:enemy.spawnX',
     b'Object.assign(enemy,{x:Number.isFinite(e.x)?e.x:enemy.x,y:Number.isFinite(e.y)?e.y:enemy.y,spawnX:Number.isFinite(e.spawnX)?e.spawnX:enemy.spawnX'),
    (b'Object.assign(enemy,{x:e.x,y:e.y,hp:savedHp>0?',
     b'Object.assign(enemy,{x:Number.isFinite(e.x)?e.x:enemy.x,y:Number.isFinite(e.y)?e.y:enemy.y,hp:savedHp>0?'),
]:
    assert content.count(old) == 1, 'Expected exactly one enemy restore expression'
    content = content.replace(old, new, 1)
assert hashlib.sha256(content).hexdigest() == 'caab1a338d37e86dd4a25e509a6dc8c52901835a435fcc4e51a9e2e5b9bef225', 'Enemy coordinate compatibility patch hash mismatch'

# Restored older characters may refer to equipment removed or renamed in a
# later catalog. Showing their inventory must never dereference an unknown
# item id and crash; keep the underlying saved item id for future recovery.
for old, new in [
    (b"(player.weapon?itemDefs[player.weapon].name:'none')", b"(itemDefs[player.weapon]?.name||'none')"),
    (b"(player.armor?itemDefs[player.armor].name:'none')", b"(itemDefs[player.armor]?.name||'none')"),
    (b"(player.shield?itemDefs[player.shield].name:'none')", b"(itemDefs[player.shield]?.name||'none')"),
]:
    assert content.count(old) == 1, 'Expected exactly one equipped gear label'
    content = content.replace(old, new, 1)
assert hashlib.sha256(content).hexdigest() == '02fa2a23977ac87cc38301483c1fa2cea82832cb556113828b629fc9e96ef729', 'Equipment-label compatibility patch hash mismatch'

target = root / 'app/src/main/assets/index.html'
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    assert target.read_bytes() == content, 'Refusing to overwrite a different game source'
else:
    target.write_bytes(content)
print('Thornhaven 1.0.64 HTML reconstructed, SHA-256 verified:', hashlib.sha256(content).hexdigest())

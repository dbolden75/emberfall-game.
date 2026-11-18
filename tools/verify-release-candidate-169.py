#!/usr/bin/env python3
"""Fail closed when promoting Thornhaven v1.0.69 without its complete approved payload.

Run after restore-game-source.py. This only reads source files and never edits saves.
"""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
gradle = (root / "app/build.gradle").read_text()

def field(pattern):
    matches = re.findall(pattern, gradle, re.M)
    assert len(matches) == 1, f"Missing or ambiguous Gradle identity field: {pattern}"
    return matches[0]

package = field(r"^\s*applicationId\s+'([^']+)'")
code = int(field(r"^\s*versionCode\s+(\d+)"))
version = field(r"^\s*versionName\s+'([^']+)'")
assert package == "com.vaelbrink.ashvale.newjourney", "Changed package risks existing saves"
if code != 171 and version != "1.0.69":
    print(f"PASS: package preserved; 1.0.69 gate not applicable to {version}/{code}")
    raise SystemExit(0)
assert (code, version) == (171, "1.0.69"), "Incomplete 1.0.69 version promotion"

expected = {
    "app/src/main/assets/index.html": "4255396addb1741cc18f8c21c35f86e3204d308e09bd0edfe17ccb11eb0212a3",
    "app/src/main/assets/compact-hud.js": "31767d516d7d5afd78088627ce83c1bcc152d1a3de3ee7aea1e2ef2ada6f5fff",
    "app/src/main/assets/immersive-atlas.css": "1906ac055b55bfca73b898c8564d512b49d85c823cb1c316682f8b5460ad63e8",
    "app/src/main/assets/immersive-atlas.js": "357240a78caf57ce20b0464f92dbd8778dbab9e653f89ac3fe9b613a1aa1cb28",
    "app/src/main/assets/natural-followers.js": "660b672442629a05c6d6294ea42803b8397dadd3b768982fa66c0ddf02a0e287",
    "app/src/main/assets/organic-terrain.js": "55a5bcee45625fadbbbe674e2907b792f836c54e0e3a4b5ebeaa16d7015500c7",
    "app/src/main/assets/scene-scale.js": "3414b08cfa17364dc0d083a239ad98f6a7bc7006c178bce2144128d3e3c02d14",
    "app/src/main/assets/smooth-motion.js": "e9cb7b0d7012cd2a2f5af3417fc7872a2b99d11c8abec075d08f9b10a6e46e36",
    "app/src/main/assets/art/atlas-painted-v1.png": "75c062ed33b5db9a26378bef7491c6664de3430f6571dee2f3939848a6d715af",
    "source-payload/current-browser-1.0.69-patch.json": "01de61a20c80ce3bc4d83e8c8e52cfe4fbea13dc1d3ac21e0510146926fe2155",
}
# Audio files are additive; all unrelated approved asset pins remain unchanged.
expected.update(json.loads((root / "source-payload/audio-sha256.json").read_text()))
for path, wanted in expected.items():
    source = root / path
    assert source.is_file(), f"Missing 1.0.69 release asset: {path}"
    assert hashlib.sha256(source.read_bytes()).hexdigest() == wanted, f"Modified 1.0.69 asset: {path}"

html = (root / "app/src/main/assets/index.html").read_text()
for script in ("immersive-atlas.js", "smooth-motion.js", "natural-followers.js",
               "organic-terrain.js", "scene-scale.js", "compact-hud.js"):
    assert f'<script src="{script}"></script>' in html, f"1.0.69 script missing: {script}"
assert '<link rel="stylesheet" href="immersive-atlas.css">' in html
assert "preview-guard.js" not in html and "Content-Security-Policy" not in html
patch = json.loads((root / "source-payload/current-browser-1.0.69-patch.json").read_text())
assert len(patch) == 13 and all(len(entry) == 3 for entry in patch)
print(json.dumps({"result": "PASS", "version": version, "versionCode": code,
                  "requiredAssetsVerified": len(expected), "nativePreviewExcluded": True}))

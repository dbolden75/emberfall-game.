#!/usr/bin/env python3
"""Apply/remove an exact, reviewable content overlay after baseline restoration.

No versions, release credentials or historical payload chunks are changed.
The entry hook precedes freshCharacterState so startup and slot switching see
all maps. The geometry seam supplies data to existing collision/path functions.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
START = '// BEGIN LAST LANTERN CONTENT\n'
END = '// END LAST LANTERN CONTENT\n'
ANCHOR = 'const freshCharacterState=snapshotGameState();'
OLD = 'function fixedSceneryAreas(id){\n'
NEW = OLD + ' if(maps[id].solidAreas)return maps[id].solidAreas.map(area=>area.slice());\n'

def block():
    return START + (ROOT / 'app/src/main/assets/last-lantern.js').read_text() + END

def apply(html):
    assert START not in html, 'Last Lantern already applied'
    assert html.count(ANCHOR) == html.count(OLD) == 1, 'Last Lantern integration seam changed'
    return html.replace(OLD, NEW, 1).replace(ANCHOR, block() + ANCHOR, 1)

def remove(html):
    assert html.count(block()) == 1 and html.count(NEW) == 1, 'Modified or missing Last Lantern overlay'
    return html.replace(block(), '', 1).replace(NEW, OLD, 1)

if __name__ == '__main__':
    target = ROOT / 'app/src/main/assets/index.html'
    target.write_text(apply(target.read_text()))
    print('PASS: Last Lantern content and shared solidAreas geometry hook applied')

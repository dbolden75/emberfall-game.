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
    return START + (ROOT / 'app/src/main/assets/last-lantern.js').read_text() + (ROOT / 'app/src/main/assets/road-inquiry.js').read_text() + END

PATCHES = [
    ("'Night Visitor':'Vampire story'", "'Night Visitor':'Road investigation'"),
    ("'Class story','Vampire story','Story history'", "'Class story','Road investigation','Story history'"),
    ("['Night Visitor',()=>openVampireStory()]", "['Night Visitor',()=>openRoadInquiry()]"),
    ('Remote vampire town · ferry from Worldsend, east of Hearthstead.', 'Island passage · ask about the road investigation before sailing.'),
    ('for(const e of enemies){if(activeMap.town)break;if(!e.alive)', 'for(const e of enemies){if(activeMap.town)break;if(enemyStoryHidden(e))continue;if(!e.alive)'),
]

def apply(html):
    assert START not in html, 'Last Lantern already applied'
    assert html.count(ANCHOR) == html.count(OLD) == 1, 'Last Lantern integration seam changed'
    for old, new in PATCHES:
        assert html.count(old) == 1, 'Road inquiry seam changed: ' + old
        html = html.replace(old, new, 1)
    return html.replace(OLD, NEW, 1).replace(ANCHOR, block() + ANCHOR, 1)

def remove(html):
    assert html.count(block()) == 1 and html.count(NEW) == 1, 'Modified or missing Last Lantern overlay'
    html = html.replace(block(), '', 1).replace(NEW, OLD, 1)
    for old, new in reversed(PATCHES):
        assert html.count(new) == 1, 'Modified road inquiry seam: ' + new
        html = html.replace(new, old, 1)
    return html

if __name__ == '__main__':
    target = ROOT / 'app/src/main/assets/index.html'
    target.write_text(apply(target.read_text()))
    print('PASS: Last Lantern content and shared solidAreas geometry hook applied')

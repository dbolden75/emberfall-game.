#!/usr/bin/env python3
"""Exact reversible overlay; retain the authenticated preceding payload."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
ANCHOR = 'const campDamageBefore=damageEnemy;'
OLD = "if(area==='whisperwood'&&s?.accepted&&!journalPaused('camp_patrol')&&s.kills<3)"
NEW = OLD.replace("&&s.kills<3", "&&s.method!=='repair'&&s.kills<3")
def block():
    return '// BEGIN EARLY QUEST CHOICES\n' + (ROOT / 'app/src/main/assets/early-quest-choices.js').read_text() + '// END EARLY QUEST CHOICES\n'
def apply(html):
    assert html.count(ANCHOR)==html.count(OLD)==1 and '// BEGIN EARLY QUEST CHOICES' not in html
    return html.replace(OLD,NEW,1).replace(ANCHOR,block()+ANCHOR,1)
def remove(html):
    assert html.count(block())==html.count(NEW)==1
    return html.replace(block(),'',1).replace(NEW,OLD,1)
if __name__=='__main__':
    p=ROOT/'app/src/main/assets/index.html'
    p.write_text(apply(p.read_text()))
    print('PASS: exact early quest choices overlay applied')

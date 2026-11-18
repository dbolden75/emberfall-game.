#!/usr/bin/env python3
"""Exact reversible overlay; retain the authenticated preceding payload."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
ANCHOR = 'const campDamageBefore=damageEnemy;'
OLD = "if(area==='whisperwood'&&s?.accepted&&!journalPaused('camp_patrol')&&s.kills<3)"
NEW = OLD.replace("&&s.kills<3", "&&s.method!=='repair'&&s.kills<3")
def block():
    return '// BEGIN EARLY QUEST CHOICES\n' + (ROOT / 'app/src/main/assets/early-quest-choices.js').read_text() + (ROOT / 'app/src/main/assets/ashvale-quest-choices.js').read_text() + '// END EARLY QUEST CHOICES\n'
PATCHES = [
    (OLD, NEW),
    ("if(!humanQuestReady(id)||journalPaused(id)||!st||!st.accepted", "if(!humanQuestReady(id)||journalPaused(id)||st?.method==='shelter'||st?.method==='accounts'||!st||!st.accepted"),
    ("interactQuest({questId:key});openHumanStory(id);", "interactQuest({questId:key});if(!townQuestDefs[key].choiceBased)openHumanStory(id);"),
]
def apply(html):
    assert html.count(ANCHOR)==html.count(OLD)==1 and '// BEGIN EARLY QUEST CHOICES' not in html
    for old,new in PATCHES:
        assert html.count(old)==1, 'Early choice seam changed: '+old
        html=html.replace(old,new,1)
    return html.replace(ANCHOR,block()+ANCHOR,1)
def remove(html):
    assert html.count(block())==html.count(NEW)==1
    html=html.replace(block(),'',1)
    for old,new in reversed(PATCHES):
        assert html.count(new)==1, 'Modified early choice seam: '+new
        html=html.replace(new,old,1)
    return html
if __name__=='__main__':
    p=ROOT/'app/src/main/assets/index.html'
    p.write_text(apply(p.read_text()))
    print('PASS: exact early quest choices overlay applied')

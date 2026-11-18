#!/usr/bin/env python3
"""Full restored-game offline conversation QA; fixtures are test-only state edits.
No device/Play persistence or normal-speed gameplay claims. Uses established
in-memory browser storage transport, plus the real cloud-save validator.
"""
import argparse
import json
import re
import runpy
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

html_for_browser = runpy.run_path(str(Path(__file__).with_name('browser-interactive-qa.py')))['html_for_browser']


def run(browser, assets, output, width, height):
    page = browser.new_page(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.route('**/*', lambda route: route.abort())
    page.context.set_offline(True)
    page.set_content(html_for_browser(assets), wait_until='domcontentloaded', timeout=60000)
    page.get_by_role('button', name=re.compile('Start New Game')).click()
    page.get_by_role('button', name='Tap to Continue').click()
    page.locator('#characterName').fill('ConversationQA')
    page.get_by_role('button', name='Begin Journey').click()
    def click(name):
        page.locator('#adventureChoices').get_by_role('button', name=name, exact=True).click()
    def answer():
        return page.locator('#adventureText').inner_text()
    def open_talk():
        page.evaluate('openHumanRoster()')
        click('Talk with active companion')
    def quest(title):
        page.evaluate('ThornhavenCompanionConversation.open()')
        click('What should we focus on?')
        page.locator('#adventureChoices').get_by_role('button', name=re.compile(re.escape(title))).click()

    page.evaluate("""() => {
        window.voiceEvents=[]; window.voiceUnhandled=[];
        window.addEventListener('unhandledrejection',e=>voiceUnhandled.push(String(e.reason)));
        window.stubVoice={
            speak(payload) {
                if(document.getElementById('adventureScreen').hidden ||
                   payload.text!==document.getElementById('adventureText').textContent ||
                   !document.querySelector('#adventureChoices button')) throw Error('Speech before final render');
                voiceEvents.push({event:'speak',...payload});
            },
            stop() {voiceEvents.push({event:'stop'});}
        };
        window.ThornhavenVoice=stubVoice;
    }""")
    open_talk()
    assert not page.evaluate("voiceEvents.some(e=>e.event==='speak')")
    assert 'No active companion' in answer()
    click('Manage companions')
    page.evaluate("recruitHuman('dalen')")
    open_talk()
    assert 'take stock' in answer()
    assert 'Offline authored conversation' in page.locator('#adventureScreen .screenFoot').inner_text()
    assert 'no generative AI' in page.locator('#adventureScreen .screenFoot').inner_text()
    assert page.locator('#adventureScreen').get_attribute('role') == 'dialog'
    assert page.locator('#adventureScreen').get_attribute('aria-modal') == 'true'
    assert page.evaluate("document.activeElement.id") == 'adventureText'
    page.keyboard.press('Tab')
    assert page.evaluate("document.activeElement.getAttribute('aria-label')") == 'Close companion conversation'
    page.keyboard.press('Shift+Tab')
    assert page.evaluate('document.activeElement.textContent') == 'Return to adventure'
    page.keyboard.press('Tab')
    assert page.evaluate("document.activeElement.getAttribute('aria-label')") == 'Close companion conversation'
    page.keyboard.press('Escape')
    assert page.locator('#adventureScreen').is_hidden()
    assert page.evaluate('voiceEvents.at(-1).event') == 'stop'
    assert page.evaluate('document.activeElement.id') == 'hudDetailsToggle'
    # Conversation-specific attributes/footer must not leak after closing.
    assert page.locator('#adventureText').get_attribute('tabindex') is None
    assert page.locator('#adventureScreen .screenClose').get_attribute('aria-label') == 'Close story'
    assert page.locator('#adventureScreen .screenFoot').inner_text() == 'Choices and progress save with this character.'
    page.evaluate('voiceEvents=[]')
    open_talk()
    click('Remind me about your summons')
    events=page.evaluate('voiceEvents')
    assert [e['event'] for e in events] == ['speak','stop','speak'], events
    assert all(e.get('speakerId')=='companion:dalen' and e.get('profile')=='merchant'
               for e in events if e['event']=='speak')
    assert events[-1]['text']==answer() and 'Offline authored' not in events[-1]['text']
    page.evaluate("openAdventureDialog('Interrupted story','Narrator text',[])")
    assert page.evaluate('voiceEvents.at(-1).event') == 'stop'
    assert page.locator('#adventureText').get_attribute('tabindex') is None
    assert page.locator('#adventureScreen .screenClose').get_attribute('aria-label') == 'Close story'
    assert 'Offline authored' not in page.locator('#adventureScreen .screenFoot').inner_text()
    open_talk()
    page.evaluate('openHumanRoster()')
    assert page.locator('#adventureText').get_attribute('tabindex') is None
    assert 'Offline authored' not in page.locator('#adventureScreen .screenFoot').inner_text()
    open_talk()
    page.evaluate('openQuestJournal()')
    assert page.evaluate('voiceEvents.at(-1).event') == 'stop'
    assert page.locator('#adventureText').get_attribute('tabindex') is None
    # Preserve an existing tabindex too, not just the normal absence of one.
    page.evaluate("document.getElementById('adventureText').setAttribute('tabindex','7')")
    open_talk()
    page.evaluate("closePanel('adventureScreen')")
    assert page.locator('#adventureText').get_attribute('tabindex') == '7'
    page.evaluate("document.getElementById('adventureText').removeAttribute('tabindex')")
    # Missing, sync-throwing and rejected asynchronous optional audio all retain
    # working text and navigation, without unhandled promise rejection.
    for impl in ["undefined", "{speak(){throw Error('speak')},stop(){throw Error('stop')}}",
                 "{speak(){return Promise.reject(Error('speak'))},stop(){return Promise.reject(Error('stop'))}}"]:
        page.evaluate('window.ThornhavenVoice='+impl)
        open_talk()
        click('Remind me about your summons')
        assert answer()==page.evaluate('humanStories.dalen.clue')
        page.evaluate("closePanel('adventureScreen')")
        assert page.locator('#adventureText').get_attribute('tabindex') is None
    page.evaluate("Object.defineProperty(window,'ThornhavenVoice',{configurable:true,get(){throw Error('unavailable')}})")
    open_talk()
    page.evaluate("closePanel('adventureScreen');delete window.ThornhavenVoice;window.ThornhavenVoice=stubVoice")
    assert page.evaluate('voiceUnhandled') == []
    open_talk()
    click('Remind me about your summons')
    assert answer() == page.evaluate('humanStories.dalen.clue')
    # Only the current camp clue; no future letter/footprints/Ada/epilogue reveal.
    quest('The Unknown Caller')
    assert 'dying campfire' in answer()
    assert all(x not in answer() for x in ['footprints', 'Ada', 'Open Gate', 'sealed message'])
    page.evaluate('townQuestState._camp.stage=1')
    click('How much have we done?')
    assert '1/3 discoveries' in answer()
    click('What is our next step?')
    assert 'sealed message' in answer() and 'footprints' not in answer()
    # Same current task, different follow-up and live progress.
    quest('Dalen the Guard · A Shared Summons')
    assert 'two enemies' in answer() and '0/2' in answer()
    page.evaluate('townQuestState.recruit_dalen.kills=2')
    click('How much have we done?')
    assert 'ready to turn in' in answer() and 'Return to Wayfarer’s Camp' in answer()
    click('What is our next step?')
    assert 'Defeat two' not in answer()
    page.evaluate('townQuestState.recruit_dalen.claimed=true')
    click('How much have we done?')
    assert 'no longer active' in answer()
    # Accepted town quest: actual counters/materials; no invented reward claim.
    page.evaluate("townQuestState.ashvale_watch={accepted:true,kills:0,claimed:false}; journalActiveRows()")
    title = page.evaluate('townQuestDefs.ashvale_watch.title')
    quest(title)
    assert 'Kills 0/' in answer()
    click('Anything to watch for?')
    drop = page.evaluate('itemDefs[townQuestDefs.ashvale_watch.drop].name')
    assert drop in answer() and 'still need' in answer()
    page.evaluate("""() => {
        const q=townQuestDefs.ashvale_watch; townQuestState.ashvale_watch.kills=q.target;
        for(let i=0;i<q.dropTarget;i++)addItem(q.drop);
    }""")
    click('How much have we done?')
    assert 'ready to turn in' in answer() and 'Return to' in answer()
    before = page.evaluate('JSON.stringify(snapshotGameState())')
    for _ in range(3):
        click('What is our next step?'); click('How much have we done?')
    assert page.evaluate('JSON.stringify(snapshotGameState())') == before
    # Companion requirement, not a silent quest/party switch.
    page.evaluate("humanParty().roster.sylvi=makeHuman('sylvi'); humanParty().active='sylvi'; humanParty().roster.sylvi.hp-=7")
    click('What is our next step?')
    assert 'Which trail' in answer()
    quest(title); click('Anything to watch for?')
    assert 'Dalen the Guard active' in answer() and 'vitality' in answer()
    # Other personalities use only their already-established summons clue.
    for cid, line in [('corin','weighs on you'),('eryn','examine what we know')]:
        page.evaluate('(id)=>{humanParty().roster[id]=makeHuman(id);humanParty().active=id}', cid)
        open_talk(); assert line in answer()
        click('Remind me about your summons'); assert answer() == page.evaluate('(id)=>humanStories[id].clue', cid)
    # Briar staged disclosure and cautious fallback for puzzle quests.
    page.evaluate("townQuestState._camp.claimed=true;townQuestState.briar_hollow={accepted:true,clues:[],rescued:false,claimed:false}")
    quest('The Town That Did Not Wake')
    assert 'broken bell' in answer() and 'Ada' not in answer() and 'cellar' not in answer()
    page.evaluate("townQuestState.briar_hollow.clues=['briar_bell','briar_clinic','briar_gate']")
    click('How much have we done?'); click('What is our next step?')
    assert 'cellar door' in answer() and 'road signal' not in answer()
    page.evaluate("townQuestState.briar_hollow.claimed=true;huntRewarded=true;done=true;hasFourfoldKey=true")
    quest('The Ember Rune')
    assert 'Quest Journal' in answer() and 'West' not in answer()
    # Unknown/unsafe catalog text is inert, with no fallback to hidden desc/reward.
    page.evaluate("""() => {
       window.realRows=journalActiveRows;
       journalActiveRows=()=>[{id:'unknown',title:'<img src=x onerror=window.injected=1>',desc:'SECRET FUTURE',reward:'FAKE REWARD',active:true,done:false}];
    }""")
    page.evaluate('ThornhavenCompanionConversation.open()'); click('What should we focus on?')
    click('<img src=x onerror=window.injected=1>')
    assert '<img src=x' in answer() and 'SECRET FUTURE' not in answer() and 'FAKE REWARD' not in answer()
    assert page.locator('#adventureScreen img').count() == 0
    assert not page.evaluate('Boolean(window.injected)')
    # Interrupted/replaced dialogs and stale DOM callbacks cannot reopen a turn.
    page.evaluate("window.staleButton=document.querySelector('#adventureChoices button'); openAdventureDialog('Other story','Unchanged story text',[]); staleButton.click()")
    assert answer() == 'Unchanged story text'
    # No quests, paused quests, and zero-health companion.
    page.evaluate('journalActiveRows=()=>[];ThornhavenCompanionConversation.open()')
    click('What should we focus on?'); assert 'no active commitments' in answer()
    page.evaluate("journalActiveRows=realRows;townQuestState._journal.paused.ashvale_watch=true")
    page.evaluate('ThornhavenCompanionConversation.open()'); click('What should we focus on?')
    assert title not in page.locator('#adventureChoices').inner_text()
    page.evaluate('humanCompanion().hp=0;ThornhavenCompanionConversation.open()')
    assert 'No active companion' in answer()
    page.evaluate("humanParty().roster.eryn.hp=humanParty().roster.eryn.max;ThornhavenCompanionConversation.open()")
    # Interruption by character switch invalidates stored callbacks, even when
    # both slots have the same companion. Restore slot immediately for saving.
    page.evaluate("window.oldSlot=activeSlotId;activeSlotId='other-slot';document.querySelector('#adventureChoices button').click();activeSlotId=oldSlot")
    assert 'examine what we know' in answer()
    open_talk(); click('What should we focus on?')
    # The new controls fit both orientations; all have usable touch height and
    # can be scrolled into view within the existing modal layout.
    for button in page.locator('#adventureChoices button').all():
        button.scroll_into_view_if_needed()
        bounds=button.bounding_box()
        assert bounds and bounds['height'] >= 40, bounds
        assert bounds['x'] >= 0 and bounds['x']+bounds['width'] <= width+1, bounds
    output.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(output/f'conversation-{width}x{height}.png'))
    page.evaluate("closePanel('adventureScreen');saveGame()")
    assert page.evaluate("""() => {
       const restored=ThornhavenCloudSaveCore.parse(ThornhavenCloudSaveCore.encode(saveSlots,activeSlotId));
       return restored.slots[activeSlotId].state.townQuestState.recruit_dalen.claimed===true &&
        restored.slots[activeSlotId].state.townQuestState._humanParty.active==='eryn';
    }""")
    seed = page.evaluate('window.__qaStorage')
    restarted = browser.new_page(viewport={'width':width,'height':height})
    restarted.route('**/*',lambda route: route.abort())
    restarted.context.set_offline(True)
    restarted.on('pageerror',lambda err: errors.append(str(err)))
    restarted.set_content(html_for_browser(assets,seed),wait_until='domcontentloaded',timeout=60000)
    restarted.locator('#titleContinue').click()
    restarted.evaluate('ThornhavenCompanionConversation.open()')
    assert 'examine what we know' in restarted.locator('#adventureText').inner_text()
    assert restarted.evaluate('townQuestState.recruit_dalen.claimed') is True
    assert restarted.evaluate('townQuestState.ashvale_watch.claimed') is False
    restarted.close()
    assert not errors, errors
    page.close()
    return {'viewport':f'{width}x{height}','result':'PASS','network':'offline; requests aborted','pageErrors':errors}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets',type=Path,default=Path('app/src/main/assets'))
    parser.add_argument('--browser',default=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser'))
    parser.add_argument('--evidence-dir',type=Path,default=Path('reports/browser-companion-conversation-qa'))
    args=parser.parse_args()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
        results=[run(browser,args.assets,args.evidence_dir,w,h) for w,h in [(412,915),(915,412)]]
        browser.close()
    (args.evidence_dir/'result.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results))

if __name__ == '__main__':
    main()

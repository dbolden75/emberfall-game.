from pathlib import Path
import sys,re
p=Path(sys.argv[1]);s=p.read_text()
# Separate title artwork from character creation.
a=s.index('<div class="openingHero">',s.index('<section class="setup"'));b=s.index('<div class="openingCreate">',a);s=s[:a]+s[b:]
s=s.replace('>Begin Adventure</button>','>Begin Journey</button>')
s=re.sub(r'Starts in (Ashvale, home of the Watch|Brackenford, the scouts’ town|Sunmere, seat of the Arcanum|Stonewatch, home of the Order)\.', 'Begins at Wayfarer’s Camp.',s)
css='''<style id="camp-update">
#summonsScreen{position:fixed;inset:0;z-index:8500;background:linear-gradient(#08120fe8,#08120fc9),url('assets/ashvale-opening.webp') center/cover;display:grid;place-items:center;overflow:auto;padding:22px;color:#f3e4be;text-align:center;touch-action:pan-y}#summonsScreen[hidden]{display:none!important}.summonsContent{width:min(600px,100%);margin:auto}.summonsContent h1{font:700 clamp(26px,5vw,44px) Georgia;letter-spacing:.06em;margin:0 0 12px}.summonsContent p{font:18px/1.6 Georgia}.summonsContent blockquote{margin:16px 0;font:italic 20px/1.5 Georgia;color:#ecd39a}#summonsContinue{padding:12px 32px;min-height:48px;border:1px solid #ddbd78;background:#735b35;color:#fff0c9;border-radius:5px;font:bold 16px system-ui}
.shell #characterSetup.setup{display:block!important;grid-template-columns:none!important;width:min(760px,100%);max-height:100%;min-height:0;overflow-y:auto!important;touch-action:pan-y}.shell #characterSetup.setup[hidden]{display:none!important}#characterSetup .openingCreate{padding:18px 22px}#characterSetup .classCard{min-height:95px}#characterSetup .startButton{min-height:48px;margin-top:14px}#characterSetup .openingIntro{margin-bottom:8px}#creationBack{min-height:44px;margin:8px 14px}.classPick input:focus-visible+.classCard{outline:2px solid #edce88}
#questScreen .screenPanel{background:#e7d6ae;color:#362b1e;border-color:#88734d}#questScreen .screenHead,#questScreen .screenFoot{background:#342f23;color:#f2dfb5}#questScreen .screenHead p{color:#d1c19e}#questScreen .screenNotice{color:#645131}#questScreen .questEntry{background:#f3e6c6;border:1px solid #b7a175;border-left:4px solid #8c7042;border-radius:5px;color:#392f21;padding:14px;margin-bottom:10px}#questScreen .questEntry p,#questScreen .journalProgress{color:#5d4b33}#questScreen .journalTitle{color:#3d2d18;font:700 20px Georgia;min-height:44px}#questScreen .questEntry h3{color:#51391d}#questScreen .journalBadge{color:#806137}#questScreen .journalTabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}#questScreen button{min-height:44px}#questScreen .journalEmpty{color:#5d4b33}.screenPanel{animation:panelReveal .16s ease-out}@keyframes panelReveal{from{opacity:.3;transform:translateY(8px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.screenPanel{animation:none}}
@media(orientation:landscape) and (max-height:560px){#summonsScreen{padding:14px 30px}.summonsContent h1{font-size:27px;margin:0 0 8px}.summonsContent p{font-size:15px;line-height:1.4;margin:8px 0}.summonsContent blockquote{font-size:17px;line-height:1.4;margin:10px 0}#characterSetup .classCard{min-height:86px}#characterSetup .openingCreate{padding:12px 18px}}
</style>'''
s=s.replace('</head>',css+'</head>')
html='''<section id="summonsScreen" hidden aria-label="An unsigned summons"><div class="summonsContent"><h1>THORNHAVEN</h1><p>An unsigned letter arrives before dusk.</p><blockquote>“The kingdom is in danger. Come to the camp beside the old road at dusk. Tell no one. If you still believe this land is worth saving, I need your help.”</blockquote><p>There is no name. Only a location: <strong>Wayfarer’s Camp.</strong><br>You take the road before nightfall.</p><button id="summonsContinue" type="button">Tap to Continue</button></div></section>'''
s=s.replace('<main class="shell">',html+'<main class="shell">')
s=s.replace("const origin=classOrigins[player.class],home=maps[origin.town],[sx,sy]=home.arrival||[480,500];setMap(origin.town,sx,sy,false);", "townQuestState._camp={stage:0,claimed:false};townQuestState._tracking={id:'camp_caller'};setMap('wayfarers_camp',480,420,false);")
s=s.replace("showCampaignScene('opening')});", "say('Wayfarer’s Camp · inspect the dying fire. Your Journal records each discovery.');});")
s=s.replace("function worldObjectInteract(obj){", "function worldObjectInteract(obj){\n if(campInteract(obj))return true;")
s=s.replace("function questGuide(q){", "function questGuide(q){\n if(q.id==='camp_caller')return campGuide();\n if(q.id==='camp_patrol')return campPatrolGuide();")
s=s.replace("const journalMainOrder=['main_hunt'", "const journalMainOrder=['camp_caller','briar_hollow','main_hunt'")
s=s.replace("function questCatalog(){return [briarQuestEntry(),", "function questCatalog(){return [...campQuestEntries(),briarQuestEntry(),")
s=s.replace("function renderQuests(){", "function renderQuests(){if(journalTab==='notes'){renderCampNotes();return;}")
s=s.replace("['history','History']", "['history','Completed'],['notes','Story notes']")
s=s.replace("'Your main story is complete.'", "'This chapter is closed. The roads still hold unanswered questions.'")
s=s.replace("function showTitleMenu(){", "function showTitleMenu(){document.getElementById('summonsScreen').hidden=true;")
s=s.replace("selectSlotBeforeTitle(id);};", "selectSlotBeforeTitle(id);if(!hasStarted){document.getElementById('characterSetup').hidden=true;document.getElementById('summonsScreen').hidden=false;}};")
s=s.replace("drawNpcStories();for(const node", "drawNpcStories();drawWayfarerCamp();for(const node")
s=s.replace("drawTownHouseLabels();", "drawTownHouseLabels();drawCampLighting();")
# Preserve latest game and add content inside its closure, before the startup menu.
addon=Path(__file__).with_name('camp-content.js').read_text()
init,addon=addon.split('function campState()',1); addon='function campState()'+addon
s=s.replace("let mapId='ashvale'",init+"\nlet mapId='ashvale'")
s=s.replace('installSimpleOptions();\nshowTitleMenu();', 'installSimpleOptions();\n'+addon+'\nshowTitleMenu();')
p.write_text(s)

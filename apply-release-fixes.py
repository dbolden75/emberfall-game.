from pathlib import Path
root=Path('thornhaven')
p=root/'app/src/main/assets/index.html'
s=p.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1, (old[:80],s.count(old))
 s=s.replace(old,new,1)
replace('<meta charset="utf-8">','<meta charset="utf-8">\n<link rel="icon" href="data:,">')
# Keep useful town directions available without squeezing the world map.
replace("el.innerHTML='<div class=\"atlasHint\"><b>VEILHAVEN", "el.innerHTML='<details class=\"atlasRoutes\"><summary>Town routes · Veilhaven and your settlement</summary><div class=\"atlasHint\"><b>VEILHAVEN")
replace("'Settlement route')+'</button></div><div class=\"atlasToolbar\">", "'Settlement route')+'</button></div></details><div class=\"atlasToolbar\">")
replace('</head>','<style>\n.atlasRoutes{flex-shrink:0;font:11px/1.3 system-ui;color:#eadbb0}.atlasRoutes summary{cursor:pointer;min-height:28px;display:flex;align-items:center;padding:2px 6px;border:1px solid #89734a;border-radius:4px}.atlasRoutes[open]{max-height:34dvh;overflow:auto}.atlasRoutes .atlasHint p{margin:3px 0}.atlasRoutes button{min-height:44px;padding:6px 10px;margin:3px;border:1px solid #b29662;border-radius:5px;background:#263325;color:#f2dfb5;touch-action:manipulation}\n</style>\n</head>')
# Touch activation can emit a compatibility click with detail=0 after rerender.
replace('function bindShopControls(event){','let lastShopPointerAt=-Infinity;shopScreen.addEventListener(\'keydown\',()=>{lastShopPointerAt=-Infinity});function bindShopControls(event){')
replace("if(!button||!shopScreen.contains(button))return;if(event.type==='click'&&event.detail!==0)return;if(event.type==='pointerdown')event.preventDefault();runShopControl(button)","if(!button||!shopScreen.contains(button))return;if(event.type==='click'&&(event.detail!==0||performance.now()-lastShopPointerAt<750))return;if(event.type==='pointerdown'){lastShopPointerAt=performance.now();event.preventDefault();}runShopControl(button)")
p.write_text(s)
# The exhaustive playthrough predates Briar Hollow; complete it through handlers.
p=root/'qa/dan-quest-completion.cjs';s=p.read_text()
old="closePanel('adventureScreen');const catalog=questCatalog()"
assert s.count(old)==1
new="closePanel('adventureScreen');setMap('briarhollow',480,315,false);briarInteract(object('briar_sign'));adventureChoices[0].action();closePanel('adventureScreen');for(const id of ['briar_bell','briar_clinic','briar_gate']){briarInteract(object(id));closePanel('adventureScreen');}briarInteract(object('briar_cellar'));adventureChoices[0].action();closePanel('adventureScreen');briarInteract(object('briar_signal'));closePanel('adventureScreen');briarInteract(object('briar_memorial'));closePanel('adventureScreen');check(briarState().claimed,'Briar Hollow clues, survivor rescue and memorial completed');const catalog=questCatalog()"
p.write_text(s.replace(old,new,1))

# Reserve space for the actual map on short landscape screens. The header close
# control remains available; the footer repeats that same action.
p=root/'app/src/main/assets/index.html';s=p.read_text()
s=s.replace('</head>','<style>@media(orientation:landscape) and (max-height:560px){#travelScreen .screenFoot{display:none}}</style></head>',1)
s=s.replace('New Journey · v1.0.24 ·','New Journey · v1.0.29 ·')
p.write_text(s)

# Compare state within one browser task, before the live clock advances.
p=root/'qa/dan-max.cjs';s=p.read_text()
start=s.index('await run("closePanel(\'adventureScreen\');soundEnabled=false;saveGame();window.beforeDan=')
end=s.index('await p.reload();',start)
s=s[:start]+'''const reapply=await run("(()=>{closePanel('adventureScreen');soundEnabled=false;saveGame();const snapshot=()=>JSON.parse(JSON.stringify({inventory:player.inventory,coins:player.coins,skills:gatheringSkills,quests:townQuestState,forge:gearUpgradeLevels}));const before=snapshot();applyDanTestProfile();saveGame();return {before,after:snapshot()};})()");assert.deepEqual(reapply.after,reapply.before);'''+s[end:]
p.write_text(s)
p=root/'qa/tutorial-browser.cjs';s=p.read_text()
old="await run('saveGame()');const remaining=await run('xpBoostSeconds()');"
assert old in s
p.write_text(s.replace(old,"const remaining=await run('saveGame();xpBoostSeconds()');",1))

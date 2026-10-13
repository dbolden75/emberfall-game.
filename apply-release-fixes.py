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

/* Presentation only. Reuses the original party controls and IDs; no save changes. */
(() => {
 'use strict';
 const side=document.querySelector('.hudSide');
 if(!side)return;
 const details=document.createElement('div');details.id='hudDetails';
 for(const child of [...side.children])details.appendChild(child);
 const bar=document.createElement('div');bar.id='compactHudBar';
 const health=document.createElement('div');health.id='compactHealth';health.setAttribute('role','group');health.setAttribute('aria-label','Hero vitality');
 const text=document.createElement('span');text.id='compactHpText';
 const meter=document.createElement('div');meter.className='compactHpTrack';meter.setAttribute('aria-hidden','true');
 const fill=document.createElement('div');fill.id='compactHpFill';meter.appendChild(fill);health.append(text,meter);
 const toggle=document.createElement('button');toggle.type='button';toggle.id='hudDetailsToggle';toggle.setAttribute('aria-controls','hudDetails');
 bar.append(health,toggle);side.append(bar,details);
 const setExpanded=expanded=>{details.hidden=!expanded;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'Hide party details':'Show party details');toggle.textContent=expanded?'Hide ▴':'Party ▾';side.classList.toggle('detailsExpanded',expanded);};
 toggle.addEventListener('click',()=>setExpanded(details.hidden));
 details.addEventListener('click',event=>{if(event.target.closest('button'))setExpanded(false);},true);
 let hpKey='';
 const sync=()=>{const hp=Math.max(0,Math.ceil(player.hp)),max=Math.max(1,Math.ceil(player.max));const key=hp+'/'+max;if(key===hpKey)return;hpKey=key;text.textContent='HP '+hp+' / '+max;fill.style.width=Math.min(100,hp/max*100)+'%';health.setAttribute('aria-label','Hero vitality '+hp+' of '+max);};
 const previous=ui;ui=function(){previous();sync();};
 const css=document.createElement('style');css.id='compactHudStyles';css.textContent=`
body:has(#gameView:not([hidden])) .shell .hudSide{width:224px!important;max-width:calc(100vw - 20px)}
#compactHudBar{display:flex;align-items:center;gap:7px;height:44px;pointer-events:auto;border:1px solid #9a8559;border-radius:9px;background:#15231be8;box-shadow:0 2px 8px #0005;padding:0 0 0 10px;box-sizing:border-box}
#compactHealth{flex:1;min-width:0;font:600 11px/1.3 system-ui;color:#fff1ce}
.compactHpTrack{height:5px;background:#51332e;border-radius:4px;overflow:hidden;margin-top:4px}#compactHpFill{height:100%;background:linear-gradient(90deg,#b94035,#eb8e66)}
body .shell #hudDetailsToggle{flex:none;width:72px;min-width:72px;height:44px;min-height:44px;padding:0 6px;border:0;border-left:1px solid #8d7d50;border-radius:0 8px 8px 0;background:#2b3c2e;color:#fff0bf;font:600 12px system-ui;touch-action:manipulation}
body .shell #hudDetailsToggle:focus-visible{outline:3px solid #ffe29b;outline-offset:2px}
#hudDetails[hidden]{display:none!important}
#hudDetails{margin-top:6px;padding:8px;max-height:calc(100dvh - 110px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;background:#142019f5;border:1px solid #9a8559;border-radius:9px;box-shadow:0 4px 16px #0008;box-sizing:border-box}
body:has(#gameView:not([hidden])) .shell #hudDetails #partyPortraits{margin-bottom:6px;display:flex;gap:5px}
body:has(#gameView:not([hidden])) .shell #hudDetails #partyPortraits button{flex:1;width:auto;min-height:44px;height:60px}
body .shell #hudDetails #partyPortraits canvas,body .shell #hudDetails #partyPortraits img{height:42px!important;width:36px!important}
body .shell #hudDetails .stats{width:100%!important}
body:has(#gameView:not([hidden])) .shell #hudDetails #explorationActions{position:static;left:auto;transform:none;width:auto;display:flex;gap:5px}
body .shell #hudDetails #explorationActions button{min-height:44px}
/* Expanded Party controls must stay tappable above movement controls in short landscape. */
body:has(#gameView:not([hidden])) .shell .hud:has(.hudSide.detailsExpanded){z-index:9}
body.previewExpanded:has(#gameView:not([hidden])) .shell .top{padding-left:54px!important}
@media(max-width:440px){body.previewExpanded:has(#gameView:not([hidden])) .brand{font-size:11px;letter-spacing:.08em}body.previewExpanded:has(#gameView:not([hidden])) .top .status{gap:3px}}
@media(orientation:landscape) and (max-height:500px){#hudDetails{max-height:calc(100dvh - 102px)}}
`;document.head.appendChild(css);setExpanded(false);sync();
})();

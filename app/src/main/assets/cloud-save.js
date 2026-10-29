/* Manual per-player cloud backup through Android's document provider. */
(function(){
'use strict';
const core=window.ThornhavenCloudSaveCore;
const style=document.createElement('style');style.textContent='#cloudSavePanel{position:fixed;inset:0;z-index:11000;background:#111d18f7;color:#f1dfb6;padding:20px;overflow:auto;font:16px/1.5 system-ui}#cloudSavePanel[hidden]{display:none}#cloudSavePanel .cloudCard{max-width:620px;margin:0 auto}#cloudSavePanel button{min-height:44px;padding:10px 16px;margin:5px;border:1px solid #bba372;border-radius:7px;background:#2c4130;color:#fff1ce;font:inherit}#cloudSavePanel button:disabled{opacity:.5}#cloudSavePanel p{white-space:pre-wrap}#cloudSavePanel label{display:block;margin:16px 0}#cloudSavePanel input[type=checkbox]{width:24px;height:24px;vertical-align:middle}#cloudSaveStatus{min-height:24px}';document.head.appendChild(style);
const panel=document.createElement('section');panel.id='cloudSavePanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','cloudSaveHeading');
panel.innerHTML='<div class="cloudCard"><h2 id="cloudSaveHeading">Cloud Save</h2><p id="cloudSaveHelp"></p><button id="cloudSaveExport">Save to Cloud</button><button id="cloudSaveImport">Load from Cloud</button><button id="cloudSaveManage">Manage Backups</button><button id="cloudSaveRecovery">Restore recovery copy</button><p id="cloudSaveStatus" role="status" aria-live="polite"></p><section id="cloudSaveReview" hidden><h3>Review backup</h3><p id="cloudSaveSummary"></p><label id="cloudSaveOlderLabel" hidden><input id="cloudSaveOlder" type="checkbox"> I understand this may replace newer progress, remove local characters, or replace unreadable local save data.</label><button id="cloudSaveConfirm">Replace local saves</button><button id="cloudSaveCancel">Cancel restore</button></section><input id="cloudSaveFile" type="file" accept=".json,application/json" hidden><button id="cloudSaveClose">Back to main menu</button></div>';
document.body.appendChild(panel);
const get=id=>document.getElementById(id),status=text=>get('cloudSaveStatus').textContent=text;
const native=window.ThornhavenCloudSave;
get('cloudSaveHelp').textContent=native?'Choose Google Drive in the file picker to use your own signed-in account. Each save creates a separate backup. Local offline saving stays on. Cloud uploads are handled by your chosen provider; check Drive has finished syncing before switching phones.':'This browser supports backup files, not direct Google sign-in or automatic cloud sync. Download a backup and store it in your own Drive, then choose that file to restore on another device.';
if(!native){get('cloudSaveExport').textContent='Download backup';get('cloudSaveImport').textContent='Open backup file';}
const button=document.createElement('button');button.id='titleCloudSave';button.type='button';button.textContent='Cloud Save';const hint=document.createElement('small');hint.textContent='Back up or recover your characters';button.appendChild(hint);document.querySelector('#titleMenu .titleButtons').appendChild(button);
let pending=null,expected=null,requestId=null,previousFocus=null,previousPause=false;
function busy(on){for(const id of ['cloudSaveExport','cloudSaveImport','cloudSaveManage','cloudSaveRecovery','cloudSaveClose'])get(id).disabled=on;}
function resetReview(){pending=null;expected=null;get('cloudSaveReview').hidden=true;get('cloudSaveOlder').checked=false;}
function show(){previousFocus=document.activeElement;previousPause=!!window.jarvisPaused;window.jarvisPaused=true;panel.hidden=false;resetReview();status('');get('cloudSaveClose').focus();}
function close(){if(requestId)return;panel.hidden=true;window.jarvisPaused=previousPause;resetReview();previousFocus?.focus();}
button.onclick=show;get('cloudSaveClose').onclick=close;
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const controls=[...panel.querySelectorAll('button,input')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function review(text){
 const incoming=core.parse(text);
 for(const row of Object.values(incoming.slots))if(!Object.prototype.hasOwnProperty.call(maps,row.state.mapId))throw Error('This backup uses a map unavailable in this version.');
 // The game drops pets with unrecognized ids when loading. Do not silently
 // erase a pet from a backup made by a newer version.
 for(const row of Object.values(incoming.slots))for(const companion of row.state.companions)
  if(!Object.prototype.hasOwnProperty.call(petDefs,companion.id))
   throw Error('This backup contains a pet unavailable in this version. Update Thornhaven before restoring.');
 expected=localStorage.getItem(core.SLOT_KEY);const local=core.readLocal(expected),older=core.conflicts(incoming,local.slots),risk=local.unreadable||older.length>0;
 pending=text;get('cloudSaveSummary').textContent='Created '+new Date(incoming.createdAt).toLocaleString()+'\n'+Object.values(incoming.slots).map(r=>r.state.player.name+' · '+r.state.player.class+' · Level '+r.state.player.level).join('\n')+'\n\nThis replaces all four local character slots. A recovery copy will be kept on this device.';
 get('cloudSaveOlderLabel').hidden=!risk;get('cloudSaveOlder').checked=false;get('cloudSaveReview').hidden=false;status(local.unreadable?'Warning: local save data is unreadable. Restoring will replace it; the original data will be kept in a recovery copy.':older.length?'Warning: this backup is older or omits local characters.':'Review the characters before replacing local progress.');get('cloudSaveCancel').focus();
}
get('cloudSaveCancel').onclick=()=>{resetReview();status('Restore cancelled. Local progress is unchanged.');};
get('cloudSaveConfirm').onclick=()=>{
 try{if(!pending)return;if(!window.confirm('Replace local characters with this backup? A recovery copy will be kept.'))return;
 core.restore(localStorage,pending,{confirmed:true,allowOlder:get('cloudSaveOlder').checked,expectedCurrent:expected});
 // Stop lifecycle autosaves from overwriting the imported slots before reload.
 switchingCharacter=true;status('Backup restored. Returning to the main menu…');window.location.reload();
 }catch(e){status(e.message);}
};
function startNative(action,text=''){
 if(requestId)return;requestId=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);busy(true);
 try{native[action](requestId,text);}catch(e){requestId=null;busy(false);status('The file picker could not open. Your local saves are unchanged.');}
}
get('cloudSaveExport').onclick=()=>{try{const slots=JSON.parse(localStorage.getItem(core.SLOT_KEY)||'{}'),text=core.encode(slots,activeSlotId);resetReview();if(native){startNative('save',text);return;}const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='Thornhaven-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status('Backup download requested. Store the file in your own Drive.');}catch(e){status(e.message);}};
get('cloudSaveImport').onclick=()=>{resetReview();if(native)startNative('load');else get('cloudSaveFile').click();};
get('cloudSaveFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>core.MAX_BYTES)throw Error('Backup exceeds 8 MB.');review(await f.text());}catch(error){status(error.message);}finally{e.target.value='';}};
get('cloudSaveManage').onclick=()=>{if(native)startNative('manage');else status('Your cloud backups are files in your own Drive. Manage them there. Use Open backup file to restore one here.');};
get('cloudSaveRecovery').onclick=()=>{try{review(core.recoveryText(localStorage));status('Recovery copy loaded for review. It is not restored until you confirm.');}catch(e){status(e.message);}};
window.addEventListener('thornhavenCloudResult',event=>{
 const data=event.detail;if(!data||data.id!==requestId)return;requestId=null;busy(false);
 if(data.cancelled){status('Cancelled. Local progress is unchanged.');return;}
 if(!data.ok){status(data.message||'The backup operation failed. Local progress is unchanged.');return;}
 try{if(data.action==='load')review(data.text);else status(data.action==='save'?'Backup written to the selected provider. If you chose Drive, wait for it to finish syncing.':'Manage backups in your own Drive account.');}catch(e){status(e.message);}
});
})();

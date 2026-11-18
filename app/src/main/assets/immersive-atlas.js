/* Thornhaven painted atlas. Presentation only: original coordinates, travel gates,
 * collision, quests, character slots and exploration state remain authoritative. */
(function () {
  'use strict';
  const art = new Image();
  art.src = 'art/atlas-painted-v1.png';
  const originalRender = renderTravel;
  const originalDetails = showAtlasDetails;
  const originalTravel = travelTo;
  const originalFog = paintExplorationFog;
  const originalSize = sizeAtlas;
  const pending = new Set();
  let showTrails = false;
  const tales = {
    stonewatch: {title:'The Confluence Bastion',text:'At the southern river gate, old stone walls hold the memory of every ship that passed beneath them. Stonewatch keeps the last watch before the waters divide.',inspiration:'Fort Condé and the Mobile river delta'},
    glassridge: {title:'The River That Cut the Mountain',text:'A narrow river has opened a deep wound through the highlands. Travellers leave ribbons at the overlook: one for the journey out, another for those who never returned.',inspiration:'Little River Canyon'},
    frostwood: {title:'The Echoing Gate',text:'Beyond the frost-dark trees, a cavern mouth swallows the wind. The keepers say a spoken promise returns from its depths in a voice not quite your own.',inspiration:'Cathedral Caverns'},
    briarhollow: {title:'The Town the River Remembered',text:'Broken doorways stand where two waters once met. Briar Hollow’s abandoned streets are a warning: a town can disappear long before its last story is told.',inspiration:'Old Cahawba'}
  };
  function paint(target) {
    const canvas=target||document.getElementById('themedWorldMap');if(!canvas)return;
    const size=1620; if(canvas.width!==size)canvas.width=size;if(canvas.height!==size)canvas.height=size;
    const g=canvas.getContext('2d');if(!g)return;
    g.clearRect(0,0,size,size);
    if(art.complete&&art.naturalWidth){g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(art,0,0,size,size);canvas.dataset.atlasArtwork='painted-v1';}
    else {const fill=g.createRadialGradient(810,740,100,810,740,1200);fill.addColorStop(0,'#547448');fill.addColorStop(1,'#102921');g.fillStyle=fill;g.fillRect(0,0,size,size);g.fillStyle='#e1ce99';g.textAlign='center';g.font='32px Georgia';g.fillText(art.dataset?.failed?'Atlas artwork unavailable':'Unfurling the atlas…',810,790);pending.add(canvas);}
    // Only show local travel topology on request, never the old world-spanning grid.
    if(showTrails&&canvas.id==='themedWorldMap'){
      const pos=worldPositions[mapId];if(pos){const ix=worldGrid.findIndex(r=>r.includes(mapId)),jx=worldGrid[ix]?.indexOf(mapId);const neighbors=[[ix-1,jx],[ix+1,jx],[ix,jx-1],[ix,jx+1]].map(([y,x])=>worldGrid[y]?.[x]).filter(Boolean);
        for(const id of neighbors){const q=worldPositions[id],x=pos[0]*size/100,y=pos[1]*size/100,tx=q[0]*size/100,ty=q[1]*size/100;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo((x+tx)/2+(ty-y)*.16,(y+ty)/2-(tx-x)*.16,tx,ty);g.strokeStyle='#ffe2a1';g.lineWidth=4;g.setLineDash([8,8]);g.stroke();g.setLineDash([]);}
      }
    }
    const v=g.createRadialGradient(810,810,540,810,810,1120);v.addColorStop(0,'#07140b00');v.addColorStop(1,'#07140b85');g.fillStyle=v;g.fillRect(0,0,size,size);
    g.strokeStyle='#c1a46d';g.lineWidth=3;g.strokeRect(7,7,size-14,size-14);
  }
  drawThemedWorldMap=paint;
  art.addEventListener('load',()=>{for(const canvas of pending)if(canvas.isConnected)paint(canvas);pending.clear();paint();paint(document.getElementById('titleMap'));});
  art.addEventListener('error',()=>{art.dataset.failed='true';for(const canvas of pending)if(canvas.isConnected)paint(canvas);const status=document.getElementById('atlasSelection');if(status)status.textContent='Atlas artwork could not load. Location controls are still available; reopen the map to retry.';});
  paintExplorationFog=function(){originalFog();const fog=document.getElementById('thornhavenAtlasFog');if(fog)fog.setAttribute('aria-label','Unvisited lands are veiled. Discover locations on foot.');};
  sizeAtlas=function(fit=true,focus=mapId){originalSize(fit,focus);document.querySelector('.atlasView')?.classList.add('paintedAtlas');};
  function story(id){const tale=tales[id];if(!tale)return;const box=document.getElementById('atlasSelection');if(!box)return;const p=document.createElement('p');p.className='atlasStory';const title=document.createElement('strong');title.textContent=tale.title;const words=document.createElement('span');words.textContent=tale.text;p.append(title,words);box.append(p);}
  showAtlasDetails=function(id){originalDetails(id);const select=document.getElementById("atlasRegionSelect");if(select)select.value=id;story(id);};
  travelTo=function(id){const inspect=!fastTravelArmed;originalTravel(id);if(inspect&&!travelScreen.hidden)showAtlasDetails(id);};
  renderTravel=function(){
    originalRender();
    const view=document.querySelector('.atlasView');if(!view)return;view.classList.add('paintedAtlas');
    document.querySelector('#travelScreen h2').textContent='The Thornhaven Atlas';
    document.getElementById('atlasHere').onclick=()=>{sizeAtlas(false,mapId);showAtlasDetails(mapId);};
    const toolbar=document.querySelector('.atlasToolbar');
    const trails=document.createElement('button');trails.type='button';trails.id='atlasTrails';trails.textContent='Nearby paths';trails.setAttribute('aria-pressed',String(showTrails));trails.onclick=()=>{showTrails=!showTrails;trails.setAttribute('aria-pressed',String(showTrails));paint();};toolbar.append(trails);
    const selector=document.createElement('select');selector.id='atlasRegionSelect';selector.setAttribute('aria-label','Find a region on the atlas');
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Find a place…';selector.append(placeholder);
    for(const id of Object.keys(worldPositions).sort((a,b)=>maps[a].name.localeCompare(maps[b].name))){const option=document.createElement('option');option.value=id;option.textContent=maps[id].name+(townQuestState._visited?.[id]||id===mapId?'':' · uncharted');selector.append(option);}
    selector.onchange=()=>{if(selector.value){showAtlasDetails(selector.value);sizeAtlas(false,selector.value);}};toolbar.append(selector);
    document.getElementById('atlasSelection').textContent='Painted atlas · Explore on foot to reveal locations. Select a place for its story and route.';
    const by=document.createElement('span');by.className='atlasCartouche';by.textContent='THORNHAVEN';by.setAttribute('aria-hidden','true');view.append(by);
    const compass=document.createElement('span');compass.className='atlasCompass';compass.innerHTML='<span>N</span>✥<small>ASHVALE REACH</small>';compass.setAttribute('aria-hidden','true');view.append(compass);
    // Open on the whole new atlas rather than zooming into an unchanged campsite.
    requestAnimationFrame(()=>{sizeAtlas(true);paint();});
  };
  window.ThornhavenAtlas={version:'painted-v1',art,tales,draw:paint};
})();

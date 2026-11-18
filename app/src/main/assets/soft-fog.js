/* Soft, persistent exploration mist. One cached image per active region. */
(function () {
  'use strict';
  const layer = document.createElement('canvas');
  const brush = document.createElement('canvas');
  const radius = 88;
  brush.width = brush.height = radius * 2;
  const brushContext = brush.getContext('2d');
  const fade = brushContext.createRadialGradient(radius, radius, 38, radius, radius, radius);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(.35, 'rgba(0,0,0,.94)');
  fade.addColorStop(.7, 'rgba(0,0,0,.35)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  brushContext.fillStyle = fade;
  brushContext.fillRect(0, 0, brush.width, brush.height);
  let cachedState, cachedKey = '', cachedGeometry = '';
  const smallBrush = document.createElement('canvas');
  let stampedCells = new Set();

  window.drawSoftExplorationFog = function (target, bounds) {
    const explored = townQuestState._localExploration?.[mapId] || null;
    const width = bounds.maxX - bounds.minX, height = bounds.maxY - bounds.minY;
    if (!(width > 0 && height > 0)) return;
    const geometry = [mapId, bounds.minX, bounds.minY, width, height].join(':');
    const key = geometry + ':' + (window.localExplorationRevision || 0);
    if (explored !== cachedState || key !== cachedKey) {
      const regional = mapId === 'elderwood';
      // Exploration normally adds cells. Rebuild on load, geometry change or
      // deletion; otherwise stamp only additions without repainting 36k cells.
      const incremental = regional && explored === cachedState && geometry === cachedGeometry
        && [...stampedCells].every(cell => explored?.[cell]);
      const resolution = Math.min(.5, 1024 / Math.max(width, height));
      if (!incremental) {
        layer.width = Math.max(1, Math.ceil(width * resolution));
        layer.height = Math.max(1, Math.ceil(height * resolution));
        const fog = layer.getContext('2d');
        fog.setTransform(layer.width / width, 0, 0, layer.height / height,
          -bounds.minX * layer.width / width, -bounds.minY * layer.height / height);
        // Opaque uncharted terrain, shaded with broad cloud-like wisps.
        fog.fillStyle = '#536168';
        fog.fillRect(bounds.minX, bounds.minY, width, height);
        for (let i = 0; i < 24; i++) {
          const x = bounds.minX + ((i * .61803398875 + .17) % 1) * width;
          const y = bounds.minY + ((i * .41421356237 + .31) % 1) * height;
          const r = 160 + (i % 4) * 65;
          const cloud = fog.createRadialGradient(x, y, 0, x, y, r);
          cloud.addColorStop(0, i % 2 ? 'rgba(184,199,195,.23)' : 'rgba(23,40,48,.20)');
          cloud.addColorStop(1, 'rgba(90,110,116,0)');
          fog.fillStyle = cloud;
          fog.fillRect(x - r, y - r, r * 2, r * 2);
        }
        stampedCells = new Set();
        if (regional) {
          smallBrush.width = smallBrush.height = Math.max(1, Math.ceil(radius * 2 * resolution));
          smallBrush.getContext('2d').drawImage(brush, 0, 0, smallBrush.width, smallBrush.height);
        }
      }
      const fog = layer.getContext('2d');
      // Overlapping feathered circles merge the saved grid into a smooth edge.
      fog.globalCompositeOperation = 'destination-out';
      const interiorRows = new Map();
      for (const cell of Object.keys(explored || {})) {
        if (!explored[cell] || (incremental && stampedCells.has(cell))) continue;
        const parts = cell.split(',').map(Number);
        if (parts.length !== 2 || !parts.every(Number.isFinite)) continue;
        if (regional && !incremental) {
          const [cx, cy] = parts;
          // A known cell surrounded by known cells has no discovery boundary.
          // Clear interior row spans; keep feather stamps around every boundary.
          if (explored[(cx-1)+','+cy] && explored[(cx+1)+','+cy]
              && explored[cx+','+(cy-1)] && explored[cx+','+(cy+1)]) {
            if (!interiorRows.has(cy)) interiorRows.set(cy, []);
            interiorRows.get(cy).push(cx);stampedCells.add(cell);continue;
          }
        }
        const x = parts[0] * 64 + 32, y = parts[1] * 64 + 32;
        if (regional) {
          // Rasterize the feather once at the bounded fog-canvas resolution.
          fog.drawImage(smallBrush, x - radius, y - radius, radius * 2, radius * 2);
          stampedCells.add(cell);
        } else fog.drawImage(brush, x - radius, y - radius);
      }
      fog.fillStyle = '#000';
      for (const [row, columns] of interiorRows) {
        columns.sort((a,b)=>a-b);let start=columns[0],end=start;
        for (let i=1;i<=columns.length;i++) {
          if (columns[i]===end+1) {end=columns[i];continue;}
          fog.fillRect(start*64,row*64,(end-start+1)*64,64);
          start=end=columns[i];
        }
      }
      fog.globalCompositeOperation = 'source-over';
      cachedState = explored;
      cachedKey = key;
      cachedGeometry = geometry;
    }
    target.save();
    target.imageSmoothingEnabled = true;
    target.drawImage(layer, bounds.minX, bounds.minY, width, height);
    target.restore();
  };
})();

#!/usr/bin/env python3
"""Apply reviewable source hooks after authenticated release restoration."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
p=root/'app/src/main/assets/index.html'
s=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='801d9f3394aaa4987410b0cf6e96517a3952686546b6d613e2e95f4bda2a2e24', 'Restore the authenticated 1.0.69 baseline before applying the slice'
assert 'function regionalGeometry' not in s
anchor='const OPEN_WORLD_WIDTH=3840,OPEN_WORLD_HEIGHT=2400,OPEN_WORLD_ORIGIN_X=1440,OPEN_WORLD_ORIGIN_Y=900;'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'''
// Geometry is regional; legacy coordinates remain centered and unchanged.
function regionalGeometry(id=mapId){return id==='elderwood'?{width:15360,height:9600,ox:7200,oy:4500}:{width:OPEN_WORLD_WIDTH,height:OPEN_WORLD_HEIGHT,ox:OPEN_WORLD_ORIGIN_X,oy:OPEN_WORLD_ORIGIN_Y};}
''')
pos=s.index('function worldBounds(')
a,b=s[:pos],s[pos:]
for token,field in [('OPEN_WORLD_WIDTH','width'),('OPEN_WORLD_HEIGHT','height'),('OPEN_WORLD_ORIGIN_X','ox'),('OPEN_WORLD_ORIGIN_Y','oy')]:
 b=b.replace(token,'regionalGeometry().'+field)
# Explicit destination bounds must not use the current map's dimensions.
lines=b.splitlines(True)
lines[0]=lines[0].replace('regionalGeometry()','regionalGeometry(id)')
s=a+''.join(lines)
s=s.replace('</body>', '<script src="wilderness-slice.js"></script></body>')
p.write_text(s)
print('PASS: Elderwood geometry and module hooks applied')

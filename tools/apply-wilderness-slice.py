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
s=s.replace('</body>', '<script src="wilderness-slice.js"></script><script src="wilderness-activities.js"></script></body>')
# Keep the save format and synchronous commit, but hand off the one snapshot
# already validated by the durability guard. Other callers still snapshot.
s=s.replace('const data=snapshotGameState();const nextSlots=', 'const data=arguments[0]||snapshotGameState();const nextSlots=', 1)
s=s.replace('localStorage.setItem(SAVE_SLOTS_KEY,JSON.stringify(nextSlots));saveSlots=nextSlots;', "const rawSlots=JSON.stringify(nextSlots);localStorage.setItem(SAVE_SLOTS_KEY,rawSlots);if(localStorage.getItem(SAVE_SLOTS_KEY)!==rawSlots)throw Error('Character save did not persist');saveSlots=nextSlots;", 1)
old="console.warn('Active slot preference unavailable; character slot committed:',error.name)}}catch(error)"
new="console.warn('Active slot preference unavailable; character slot committed:',error.name)}return {state:data,rawSlots,slot:activeSlotId};}catch(error)"
assert s.count(old)==1
s=s.replace(old,new,1)
s=s.replace('\nfunction applyDanCompanionGear(', '\nsaveGame.acceptsPreparedSnapshot=true;\nfunction applyDanCompanionGear(',1)
# Tap paths are checked as swept diagonal segments. The legacy axis-separated
# player update can cancel a valid tangent around an activity tree. Match the
# existing follower's combined step for Elderwood tap navigation only.
old='if(!overlaps(nx,player.y,player.r))player.x=nx;else if(tapTarget)tapTarget=null;if(!overlaps(player.x,ny,player.r))player.y=ny;else if(tapTarget)tapTarget=null'
assert s.count(old)==1
s=s.replace(old,"if(mapId==='elderwood'&&tapTarget&&!overlaps(nx,ny,player.r)){player.x=nx;player.y=ny}else{"+old+"}",1)
p.write_text(s)
print('PASS: Elderwood geometry and module hooks applied')

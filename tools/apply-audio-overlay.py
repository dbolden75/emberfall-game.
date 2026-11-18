#!/usr/bin/env python3
"""Apply the audio-only delta after authenticating the unchanged 1.0.69 source."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
path=root/'app/src/main/assets/index.html'
s=path.read_text()
assert hashlib.sha256(path.read_bytes()).hexdigest()=='801d9f3394aaa4987410b0cf6e96517a3952686546b6d613e2e95f4bda2a2e24', 'Audio overlay baseline mismatch'
start=s.index('function playSfx(kind){')
end=s.index('\nlet savedControlSide=',start)
s=s[:start]+"function playSfx(kind){if(window.ThornhavenAudio)window.ThornhavenAudio.effect(kind)}"+s[end:]
def replace(old,new):
 global s
 assert s.count(old)==1, 'Audio anchor changed: '+old
 s=s.replace(old,new,1)
replace("player.castTime=.48;playSfx('attack');", "player.castTime=.48;playSfx(player.class==='cleric'?'heal':player.class==='mage'?'spell':'attack');")
replace("player.attack=.32;playSfx('attack');if(target)","player.attack=.32;playSfx(player.class==='mage'?'spell':'attack');if(target)")
replace("recordClassGearProgress('gather',mapId,node.skill);", "playSfx(node.skill);recordClassGearProgress('gather',mapId,node.skill);")
replace("if(found.length){e.lootClaimed=true;", "if(found.length){playSfx('loot');e.lootClaimed=true;")
replace("victim.hitTime=.2;battleVfx", "playSfx('hit');victim.hitTime=.2;battleVfx")
replace("if(player.walking&&footstepClock<=0){playSfx('step');footstepClock=.34}", "")
replace("const tutorial=tutorialState();if(tutorial.active&&!tutorial.steps.move)", "if(Math.hypot(player.x-tutorialStartX,player.y-tutorialStartY)>.1&&footstepClock<=0){playSfx('step');footstepClock=.34}const tutorial=tutorialState();if(tutorial.active&&!tutorial.steps.move)")
replace('</body>', '<script src="audio-catalog.js"></script><script src="game-audio.js"></script><script src="audio-integration.js"></script></body>')
path.write_text(s)
print('Audio overlay SHA-256:',hashlib.sha256(path.read_bytes()).hexdigest())

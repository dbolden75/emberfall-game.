// Ensure Android carries exactly the approved browser presentation, not preview storage guards.
const fs=require('fs'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(!html.includes('preview-guard.js'));
assert(!html.includes('Content-Security-Policy'));
const ordered=['purchase-api.js','immersive-atlas.js','smooth-motion.js','natural-followers.js','organic-terrain.js','scene-scale.js','compact-hud.js'];
let pos=-1;for(const name of ordered){const next=html.indexOf('src="'+name+'"');assert(next>pos,`Missing or misordered ${name}`);pos=next;}
assert(html.includes('e.hp=Math.max(0,e.hp-damage)'),'Defeated enemy health must remain saveable');
assert(html.includes('naturalFollowTarget(c,index)'));
assert(html.includes('drawOrganicClearing(270,220,450,180)'));
const hud=fs.readFileSync('app/src/main/assets/compact-hud.js','utf8');
for(const control of ['hudDetailsToggle','aria-expanded','aria-controls','details.hidden=!expanded','setExpanded(false);sync()'])assert(hud.includes(control),`HUD missing ${control}`);
assert(!/localStorage|Android\./.test(hud),'HUD must not alter native/save bindings');
assert(fs.statSync('app/src/main/assets/art/atlas-painted-v1.png').size>1000000);
console.log('PASS: current browser presentation integrated with native save/bridge and load order preserved (static)');

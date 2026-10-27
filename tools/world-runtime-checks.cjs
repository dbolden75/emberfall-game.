const fs=require('fs');
const harness=fs.readFileSync('tools/runtime-integration-checks.cjs','utf8');
const extra=String.raw`
vm.runInContext(\`let checked=0; for(const classId of Object.keys(classDefs)){player.class=classId;player.name='WorldCheck';for(const id of Object.keys(maps)){const p=maps[id].arrival||[480,315];if(!setMap(id,p[0],p[1],false))throw Error('Cannot enter '+id);if(enemies[0])enemies[0].recoveryTime=.5;frame(last+16);const saved=snapshotGameState();if(saved.mapId!==id)throw Error('Wrong save region '+id);checked++;}}console.log('PASS: '+checked+' class/region entry, frame and snapshot combinations (mocked graphics).');\`,root);
if(runtimeErrors.length)throw Error(runtimeErrors.join('\n'));
`;
new Function('require',harness+extra.replaceAll('\\`','`'))(require);

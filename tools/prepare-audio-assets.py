#!/usr/bin/env python3
"""Reproduce licensed audio from the verified source bundle (no downloads)."""
import argparse,hashlib,json,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];out=root/'app/src/main/assets/audio';out.mkdir(exist_ok=True)
source_manifest=json.loads((a.source/'manifest.json').read_text()); records=[];catalog={}
rows=[
 ('town','town.mp3','town',.8,'atrim=start=0:end=97.48,asetpts=PTS-STARTPTS,loudnorm=I=-22:TP=-3:LRA=11'),
 ('exploration','the_field_of_dreams.mp3','exploration',.8,'atrim=start=0.86:end=83.39,asetpts=PTS-STARTPTS,loudnorm=I=-22:TP=-3:LRA=11'),
 ('combat','Battle.mp3','battle',.85,'atrim=start=0:end=113.72,asetpts=PTS-STARTPTS,loudnorm=I=-22:TP=-3:LRA=11'),
 ('forest','Forest_Ambience.mp3','outdoor ambience',.6,'volume=20dB,alimiter=limit=0.7:level=false'),
 ('tomb','Forgoten_tombs_1.mp3','dungeon ambience',.5,'loudnorm=I=-28:TP=-6:LRA=11')]
fx={'step':('kenney/OGG/footstep00.ogg',.3),'attack':('rubberduck/blade_01.ogg',.65),'hit':('rubberduck/creature_hurt_01.ogg',.55),'quest':('rubberduck/item_gem_01.ogg',.6),'level':('rubberduck/spell_02.ogg',.65),'menu':('kenney/OGG/bookOpen.ogg',.45),'spell':('rubberduck/spell_fire_01.ogg',.6),'heal':('rubberduck/spell_01.ogg',.55),'loot':('rubberduck/item_coins_01.ogg',.6),'mining':('rubberduck/stones_01.ogg',.55),'woodcutting':('kenney/OGG/chop.ogg',.6),'fishing':('rubberduck/item_coins_02.ogg',.45)}
rows += [(k,f,k,g,'loudnorm=I=-20:TP=-3:LRA=7') for k,(f,g) in fx.items()]
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
for cue,file,role,gain,filter in rows:
 src=a.source/file;dst=out/(cue+'.ogg');music=cue in ['town','exploration','combat','forest','tomb']
 orig=next((x for x in source_manifest['assets'] if x['file']==file),None)
 if not orig:orig=next(x for x in source_manifest['assets'] if x['file']==('kenney-rpg.zip' if file.startswith('kenney/') else 'rubberduck.zip'))
 if '/' not in file:assert sha(src)==orig['sha256'],file
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(src),'-af',filter,'-ar','44100','-ac',str(2 if music else 1),'-c:a','libvorbis','-q:a','3',str(dst)]
 subprocess.run(cmd,check=True)
 postprocessing=None
 if cue=='fishing':
  intermediate_sha=sha(dst);tmp=dst.with_suffix('.headroom.ogg')
  postargs=['-hide_banner','-loglevel','error','-y','-i',str(dst),'-af','volume=-3dB','-c:a','libvorbis','-q:a','3',str(tmp)]
  subprocess.run(['ffmpeg']+postargs,check=True);tmp.replace(dst)
  postprocessing={'reason':'Native-rate decoded peak 1.027382 exceeded full scale; add 3 dB headroom.','input_sha256':intermediate_sha,'arguments':postargs[:5]+['PREVIOUS_OUTPUT']+postargs[6:-1]+['OUTPUT']}
 subprocess.run(['ffmpeg','-v','error','-i',str(dst),'-f','null','-'],check=True)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(dst)]))
 records.append(dict(path=str(dst.relative_to(root)),cue=cue,author=orig['author'],title=orig['title'],source_url=orig['source'],download_url=orig['download'],license='CC0-1.0',license_url=source_manifest['license_url'],source_member=file,source_sha256=sha(src),original_download_sha256=orig['sha256'],transformation=[x.replace(str(a.source),'SOURCE_BUNDLE') for x in cmd[1:-1]]+['OUTPUT'],sha256=sha(dst),bytes=dst.stat().st_size,duration=float(info['format']['duration'])))
 if postprocessing:records[-1]['postprocessing']=postprocessing
 catalog[cue]={'src':'audio/'+dst.name,'gain':gain}
catalog['dungeon']={'src':'audio/combat.ogg','gain':.35}
(root/'app/src/main/assets/audio-catalog.js').write_text('/* Verified CC0 media; provenance: art-licenses/audio/provenance.json. */\nwindow.ThornhavenAudioCatalog=Object.freeze('+json.dumps(catalog,indent=2)+');\n')
licenses=root/'art-licenses/audio';licenses.mkdir(parents=True,exist_ok=True)
(licenses/'provenance.json').write_text(json.dumps({'date':'2026-11-18','audition':'Not subjectively auditioned; physical Android listening remains required. Dungeon uses a lower-level battle score; fishing uses a loot reward cue, not a water recording.','assets':records},indent=2)+'\n')
pins=root/'source-payload/audio-sha256.json';d=json.loads(pins.read_text());d['app/src/main/assets/audio-catalog.js']=sha(root/'app/src/main/assets/audio-catalog.js')
for r in records:d[r['path']]=r['sha256']
pins.write_text(json.dumps(d,indent=2)+'\n')
print('Prepared',len(records),'files,',sum(r['bytes'] for r in records),'bytes')

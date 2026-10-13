import os, pathlib, subprocess, json, time, shutil, concurrent.futures, re, threading, signal
root=pathlib.Path('thornhaven').resolve()
out=pathlib.Path('qa-results').resolve();out.mkdir(exist_ok=True)
# Helpers, historical-version checks and superseded suites are not current release tests.
excluded={'qa-runtime','browser-preload','capture-construction','crown-rate','crown-rate-outskirts','placement-audit','release110-offline','pet-movement-1.0.5','town-layout-1.0.6','expanded-world','current-expanded-world','normal-playthrough','release-polish','workforce','politics'}
tests=[(p.stem,h) for p in sorted((root/'qa').glob('*.cjs')) if p.stem not in excluded for h in (['warrior','rogue','mage','cleric'] if p.stem=='class-playthrough' else [''])]
selected=os.environ.get('THORNHAVEN_QA_SUITES','')
if selected:tests=[t for t in tests if t[0] in selected.split(',')]
browser=subprocess.check_output(['node','-e',"process.stdout.write(require('playwright').chromium.executablePath())"],text=True).strip()
env=dict(os.environ,NODE_PATH=str(pathlib.Path('node_modules').resolve()),CODEX_PRIMARY_RUNTIME_NODE_MODULES=str(pathlib.Path('node_modules').resolve()),THORNHAVEN_QA_BROWSER=browser)
locks={}
for p in (root/"qa").glob("*.cjs"):
 for port in re.findall(r"listen\((\d+)",p.read_text()):locks.setdefault(port,threading.Lock())
def run(item):
 name,hero=item;label=name+('-'+hero if hero else '')
 work=pathlib.Path('qa-work')/label
 if work.exists():shutil.rmtree(work)
 work.mkdir(parents=True,exist_ok=True)
 shutil.copytree(root/'app',work/'app',copy_function=os.link,dirs_exist_ok=True)
 shutil.copytree(root/'qa',work/'qa',dirs_exist_ok=True)
 (work/'qa/full-captures').mkdir(exist_ok=True)
 for p in (work/'qa').glob('*.cjs'):
  text=p.read_text().replace('/workspace/scratch/0c854075bf3d/vampire-review.png',str(out/(label+'-vampire.png')))
  p.write_text(text)
 port_locks=[locks[p] for p in sorted(set(re.findall(r"listen\((\d+)",(work/("qa/"+name+".cjs")).read_text())))]
 for lock in port_locks:lock.acquire()
 start=time.time()
 with (out/(label+'.log')).open('w') as log:
  try:
   proc=subprocess.Popen(['node','-r',str((work/'qa/browser-preload.cjs').resolve()),'qa/'+name+'.cjs'],cwd=work,env=dict(env,HERO=hero),stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   code=proc.wait(timeout=240)
  except subprocess.TimeoutExpired:
   os.killpg(proc.pid,signal.SIGKILL);proc.wait();code=124
 for lock in port_locks:lock.release()
 row=dict(suite=label,exit=code,seconds=round(time.time()-start,1))
 for p in (work/'qa').glob('*results.json'):shutil.copy2(p,out/(label+'-'+p.name))
 print(json.dumps(row),flush=True);return row
# Shared fixed ports are serialized; independent suites use isolated folders.
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for result in pool.map(run,tests):
  results.append(result);(out/'summary.json').write_text(json.dumps(results,indent=2))
(out/'scope.json').write_text(json.dumps({'excluded_helpers_historical_or_superseded':sorted(excluded),'missing_historical_baselines':['1.0.20','1.0.24'],'physical_device_tested':False},indent=2))
raise SystemExit(any(r['exit'] for r in results))

#!/usr/bin/env python3
"""One entry point: source checks, browser smoke, Android lint, signed build."""
import argparse,os,subprocess,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];os.chdir(root)
p=argparse.ArgumentParser()
p.add_argument('--sdk',default=os.environ.get('ANDROID_HOME','/tmp/thornhaven-sdk'))
p.add_argument('--java-home',default=os.environ.get('JAVA_HOME','/tmp/thornhaven-jdk'))
p.add_argument('--browser',default=os.environ.get('THORNHAVEN_BROWSER','/tmp/thornhaven-browser/chrome-linux64/chrome'))
p.add_argument('--signing-dir',type=Path)
p.add_argument('--gradle',default='/tmp/thornhaven-tools/gradle-8.11.1/bin/gradle' if Path('/tmp/thornhaven-tools/gradle-8.11.1/bin/gradle').exists() else './gradlew')
p.add_argument('--checks-only',action='store_true')
p.add_argument('--skip-browser',action='store_true',help='Explicitly record browser testing as skipped')
a=p.parse_args();os.environ.update(ANDROID_HOME=a.sdk,JAVA_HOME=a.java_home,THORNHAVEN_BROWSER=a.browser)
os.environ['PATH']=a.java_home+'/bin:'+os.environ['PATH']
if os.environ.get('CODEX_PRIMARY_RUNTIME_NODE_MODULES'): os.environ['NODE_PATH']=os.environ['CODEX_PRIMARY_RUNTIME_NODE_MODULES']
(root/'reports').mkdir(exist_ok=True)
report={'steps':[],'status':'running','device_test':'Not performed'}
def run(name,args):
 with (root/'reports'/f'{name}.log').open('w') as f:
  r=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT)
 report['steps'].append({'name':name,'status':'passed' if r.returncode==0 else 'failed'})
 if r.returncode: raise RuntimeError(name+' failed; see reports/'+name+'.log')
try:
 run('source',['python3','tools/verify.py'])
 run('gameplay',['node','tools/gameplay-checks.cjs'])
 run('render',['node','tools/render-checks.cjs'])
 run('town-progress',['node','tools/town-progress-checks.cjs'])
 if a.skip_browser: report['steps'].append({'name':'browser','status':'skipped'})
 else:
  try: run('browser',['node','tools/browser-smoke.cjs'])
  except RuntimeError:
   log=Path('reports/browser.log').read_text()
   if 'socket() failed: Operation not permitted' not in log: raise
   report['steps'][-1]['status']='unavailable'
   report['steps'][-1]['reason']='Host prohibits browser socket; source and gameplay tests used instead'
   print('Browser unavailable on this host; continuing with source, gameplay, Android and signing checks.')
 if not a.checks_only:
  if not a.signing_dir: raise RuntimeError('--signing-dir is required; never generate a replacement key')
  run('android-lint',[a.gradle,'--offline','--no-daemon','lintRelease'])
  import re
  version=re.search(r"versionName '([^']+)'",Path('app/build.gradle').read_text())[1]
  Path('dist').mkdir(exist_ok=True);output=Path('dist')/f'Thornhaven-{version}.apk'
  run('signed-build',['python3','build-signed-release.py','--gradle',a.gradle,'--sdk',a.sdk,'--signing-properties',str(a.signing_dir.resolve()/'signing.properties'),'--keystore',str(a.signing_dir.resolve()/'vaelbrink-maintained.jks'),'--output',str(output)])
  report['apk_sha256']=hashlib.sha256(output.read_bytes()).hexdigest()
 report['status']='passed-with-test-gaps' if any(x['status'] in ('skipped','unavailable') for x in report['steps']) else 'passed'
except Exception as e:
 report['status']='failed';report['error']=str(e);raise
finally:
 Path('reports/build-test.json').write_text(json.dumps(report,indent=2))

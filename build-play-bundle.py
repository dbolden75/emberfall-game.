#!/usr/bin/env python3
"""Clean-build a Play bundle and sign with the maintained private key."""
import argparse, hashlib, os, pathlib, re, shutil, subprocess, urllib.parse, zipfile
p=argparse.ArgumentParser()
p.add_argument('--sdk',required=True);p.add_argument('--jdk',required=True)
p.add_argument('--gradle',required=True);p.add_argument('--signing-dir',required=True)
p.add_argument('--offline',action='store_true');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parent
env=os.environ.copy();env.update(ANDROID_HOME=a.sdk,JAVA_HOME=a.jdk)
args=[a.gradle,'--no-daemon']
if a.offline:args.append('--offline')
else:
 proxy=urllib.parse.urlparse(env.get('HTTPS_PROXY',''))
 if proxy.hostname:
  for scheme in ('http','https'):args += [f'-D{scheme}.proxyHost={proxy.hostname}',f'-D{scheme}.proxyPort={proxy.port}']
 if pathlib.Path('/etc/ssl/certs/java/cacerts').exists():args.append('-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts')
subprocess.run(args+['clean',':app:bundleRelease'],cwd=root,env=env,check=True)
keydir=pathlib.Path(a.signing_dir);props=dict(l.strip().split('=',1) for l in (keydir/'signing.properties').read_text().splitlines() if '=' in l and not l.startswith('#'))
env['THORNHAVEN_STORE_PASS']=props['storePassword'];env['THORNHAVEN_KEY_PASS']=props['keyPassword']
jdk=pathlib.Path(a.jdk)/'bin';ks=keydir/'vaelbrink-maintained.jks'
cert=subprocess.run([str(jdk/'keytool'),'-exportcert','-keystore',str(ks),'-alias',props['keyAlias'],'-storepass:env','THORNHAVEN_STORE_PASS'],env=env,capture_output=True,check=True).stdout
assert hashlib.sha256(cert).hexdigest()=='38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22','Wrong signing certificate'
version=re.search(r"versionName '([^']+)'",(root/'app/build.gradle').read_text()).group(1)
out=root/'dist'/f'Thornhaven-{version}.aab';out.parent.mkdir(exist_ok=True)
shutil.copy2(root/'app/build/outputs/bundle/release/app-release.aab',out)
subprocess.run([str(jdk/'jarsigner'),'-keystore',str(ks),'-storepass:env','THORNHAVEN_STORE_PASS','-keypass:env','THORNHAVEN_KEY_PASS',str(out),props['keyAlias']],env=env,capture_output=True,check=True)
v=subprocess.run([str(jdk/'jarsigner'),'-verify',str(out)],capture_output=True,text=True,check=True)
assert 'jar verified' in v.stdout
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 for f in (root/'app/src/main/assets').rglob('*'):
  if f.is_file():assert z.read('base/assets/'+str(f.relative_to(root/'app/src/main/assets')))==f.read_bytes()
print('Verified maintained signing certificate and all bundled assets:',out)

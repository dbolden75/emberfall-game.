#!/usr/bin/env python3
"""Build and sign using the separately stored, maintained Thornhaven key."""
import argparse
import os
from pathlib import Path
import subprocess

EXPECTED_CERT = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
p = argparse.ArgumentParser()
p.add_argument('--signing-properties', required=True, type=Path)
p.add_argument('--keystore', required=True, type=Path)
p.add_argument('--sdk', required=True, type=Path)
p.add_argument('--gradle', default='./gradlew')
p.add_argument('--skip-build', action='store_true')
p.add_argument('--output', type=Path, default=Path('Thornhaven-1.0.45.apk'))
a = p.parse_args()
props = dict(line.strip().split('=', 1) for line in a.signing_properties.read_text().splitlines()
             if '=' in line and not line.lstrip().startswith('#'))
env = os.environ.copy()
env['ANDROID_HOME'] = str(a.sdk.resolve())
env['THORNHAVEN_STORE_PASS'] = props['storePassword']
env['THORNHAVEN_KEY_PASS'] = props['keyPassword']
bt = a.sdk / 'build-tools' / '35.0.0'
def run(args, **kw):
    return subprocess.run([str(x) for x in args], env=env, check=True, **kw)
if not a.skip_build:
    run([a.gradle, '--offline', '--no-daemon', 'clean', 'assembleRelease'])
unsigned = Path('app/build/outputs/apk/release/app-release-unsigned.apk')
aligned = unsigned.with_name('app-release-aligned.apk')
run([bt/'zipalign', '-f', '-p', '4', unsigned, aligned])
run([bt/'apksigner', 'sign', '--ks', a.keystore, '--ks-key-alias', props['keyAlias'],
     '--ks-pass', 'env:THORNHAVEN_STORE_PASS', '--key-pass', 'env:THORNHAVEN_KEY_PASS',
     '--out', a.output, aligned])
v = run([bt/'apksigner', 'verify', '--verbose', '--print-certs', a.output], capture_output=True, text=True)
certs = [line.split(': ', 1)[1] for line in v.stdout.splitlines() if 'certificate SHA-256 digest:' in line]
if certs != [EXPECTED_CERT]:
    a.output.unlink(missing_ok=True)
    raise SystemExit('Signing certificate mismatch; output removed.')
print('Verified maintained signing certificate:', EXPECTED_CERT)
print('Signed APK:', a.output.resolve())

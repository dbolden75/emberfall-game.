#!/usr/bin/env python3
"""Exercise maintained-key APK signing safety with fake tools, never private credentials."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CERT = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
ZIPALIGN = """#!/usr/bin/env python3
import shutil, sys
a = sys.argv[1:]
assert '-P' in a and a[a.index('-P')+1] == '16', a
if '-c' not in a:
    shutil.copyfile(a[-2], a[-1])
"""
AAPT = """#!/usr/bin/env python3
import os, sys
assert sys.argv[1:3] == ['dump', 'badging'], sys.argv
pkg = 'com.vaelbrink.ashvale.newjourney'
if os.environ.get('FAKE_BAD_PACKAGE') == '1' or (os.environ.get('FAKE_BAD_SIGNED') == '1' and '.pending-' in os.path.basename(sys.argv[-1])):
    pkg = 'com.bad.stale'
code = '168' if os.environ.get('FAKE_BAD_CODE') == '1' else '169'
name = '1.0.66' if os.environ.get('FAKE_BAD_VERSION') == '1' else '1.0.67'
print("package: name='%s' versionCode='%s' versionName='%s' platformBuildVersionName=''" % (pkg, code, name))
"""
APKSIGNER = """#!/usr/bin/env python3
import os, shutil, sys
a = sys.argv[1:]
if a[0] == 'sign':
    assert '--v2-signing-enabled' in a and '--v3-signing-enabled' in a, a
    shutil.copyfile(a[-1], a[a.index('--out')+1])
else:
    assert a[0] == 'verify' and '--verbose' in a and '--print-certs' in a, a
    print('Signer #1 certificate SHA-256 digest: ' + os.environ.get('FAKE_CERT', '""" + CERT + """'))
    print('Verified using v2 scheme (APK Signature Scheme v2): true')
    if os.environ.get('FAKE_NO_V3') != '1':
        print('Verified using v3 scheme (APK Signature Scheme v3): true')
"""


def main():
    with tempfile.TemporaryDirectory(prefix='thornhaven-offline-signing-') as directory:
        work = Path(directory)
        apk = work / 'app/build/outputs/apk/release/app-release-unsigned.apk'
        apk.parent.mkdir(parents=True)
        apk.write_bytes(b'fake unsigned APK, NEVER DISTRIBUTE')
        gradle = work / 'app/build.gradle'
        gradle.write_text("defaultConfig {\n applicationId 'com.vaelbrink.ashvale.newjourney'\n versionName '1.0.67'\n versionCode 169\n}")
        (work / 'key.properties').write_text('storePassword=fixture\nkeyPassword=fixture\nkeyAlias=fixture\n')
        (work / 'fake-keystore').write_bytes(b'fake fixture only')
        sdk = work / 'sdk/build-tools/36.0.0'
        sdk.mkdir(parents=True)
        for name, body in [('zipalign', ZIPALIGN), ('apksigner', APKSIGNER), ('aapt', AAPT)]:
            path = sdk / name
            path.write_text(body)
            path.chmod(0o755)
        (work / 'build-signed-release.py').write_bytes((ROOT / 'build-signed-release.py').read_bytes())
        cmd = ['python3', 'build-signed-release.py', '--skip-build',
               '--sdk', str(work / 'sdk'), '--signing-properties', 'key.properties',
               '--keystore', 'fake-keystore']
        signed = work / 'dist/Thornhaven-1.0.67.apk'

        def invoke(overrides=None):
            env = os.environ.copy()
            env.update(overrides or {})
            return subprocess.run(cmd, cwd=work, capture_output=True, text=True, env=env)

        result = invoke()
        assert result.returncode == 0, result.stdout + result.stderr
        assert signed.read_bytes() == apk.read_bytes(), 'mock signed output missing'
        assert not apk.with_name('app-release-aligned.apk').exists(), 'temporary aligned file leaked'
        # Failed retries must preserve an existing verified release artifact.
        previous = b'PREVIOUS VERIFIED RELEASE (mock fixture)'
        signed.write_bytes(previous)
        for overrides, reason in [
            ({'FAKE_NO_V3': '1'}, 'missing v3 accepted'),
            ({'FAKE_CERT': '00' * 32}, 'different certificate accepted'),
            ({'FAKE_BAD_PACKAGE': '1'}, 'stale package accepted'),
            ({'FAKE_BAD_CODE': '1'}, 'stale versionCode accepted'),
            ({'FAKE_BAD_VERSION': '1'}, 'stale versionName accepted'),
            ({'FAKE_BAD_SIGNED': '1'}, 'signed package mismatch accepted'),
        ]:
            result = invoke(overrides)
            assert result.returncode != 0, reason
            assert signed.read_bytes() == previous, 'failure replaced existing signed release'
            assert not list((work / 'dist').glob('*.pending-*.apk')), 'pending release file leaked'
            assert not apk.with_name('app-release-aligned.apk').exists(), 'aligned APK leaked'

        gradle.write_text("defaultConfig {\n applicationId 'com.changed.identity'\n versionName '1.0.67'\n versionCode 169\n}")
        result = invoke()
        assert result.returncode != 0 and 'maintained applicationId changed' in (
            result.stdout + result.stderr), 'changed app identity accepted'
        assert signed.read_bytes() == previous
    print('PASS: SDK36 16KiB, versioned output, embedded APK identity, v2/v3, certificate, atomic signing cleanup')
    print('NOTE: mocked commands only; no APK was cryptographically signed or installed')


if __name__ == '__main__':
    main()

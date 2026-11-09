#!/usr/bin/env python3
"""Mock AAB signing to ensure failed rebuilds cannot destroy a verified release.

No real key, Google Play account, Android device, or install is used.
"""
from pathlib import Path
import hashlib
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FIXTURE = b'public test cert only (not a signing key)'


def executable(path, content):
    path.write_text('#!/usr/bin/env python3\n' + content)
    path.chmod(0o755)


def main():
    with tempfile.TemporaryDirectory(prefix='thornhaven-aab-atomic-') as tmp:
        work = Path(tmp)
        (work / 'app/src/main/assets').mkdir(parents=True)
        (work / 'app/src/main/assets/index.html').write_bytes(b'tested game payload')
        (work / 'app/build.gradle').write_text("applicationId 'com.vaelbrink.ashvale.newjourney'\n"
                                              "versionCode 169\nversionName '1.0.67'\n")
        keydir = work / 'private'
        keydir.mkdir()
        (keydir / 'signing.properties').write_text('storePassword=private\nkeyPassword=private\nkeyAlias=maintained\n')
        (keydir / 'vaelbrink-maintained.jks').write_text('mock; never a real key')
        fake_jdk = work / 'jdk/bin'
        fake_jdk.mkdir(parents=True)
        executable(fake_jdk / 'keytool', 'import sys\nsys.stdout.buffer.write(' + repr(PUBLIC_FIXTURE) + ')\n')
        executable(fake_jdk / 'jarsigner', '''import os, sys, zipfile
from pathlib import Path
args=sys.argv[1:]
if '-verify' in args:
    if os.environ.get('FAKE_BAD_VERIFY') == '1':
        print('jar not verified')
    else:
        print('jar verified.')
else:
    candidate=Path(args[-2])
    if os.environ.get('FAKE_FAIL_SIGN') == '1':
        raise SystemExit(17)
    with zipfile.ZipFile(candidate, 'a') as z:
        z.writestr('META-INF/VAELBRIN.SF', b'mock signing metadata')
''')
        executable(work / 'gradle', '''import os, zipfile
from pathlib import Path
root=Path(__file__).resolve().parent
out=root/'app/build/outputs/bundle/release/app-release.aab'
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w') as z:
    payload=b'damaged game payload' if os.environ.get('FAKE_BAD_ASSET') == '1' else b'tested game payload'
    z.writestr('base/assets/index.html', payload)
''')
        script = (ROOT / 'build-play-bundle.py').read_text()
        script = script.replace(
            '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22',
            hashlib.sha256(PUBLIC_FIXTURE).hexdigest())
        (work / 'build-play-bundle.py').write_text(script)
        cmd = ['python3', 'build-play-bundle.py', '--sdk', 'mock-sdk', '--jdk', str(work / 'jdk'),
               '--gradle', str(work / 'gradle'), '--signing-dir', str(keydir), '--offline']
        output = work / 'dist/Thornhaven-1.0.67.aab'

        def invoke(overrides=None):
            env = os.environ.copy()
            env.update(overrides or {})
            return subprocess.run(cmd, cwd=work, env=env, capture_output=True, text=True)

        good = invoke()
        assert good.returncode == 0, good.stderr
        assert output.is_file() and output.stat().st_size > 0
        print('PASS: correctly signed mock AAB is published')
        previous = output.read_bytes()
        for label, overrides in [
            ('jarsigner failure', {'FAKE_FAIL_SIGN': '1'}),
            ('verification failure', {'FAKE_BAD_VERIFY': '1'}),
            ('bundled game asset mismatch', {'FAKE_BAD_ASSET': '1'}),
        ]:
            failed = invoke(overrides)
            assert failed.returncode != 0, label + ': unexpectedly accepted'
            assert output.read_bytes() == previous, label + ': previous verified release destroyed'
            assert not list((work / 'dist').glob('*.pending-*.aab')), label + ': orphaned temp AAB'
            print('PASS: previous signed AAB preserved on ' + label)
        (work / 'app/build.gradle').write_text("applicationId 'com.wrong.package'\nversionCode 169\nversionName '1.0.67'\n")
        wrong = invoke()
        assert wrong.returncode != 0 and output.read_bytes() == previous
        print('PASS: changed Android application ID blocked')
    print('PASS: five isolated AAB release-safety scenarios; no real signing or Android install')


if __name__ == '__main__':
    main()

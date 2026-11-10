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
        executable(fake_jdk / 'keytool', '''import os, sys, hashlib
if '-printcert' in sys.argv:
    expected = hashlib.sha256(b'public test cert only (not a signing key)').hexdigest()
    actual = os.environ.get('FAKE_AAB_CERT', expected)
    printable = ':'.join(actual[i:i+2] for i in range(0, len(actual), 2))
    if os.environ.get('FAKE_NO_SIGNER') == '1':
        print('Not a signed jar file')
    else:
        print('Signer #1:')
        print('Certificate #1:')
        print(' SHA256: ' + printable)
        if os.environ.get('FAKE_EXTRA_SIGNER') == '1':
            print('Signer #2:')
            print('Certificate #1:')
            print(' SHA256: ' + printable)
else:
    sys.stdout.buffer.write(b'public test cert only (not a signing key)')
''')
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
def varint(value):
    result=bytearray()
    while value >= 128:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return bytes(result)
def field(number, data):
    return varint((number << 3) | 2)+varint(len(data))+data
def text(number, string):
    return field(number, string.encode('utf-8'))
def attribute(name, value, namespace='', code=None):
    parts=text(2, name)+text(3, value)
    if namespace:
        parts=text(1, namespace)+parts
    if code is not None:
        parts+=field(6, field(7, varint((6 << 3) | 0)+varint(code)))
    return field(4, parts)
ns='http://schemas.android.com/apk/res/android'
code=os.environ.get('FAKE_MANIFEST_CODE','169')
manifest=field(1, text(3,'manifest')+
               attribute('package',os.environ.get('FAKE_MANIFEST_PACKAGE','com.vaelbrink.ashvale.newjourney'))+
               attribute('versionCode',code,ns,int(os.environ.get('FAKE_MANIFEST_COMPILED_CODE',code)))+
               attribute('versionName',os.environ.get('FAKE_MANIFEST_VERSION','1.0.67'),ns))
with zipfile.ZipFile(out, 'w') as z:
    if os.environ.get('FAKE_MISSING_MANIFEST') != '1':
        z.writestr('base/manifest/AndroidManifest.xml', manifest)
        if os.environ.get('FAKE_DUPLICATE_MANIFEST') == '1':
            z.writestr('base/manifest/AndroidManifest.xml', manifest)
    payload=b'damaged game payload' if os.environ.get('FAKE_BAD_ASSET') == '1' else b'tested game payload'
    if os.environ.get('FAKE_MISSING_ASSET') != '1':
        z.writestr('base/assets/index.html', payload)
    if os.environ.get('FAKE_EXTRA_ASSET') == '1':
        z.writestr('base/assets/injected.js', b'unapproved game script')
    if os.environ.get('FAKE_DUPLICATE_ASSET') == '1':
        z.writestr('base/assets/index.html', payload)
    if os.environ.get('FAKE_DIFFERENT_VALID_BUNDLE') == '1':
        z.writestr('base/extra-nongame-metadata.txt',b'new build, same version')
''')
        script = (ROOT / 'build-play-bundle.py').read_text()
        script = script.replace(
            '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22',
            hashlib.sha256(PUBLIC_FIXTURE).hexdigest())
        (work / 'build-play-bundle.py').write_text(script)
        (work / 'tools').mkdir()
        (work / 'tools/aab_manifest_identity.py').write_bytes(
            (ROOT / 'tools/aab_manifest_identity.py').read_bytes())
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
        valid_collision = invoke({'FAKE_DIFFERENT_VALID_BUNDLE': '1'})
        assert valid_collision.returncode != 0, 'different valid AAB replaced published release'
        assert output.read_bytes() == previous, 'valid collision replaced signed AAB'
        for label, overrides in [
            ('jarsigner failure', {'FAKE_FAIL_SIGN': '1'}),
            ('verification failure', {'FAKE_BAD_VERIFY': '1'}),
            ('bundled game asset mismatch', {'FAKE_BAD_ASSET': '1'}),
            ('missing game asset', {'FAKE_MISSING_ASSET': '1'}),
            ('unexpected game asset', {'FAKE_EXTRA_ASSET': '1'}),
            ('duplicate game asset', {'FAKE_DUPLICATE_ASSET': '1'}),
            ('signed AAB certificate mismatch', {'FAKE_AAB_CERT': 'ff' * 32}),
            ('AAB contains multiple signers', {'FAKE_EXTRA_SIGNER': '1'}),
            ('AAB contains no signer', {'FAKE_NO_SIGNER': '1'}),
            ('AAB wrong package', {'FAKE_MANIFEST_PACKAGE': 'com.other.package'}),
            ('AAB wrong versionCode', {'FAKE_MANIFEST_CODE': '168'}),
            ('AAB compiled code differs', {'FAKE_MANIFEST_COMPILED_CODE': '168'}),
            ('AAB wrong versionName', {'FAKE_MANIFEST_VERSION': '1.0.66'}),
            ('AAB missing manifest', {'FAKE_MISSING_MANIFEST': '1'}),
            ('AAB duplicate manifest', {'FAKE_DUPLICATE_MANIFEST': '1'}),
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
        # A preexisting symlink must not be treated as a replaceable release.
        output.unlink()
        victim = work / 'victim-do-not-touch.aab'
        victim.write_bytes(b'previous owner's bytes')
        output.symlink_to(victim)
        # Restore valid source identity to reach the publication gate.
        (work / 'app/build.gradle').write_text(
            "applicationId 'com.vaelbrink.ashvale.newjourney'\\nversionCode 169\\nversionName '1.0.67'\\n")
        blocked = invoke()
        assert blocked.returncode != 0, 'symlink output replaced'
        assert output.is_symlink() and victim.read_bytes() == b'previous owner\\'s bytes'
        print('PASS: symlink release output cannot be overwritten')
    print('PASS: eleven isolated AAB release-safety scenarios; no real signing or Android install')


if __name__ == '__main__':
    main()

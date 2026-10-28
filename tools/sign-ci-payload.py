#!/usr/bin/env python3
"""Sign a Thornhaven GitHub Actions *unsigned* release payload offline.

Requires Linux, Java keytool/jarsigner, the CI artifact zip (which contains aapt,
zipalign and apksigner), and the private, maintained signing-key backup ZIP.
Nothing secret should ever be uploaded to GitHub or emitted in logs.

Example:
 python3 tools/sign-ci-payload.py \
   --payload /private/path/thornhaven-unsigned-artifact.zip \
   --backup /private/path/Thornhaven-PRIVATE-Signing-Key-Backup.zip \
   --output /private/path/signed-release
"""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile

EXPECTED_CERT = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
PACKAGE = 'com.vaelbrink.ashvale.newjourney'


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def check_run(args, env, *, capture=False) -> str:
    p = subprocess.run([str(x) for x in args], env=env, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(f'{Path(str(args[0])).name} failed with exit {p.returncode}; tool output withheld to protect signing credentials')
    return p.stdout if capture else ''


def extract_selected(zip_path: Path, folder: Path, names: tuple[str, ...]) -> None:
    with zipfile.ZipFile(zip_path) as z:
        if z.testzip() is not None:
            raise RuntimeError(f'Damaged archive: {zip_path.name}')
        for name in names:
            target = (folder / name).resolve()
            if not target.is_relative_to(folder.resolve()):
                raise RuntimeError('Unsafe archive path')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(name))
            target.chmod(0o700 if name.startswith('tools/') else 0o600)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--payload', type=Path, required=True, help='Downloaded GitHub unsigned-release artifact ZIP')
    parser.add_argument('--backup', type=Path, required=True, help='Private maintained signing-key backup ZIP')
    parser.add_argument('--output', type=Path, required=True, help='Directory for *verified* APK/AAB and report')
    parser.add_argument('--gradle', type=Path, default=Path(__file__).resolve().parents[1] / 'app/build.gradle')
    opts = parser.parse_args()
    gradle = opts.gradle.read_text()
    match_code = re.search(r'\bversionCode\s+(\d+)', gradle)
    match_name = re.search(r"\bversionName\s+'([^']+)'", gradle)
    if not match_code or not match_name:
        raise RuntimeError('Could not read current Android version from app/build.gradle')
    code, version = match_code[1], match_name[1]
    staged_files = (
        'app-release-unsigned.apk', 'app-release.aab',
        'tools/aapt', 'tools/zipalign', 'tools/apksigner',
        'tools/lib/apksigner.jar', 'tools/lib64/libc++.so',
    )
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix='thornhaven-offline-sign-') as temp:
        private = Path(temp)
        private.chmod(0o700)
        extract_selected(opts.payload, private, staged_files)
        extract_selected(opts.backup, private, ('signing.properties', 'vaelbrink-maintained.jks'))
        props = dict(line.strip().split('=', 1) for line in (private / 'signing.properties').read_text().splitlines()
                     if '=' in line and not line.lstrip().startswith('#'))
        for field in ('storePassword', 'keyPassword', 'keyAlias'):
            if not props.get(field):
                raise RuntimeError(f'Private backup missing {field}')
        env = os.environ.copy()
        env['THORNHAVEN_STORE_PASS'] = props['storePassword']
        env['THORNHAVEN_KEY_PASS'] = props['keyPassword']
        key = private / 'vaelbrink-maintained.jks'
        cert = subprocess.run(['keytool', '-exportcert', '-keystore', str(key),
                               '-alias', props['keyAlias'], '-storepass:env', 'THORNHAVEN_STORE_PASS'],
                              env=env, capture_output=True)
        if cert.returncode or hashlib.sha256(cert.stdout).hexdigest() != EXPECTED_CERT:
            raise RuntimeError('Aborting: maintained certificate does not match archived game signing identity')

        aapt, zipalign, signer = (private / 'tools' / item for item in ('aapt', 'zipalign', 'apksigner'))
        aligned = private / 'aligned.apk'
        apk = private / 'signed.apk'
        aab = private / 'app-release.aab'
        unsigned_aab = private / 'pre-sign-original.aab'
        shutil.copy2(aab, unsigned_aab)
        check_run([zipalign, '-f', '-p', '4', private / 'app-release-unsigned.apk', aligned], env)
        check_run([signer, 'sign', '--ks', key, '--ks-key-alias', props['keyAlias'],
                   '--ks-pass', 'env:THORNHAVEN_STORE_PASS', '--key-pass', 'env:THORNHAVEN_KEY_PASS',
                   '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
                   '--out', apk, aligned], env)
        check_run([zipalign, '-c', '-p', '4', apk], env)
        result = check_run([signer, 'verify', '--verbose', '--print-certs', apk], env, capture=True)
        for marker in (EXPECTED_CERT, 'Verified using v2 scheme (APK Signature Scheme v2): true',
                       'Verified using v3 scheme (APK Signature Scheme v3): true'):
            if marker not in result:
                raise RuntimeError('APK signature verification failed')
        badging = check_run([aapt, 'dump', 'badging', apk], env, capture=True)
        if f"package: name='{PACKAGE}' versionCode='{code}' versionName='{version}'" not in badging:
            raise RuntimeError('APK package or version differs from local build.gradle')

        check_run(['jarsigner', '-keystore', key, '-storepass:env', 'THORNHAVEN_STORE_PASS',
                   '-keypass:env', 'THORNHAVEN_KEY_PASS', aab, props['keyAlias']], env)
        verification = check_run(['jarsigner', '-verify', aab], env, capture=True)
        if 'jar verified' not in verification:
            raise RuntimeError('AAB JAR signature verification failed')
        check_run(['python3', Path(__file__).with_name('release-native-parity.py'),
                   '--signed-apk', apk, '--unsigned-apk', private / 'app-release-unsigned.apk',
                   '--signed-aab', aab, '--unsigned-aab', unsigned_aab], env)
        print('PASS: signed APK/AAB native code and all archive contents match original CI payloads')
        with zipfile.ZipFile(apk) as apk_zip, zipfile.ZipFile(aab) as aab_zip:
            if apk_zip.testzip() is not None or aab_zip.testzip() is not None:
                raise RuntimeError('APK or AAB ZIP integrity failed')
            for name in ('index.html', 'playtest-update.js'):
                if apk_zip.read('assets/' + name) != aab_zip.read('base/assets/' + name):
                    raise RuntimeError(f'APK/AAB asset disagreement: {name}')

        opts.output.mkdir(parents=True, exist_ok=True)
        target_apk = opts.output / f'Thornhaven-{version}-maintained-key.apk'
        target_aab = opts.output / f'Thornhaven-{version}-maintained-key.aab'
        shutil.copy2(apk, target_apk)
        shutil.copy2(aab, target_aab)
        sums = '\n'.join(f'{digest(path)}  {path.name}' for path in (target_apk, target_aab)) + '\n'
        (opts.output / 'SHA256SUMS.txt').write_text(sums)
        print(f'PASS: verified maintained-key Thornhaven {version} (versionCode {code}) APK and AAB')
        print('Maintained certificate SHA-256:', EXPECTED_CERT)
        print('Release candidates:', target_apk, target_aab)
        print('SHA-256 checksums:\n' + sums, end='')
        print('NOT VERIFIED: Google Play app-signing compatibility, Play versionCode acceptance, physical-device save preservation.')


if __name__ == '__main__':
    main()

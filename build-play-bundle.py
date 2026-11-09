#!/usr/bin/env python3
"""Clean-build a Play AAB and sign with Thornhaven's separately stored maintained key.

Publication is atomic: an unsuccessful signing or asset check must not replace
an earlier verified AAB. This tool does not establish Google Play acceptance.
"""
import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.parse
import zipfile

EXPECTED_CERT = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk', required=True)
    parser.add_argument('--jdk', required=True)
    parser.add_argument('--gradle', required=True)
    parser.add_argument('--signing-dir', required=True)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()

    gradle_config = (ROOT / 'app/build.gradle').read_text(encoding='utf-8')
    package = re.search(r"(?m)^\s*applicationId\s+'([^']+)'\s*$", gradle_config)
    version = re.search(r"(?m)^\s*versionName\s+'([^']+)'\s*$", gradle_config)
    code = re.search(r'(?m)^\s*versionCode\s+(\d+)\s*$', gradle_config)
    if not package or package.group(1) != 'com.vaelbrink.ashvale.newjourney' or not version or not code:
        raise SystemExit('Refusing AAB: maintained package ID or release version is missing')

    env = os.environ.copy()
    env.update(ANDROID_HOME=args.sdk, JAVA_HOME=args.jdk)
    gradle_args = [args.gradle, '--no-daemon']
    if args.offline:
        gradle_args.append('--offline')
    else:
        proxy = urllib.parse.urlparse(env.get('HTTPS_PROXY', ''))
        if proxy.hostname:
            for scheme in ('http', 'https'):
                gradle_args += [f'-D{scheme}.proxyHost={proxy.hostname}', f'-D{scheme}.proxyPort={proxy.port}']
        if Path('/etc/ssl/certs/java/cacerts').exists():
            gradle_args.append('-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts')
    subprocess.run(gradle_args + ['clean', ':app:bundleRelease'], cwd=ROOT, env=env, check=True)

    keydir = Path(args.signing_dir)
    props = dict(line.strip().split('=', 1) for line in (keydir / 'signing.properties').read_text().splitlines()
                 if '=' in line and not line.lstrip().startswith('#'))
    env['THORNHAVEN_STORE_PASS'] = props['storePassword']
    env['THORNHAVEN_KEY_PASS'] = props['keyPassword']
    jdk = Path(args.jdk) / 'bin'
    keystore = keydir / 'vaelbrink-maintained.jks'
    cert = subprocess.run([jdk / 'keytool', '-exportcert', '-keystore', keystore,
                           '-alias', props['keyAlias'], '-storepass:env', 'THORNHAVEN_STORE_PASS'],
                          env=env, capture_output=True, check=True).stdout
    if hashlib.sha256(cert).hexdigest() != EXPECTED_CERT:
        raise RuntimeError('Refusing AAB: maintained signing certificate mismatch')

    unsigned = ROOT / 'app/build/outputs/bundle/release/app-release.aab'
    if not unsigned.is_file():
        raise RuntimeError(f'Clean-built release AAB missing: {unsigned}')
    output = ROOT / 'dist' / f'Thornhaven-{version.group(1)}.aab'
    output.parent.mkdir(parents=True, exist_ok=True)

    # Sign an isolated sibling, never the last verified public artifact.
    fd, pending_path = tempfile.mkstemp(prefix=f'.{output.name}.pending-', suffix='.aab', dir=output.parent)
    os.close(fd)
    pending = Path(pending_path)
    try:
        shutil.copy2(unsigned, pending)
        subprocess.run([jdk / 'jarsigner', '-keystore', keystore,
                        '-storepass:env', 'THORNHAVEN_STORE_PASS',
                        '-keypass:env', 'THORNHAVEN_KEY_PASS', pending, props['keyAlias']],
                       env=env, capture_output=True, check=True)
        verified = subprocess.run([jdk / 'jarsigner', '-verify', pending],
                                  capture_output=True, text=True, check=True)
        if 'jar verified' not in verified.stdout:
            raise RuntimeError('Signed AAB failed jarsigner verification')
        with zipfile.ZipFile(pending) as archive:
            bad_entry = archive.testzip()
            if bad_entry is not None:
                raise RuntimeError(f'Signed AAB has a corrupt ZIP member: {bad_entry}')
            for asset in (ROOT / 'app/src/main/assets').rglob('*'):
                if asset.is_file():
                    path = 'base/assets/' + str(asset.relative_to(ROOT / 'app/src/main/assets'))
                    if archive.read(path) != asset.read_bytes():
                        raise RuntimeError(f'Signed AAB differs from source asset: {path}')
        os.replace(pending, output)
    finally:
        pending.unlink(missing_ok=True)
    print('Verified maintained signing certificate and all bundled assets:', output)
    print('NOTE: Google Play acceptance and device installation are not verified')


if __name__ == '__main__':
    main()

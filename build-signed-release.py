#!/usr/bin/env python3
"""Build and sign an APK using Thornhaven's separately stored maintained key.

This helper never generates signing credentials or establishes Play acceptance.
It requires Android SDK build-tools 36.0.0 and preserves the maintained app ID.
"""
import argparse
import os
from pathlib import Path
import re
import subprocess

EXPECTED_CERT = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
ROOT = Path(__file__).resolve().parent


def run(args, env, **kwargs):
    return subprocess.run([str(item) for item in args], env=env, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--signing-properties', required=True, type=Path)
    parser.add_argument('--keystore', required=True, type=Path)
    parser.add_argument('--sdk', required=True, type=Path)
    parser.add_argument('--gradle', default='./gradlew')
    parser.add_argument('--skip-build', action='store_true')
    parser.add_argument('--output', type=Path, help='Defaults to dist/Thornhaven-<current-version>.apk')
    args = parser.parse_args()

    gradle_config = (ROOT / 'app/build.gradle').read_text(encoding='utf-8')
    version = re.search(r"(?m)^\s*versionName\s+'([^']+)'\s*$", gradle_config)
    package = re.search(r"(?m)^\s*applicationId\s+'([^']+)'\s*$", gradle_config)
    if not version or not package or package.group(1) != 'com.vaelbrink.ashvale.newjourney':
        raise SystemExit('Refusing release: missing version or maintained applicationId changed')
    output = args.output or Path('dist') / f'Thornhaven-{version.group(1)}.apk'

    props = dict(line.strip().split('=', 1) for line in args.signing_properties.read_text().splitlines()
                 if '=' in line and not line.lstrip().startswith('#'))
    env = os.environ.copy()
    env['ANDROID_HOME'] = str(args.sdk.resolve())
    env['THORNHAVEN_STORE_PASS'] = props['storePassword']
    env['THORNHAVEN_KEY_PASS'] = props['keyPassword']
    build_tools = args.sdk / 'build-tools' / '36.0.0'
    zipalign, apksigner = build_tools / 'zipalign', build_tools / 'apksigner'
    if not zipalign.is_file() or not apksigner.is_file():
        raise SystemExit('Android SDK build-tools 36.0.0 zipalign/apksigner unavailable')
    if not args.skip_build:
        run([args.gradle, '--offline', '--no-daemon', 'clean', 'assembleRelease'], env)
    unsigned = Path('app/build/outputs/apk/release/app-release-unsigned.apk')
    if not unsigned.is_file():
        raise SystemExit(f'Expected release APK missing: {unsigned}')
    output.parent.mkdir(parents=True, exist_ok=True)
    aligned = unsigned.with_name('app-release-aligned.apk')
    verified = False
    try:
        run([zipalign, '-P', '16', '-f', '4', unsigned, aligned], env)
        run([apksigner, 'sign', '--ks', args.keystore, '--ks-key-alias', props['keyAlias'],
             '--ks-pass', 'env:THORNHAVEN_STORE_PASS', '--key-pass', 'env:THORNHAVEN_KEY_PASS',
             '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
             '--out', output, aligned], env)
        run([zipalign, '-c', '-P', '16', '4', output], env)
        details = run([apksigner, 'verify', '--verbose', '--print-certs', output], env,
                      capture_output=True, text=True).stdout
        certs = [line.split(': ', 1)[1].strip().lower() for line in details.splitlines()
                 if 'certificate SHA-256 digest:' in line]
        if certs != [EXPECTED_CERT]:
            raise RuntimeError('Signing certificate mismatch')
        for scheme in ('v2', 'v3'):
            if f'Verified using {scheme} scheme (APK Signature Scheme {scheme}): true' not in details:
                raise RuntimeError(f'APK {scheme} signature not verified')
        verified = True
    finally:
        aligned.unlink(missing_ok=True)
        if not verified:
            output.unlink(missing_ok=True)
    print('Verified original signing certificate:', EXPECTED_CERT)
    print('Verified APK v2/v3 signatures and 16 KiB alignment')
    print('Signed APK:', output.resolve())


if __name__ == '__main__':
    main()

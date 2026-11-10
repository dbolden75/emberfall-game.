#!/usr/bin/env python3
"""Build and sign an APK using Thornhaven's separately stored maintained key.

This helper never generates signing credentials or establishes Play acceptance.
It requires Android SDK build-tools 36.0.0 and preserves the maintained app ID.
"""
import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile
from collections import Counter

EXPECTED_CERT = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
ROOT = Path(__file__).resolve().parent


def embedded_identity(apk, aapt, env):
    """Read the built APK rather than assuming it matches the Gradle project."""
    badging = run([aapt, 'dump', 'badging', apk], env, capture_output=True, text=True).stdout
    match = re.search(r"(?m)^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'(?:\s|$)", badging)
    if not match:
        raise RuntimeError(f'Cannot read package, versionCode and versionName from {apk}')
    return match.groups()


def run(args, env, **kwargs):
    return subprocess.run([str(item) for item in args], env=env, check=True, **kwargs)



def verify_game_assets(apk):
    """Fail closed if a package has stale, missing, corrupt, or duplicate game assets."""
    source_root = ROOT / 'app/src/main/assets'
    source_assets = {'assets/' + p.relative_to(source_root).as_posix(): p
                     for p in source_root.rglob('*') if p.is_file()}
    if not source_assets:
        raise RuntimeError('Release source assets directory is missing or empty')
    with zipfile.ZipFile(apk) as archive:
        damaged = archive.testzip()
        if damaged is not None:
            raise RuntimeError(f'APK contains corrupt ZIP member: {damaged}')
        counts = Counter(archive.namelist())
        for name, source in source_assets.items():
            if counts[name] != 1:
                raise RuntimeError(f'APK game asset must appear exactly once: {name} (found {counts[name]})')
            if archive.read(name) != source.read_bytes():
                raise RuntimeError(f'APK game asset differs from source: {name}')


def publish_verified_apk(pending, output):
    """Atomically publish a new APK, without replacing a different release.

    The pending APK and destination share a filesystem. os.link either creates
    the complete release name at once or fails if anyone has created it.
    """
    try:
        os.link(pending, output)
    except FileExistsError:
        if output.is_symlink() or not output.is_file():
            raise RuntimeError('Refusing to replace an existing non-file APK release')
        if pending.stat().st_size != output.stat().st_size:
            raise RuntimeError('Existing APK release differs; use a new output path')
        with pending.open('rb') as fresh, output.open('rb') as existing:
            if hashlib.file_digest(fresh, 'sha256').digest() != hashlib.file_digest(existing, 'sha256').digest():
                raise RuntimeError('Existing APK release differs; use a new output path')


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
    code = re.search(r'(?m)^\s*versionCode\s+(\d+)\s*$', gradle_config)
    if not version or not code or not package or package.group(1) != 'com.vaelbrink.ashvale.newjourney':
        raise SystemExit('Refusing release: missing version or maintained applicationId changed')
    output = args.output or Path('dist') / f'Thornhaven-{version.group(1)}.apk'

    props = dict(line.strip().split('=', 1) for line in args.signing_properties.read_text().splitlines()
                 if '=' in line and not line.lstrip().startswith('#'))
    env = os.environ.copy()
    env['ANDROID_HOME'] = str(args.sdk.resolve())
    env['THORNHAVEN_STORE_PASS'] = props['storePassword']
    env['THORNHAVEN_KEY_PASS'] = props['keyPassword']
    build_tools = args.sdk / 'build-tools' / '36.0.0'
    zipalign, apksigner, aapt = (build_tools / tool for tool in ('zipalign', 'apksigner', 'aapt'))
    if not all(tool.is_file() for tool in (zipalign, apksigner, aapt)):
        raise SystemExit('Android SDK build-tools 36.0.0 zipalign/apksigner/aapt unavailable')
    if not args.skip_build:
        run([args.gradle, '--offline', '--no-daemon', 'clean', 'assembleRelease'], env)
    unsigned = Path('app/build/outputs/apk/release/app-release-unsigned.apk')
    if not unsigned.is_file():
        raise SystemExit(f'Expected release APK missing: {unsigned}')
    # --skip-build must not sign a stale APK from another package or version.
    expected = (package.group(1), code.group(1), version.group(1))
    if embedded_identity(unsigned, aapt, env) != expected:
        raise RuntimeError(f'Unsigned APK identity does not match Gradle release {expected}')
    verify_game_assets(unsigned)

    output.parent.mkdir(parents=True, exist_ok=True)
    aligned = unsigned.with_name('app-release-aligned.apk')
    # Publish only once all checks pass; preserve the last verified release.
    fd, pending_name = tempfile.mkstemp(prefix=f'.{output.name}.pending-', suffix='.apk',
                                       dir=output.parent)
    os.close(fd)
    pending = Path(pending_name)
    pending.unlink()
    try:
        run([zipalign, '-P', '16', '-f', '4', unsigned, aligned], env)
        run([apksigner, 'sign', '--ks', args.keystore, '--ks-key-alias', props['keyAlias'],
             '--ks-pass', 'env:THORNHAVEN_STORE_PASS', '--key-pass', 'env:THORNHAVEN_KEY_PASS',
             '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
             '--out', pending, aligned], env)
        run([zipalign, '-c', '-P', '16', '4', pending], env)
        details = run([apksigner, 'verify', '--verbose', '--print-certs', pending], env,
                      capture_output=True, text=True).stdout
        certs = [line.split(': ', 1)[1].strip().lower() for line in details.splitlines()
                 if 'certificate SHA-256 digest:' in line]
        if certs != [EXPECTED_CERT]:
            raise RuntimeError('Signing certificate mismatch')
        for scheme in ('v2', 'v3'):
            if f'Verified using {scheme} scheme (APK Signature Scheme {scheme}): true' not in details:
                raise RuntimeError(f'APK {scheme} signature not verified')
        if embedded_identity(pending, aapt, env) != expected:
            raise RuntimeError(f'Signed APK identity does not match Gradle release {expected}')
        verify_game_assets(pending)
        publish_verified_apk(pending, output)
    finally:
        aligned.unlink(missing_ok=True)
        pending.unlink(missing_ok=True)
    print('Verified original signing certificate:', EXPECTED_CERT)
    print('Verified APK v2/v3 signatures, 16 KiB alignment and source game assets')
    print('Signed APK:', output.resolve())


if __name__ == '__main__':
    main()

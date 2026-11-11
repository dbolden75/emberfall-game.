#!/usr/bin/env python3
"""Read-only Android upgrade compatibility preflight.

Checks the actual installed package against a candidate APK using Android SDK
`aapt`, `apksigner` and `adb`. Never installs, uninstalls or clears app data.
For Play App Signing installations, use a Play-delivered upgrade if the device's
installed signer is different from the app's private upload-key signer.
"""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

PACKAGE = 'com.vaelbrink.ashvale.newjourney'
EXPECTED_RELEASE_SIGNER = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'


class PreflightError(Exception):
    pass


def command(args):
    try:
        return subprocess.run(args, text=True, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        error = getattr(exc, 'stderr', None)
        raise PreflightError(f'Could not run {args[0]}: {(error or str(exc)).strip()}') from exc


def parse_badging(output):
    match = re.search(r"^package:\s+name='([^']+)'\s+versionCode='(\d+)'", output, re.M)
    if not match:
        raise PreflightError('Could not identify APK package/version using aapt')
    return match.group(1), int(match.group(2))


def parse_certificates(output):
    matches = re.findall(r'^Signer #\d+ certificate SHA-256 digest:\s*([0-9a-fA-F]{64})\s*$',
                         output, re.M)
    if len(matches) != 1:
        raise PreflightError('Expected exactly one identifiable APK signing certificate')
    return matches[0].lower()


def parse_installed_base(output):
    paths = [row[len('package:'):].strip() for row in output.splitlines()
             if row.startswith('package:')]
    bases = [p for p in paths if p.endswith('/base.apk')]
    if len(bases) == 1:
        return bases[0]
    if len(paths) == 1 and paths[0].endswith('.apk'):
        return paths[0]
    raise PreflightError('Could not uniquely locate the installed base APK; no changes made')


def validate_pair(installed_badging, installed_certs, candidate_badging, candidate_certs):
    current_pkg, current_code = parse_badging(installed_badging)
    new_pkg, new_code = parse_badging(candidate_badging)
    if (current_pkg, new_pkg) != (PACKAGE, PACKAGE):
        raise PreflightError('Package identity mismatch; do not install or remove anything')
    current_signer = parse_certificates(installed_certs)
    new_signer = parse_certificates(candidate_certs)
    if new_signer != EXPECTED_RELEASE_SIGNER:
        raise PreflightError('Candidate is not signed by the maintained Thornhaven certificate')
    if current_signer != new_signer:
        raise PreflightError('Installed signer differs from maintained APK. DO NOT uninstall, clear data, or sideload. Use the existing Play track or independently verify a lossless export.')
    if new_code <= current_code:
        raise PreflightError(f'Candidate versionCode {new_code} is not newer than installed {current_code}')
    return current_code, new_code


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path, help='Maintained-signed Thornhaven .apk (not .aab)')
    parser.add_argument('--serial', help='Explicit adb serial, if multiple devices are connected')
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--aapt', default='aapt')
    parser.add_argument('--apksigner', default='apksigner')
    args = parser.parse_args(argv)
    if not args.candidate.is_file() or args.candidate.suffix.lower() != '.apk':
        parser.error('Candidate must be an existing APK file (not an AAB)')
    prefix = [args.adb] + (['-s', args.serial] if args.serial else [])
    try:
        candidate_badging = command([args.aapt, 'dump', 'badging', str(args.candidate)])
        candidate_cert = command([args.apksigner, 'verify', '--print-certs', str(args.candidate)])
        # Reject an incorrect or damaged candidate even if no device is connected.
        new_pkg, _ = parse_badging(candidate_badging)
        if new_pkg != PACKAGE or parse_certificates(candidate_cert) != EXPECTED_RELEASE_SIGNER:
            raise PreflightError('Candidate has incorrect package or signing certificate')
        paths = command(prefix + ['shell', 'pm', 'path', PACKAGE])
        base = parse_installed_base(paths)
        with tempfile.TemporaryDirectory(prefix='thornhaven-readonly-preflight-') as temp:
            copy = str(Path(temp) / 'installed-base.apk')
            command(prefix + ['pull', base, copy])
            current_badging = command([args.aapt, 'dump', 'badging', copy])
            current_cert = command([args.apksigner, 'verify', '--print-certs', copy])
            old_code, new_code = validate_pair(current_badging, current_cert,
                                               candidate_badging, candidate_cert)
        print(f'PASS: installed {PACKAGE} versionCode {old_code}, candidate {new_code}; APK signing identity matches.')
        print('NO UPDATE PERFORMED: This only establishes preliminary sideload compatibility, not installation, Play eligibility, gameplay or character-save integrity.')
        return 0
    except PreflightError as exc:
        print(f'BLOCKED: {exc}', file=sys.stderr)
        print('No app installation, deletion, or on-device data changes were attempted.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

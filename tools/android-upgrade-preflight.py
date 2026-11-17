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

# Verified from the actual historical APKs, not from their similarly named
# release variants. These certificates cannot update to the maintained APK.
HISTORICAL_DEV_SIGNERS = {
    '09ed9284b3e16e0181f7e9b428e5ed882bc66cf325c900212d40baf9dc817099':
        'Thornhaven-1.0.57-dev-test.apk',
    'eba47475cc63815c8d16bbf7819a32dcd3991438e5c2336df2bbe10eb9e423b5':
        'Thornhaven-1.0.57-fixes-dev-test.apk',
}


class PreflightError(Exception):
    pass


def command(args):
    # An offline ADB server or disconnected USB device must not stall upgrade
    # verification indefinitely. APK transfers need more time than metadata.
    timeout_seconds = 240 if 'pull' in args else 60
    try:
        return subprocess.run(args, text=True, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, check=True,
                              timeout=timeout_seconds).stdout
    except subprocess.TimeoutExpired as exc:
        raise PreflightError(
            f'Timed out running {args[0]} after {timeout_seconds}s; '
            'check the Android device connection; no installation or data changes made'
        ) from exc
    except (OSError, subprocess.CalledProcessError) as exc:
        error = getattr(exc, 'stderr', None)
        raise PreflightError(f'Could not run {args[0]}: {(error or str(exc)).strip()}') from exc


def parse_badging(output):
    matches = re.findall(r"^package:\s+name='([^']+)'\s+versionCode='(\d+)'", output, re.M)
    if len(matches) != 1:
        raise PreflightError('Could not uniquely identify APK package/version using aapt')
    return matches[0][0], int(matches[0][1])


def expected_source_release_identity():
    """Pin candidate identity to current Gradle release, not its filename.

    A correctly signed but outdated APK can otherwise give a misleading
    compatibility PASS against an earlier installed version.
    """
    gradle_path = Path(__file__).resolve().parents[1] / 'app' / 'build.gradle'
    try:
        gradle = gradle_path.read_text(encoding='utf-8')
    except OSError as exc:
        raise PreflightError('Cannot read source Android release identity; no upgrade decision') from exc
    codes = re.findall(r'^\s*versionCode\s+(\d+)\s*    """Reject non-release APKs before contacting a phone or reporting upgrade safety."""
    pkg, code = parse_badging(badging)
    if pkg != PACKAGE or parse_certificates(certificate_report) != EXPECTED_RELEASE_SIGNER:
        raise PreflightError('Candidate has incorrect package or signing certificate')
    expected_code, expected_name = expected_source_release_identity()
    names = re.findall(
        r"^package:\s+name='[^']+'\s+versionCode='\d+'\s+versionName='([^']+)'",
        badging, re.M)
    if len(names) != 1 or (code, names[0]) != (expected_code, expected_name):
        raise PreflightError(
            f'Candidate release identity is stale or ambiguous; '
            f'expected {expected_name} (versionCode {expected_code}), '
            'do not install or remove anything')
    sdk = re.findall(r"^sdkVersion:'(\d+)'\s*$", badging, re.M)
    if len(sdk) != 1:
        raise PreflightError('Candidate has no unambiguous minimum Android SDK')
    if re.search(r'^application-(?:debuggable|testOnly)(?:\s|$)', badging, re.M):
        raise PreflightError('Candidate is debuggable or testOnly, not a release APK')
    for version in (2, 3):
        flag = (f'Verified using v{version} scheme '
                f'(APK Signature Scheme v{version}): true')
        if not re.search(r'^' + re.escape(flag) + r'\s*$', certificate_report, re.M):
            raise PreflightError(f'Candidate APK does not verify with Android v{version} signing')
    return code, int(sdk[0])


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
    # A single split APK is not the installed base and does not establish
    # that this package can be upgraded while preserving its saved data.
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
        if current_signer in HISTORICAL_DEV_SIGNERS:
            name = HISTORICAL_DEV_SIGNERS[current_signer]
            raise PreflightError(
                f'Installed signer differs: this is the historical {name} development key. '
                'The maintained APK cannot update it in place. These 1.0.57 development '
                'APKs do not bundle the newer cloud-save scripts, so do not assume an '
                'export menu exists. DO NOT uninstall, clear data, or sideload; first '
                'establish and verify an independent lossless character-data recovery path.')
        raise PreflightError('Installed signer differs from maintained APK. DO NOT uninstall, clear data, or sideload. Use the existing Play track or independently verify a lossless export.')
    if new_code <= current_code:
        raise PreflightError(f'Candidate versionCode {new_code} is not newer than installed {current_code}')
    return current_code, new_code


def archived_certificate_report(apksigner, path):
    """Allow recognizing a verified *known bad* v1-only dev signer, never PASS it.

    Legacy 1.0.57 development APKs have only JAR/v1 signatures. A normal
    modern-Android verification may fail before reporting their certificates.
    Validate that old signature for API 23 solely to recognize the two
    explicitly blocked historical development keys. No v1-only APK can PASS.
    """
    try:
        report = command([apksigner, 'verify', '--verbose', '--print-certs', str(path)])
    except PreflightError as initial_error:
        try:
            legacy = command([apksigner, 'verify', '--min-sdk-version', '23',
                              '--max-sdk-version', '23', '--print-certs', str(path)])
        except PreflightError:
            raise initial_error
        if parse_certificates(legacy) not in HISTORICAL_DEV_SIGNERS:
            raise PreflightError(
                'Archived APK verifies only under legacy v1 signing; '
                'modern Android upgrade compatibility cannot be established')
        return legacy
    # A successful apksigner exit alone can still be a v1/JAR-only verification.
    # Fail closed on that case even when the certificate matches our release key.
    # Known development certificates are returned only so validate_pair can
    # provide their specific DO NOT uninstall/clear/sideload warning.
    modern_flags = [
        f'Verified using v{v} scheme (APK Signature Scheme v{v}): true'
        for v in (2, 3)
    ]
    if not any(flag in report.splitlines() for flag in modern_flags):
        if parse_certificates(report) not in HISTORICAL_DEV_SIGNERS:
            raise PreflightError(
                'Archived APK has no verified v2/v3 signing; '
                'archive-only upgrade compatibility cannot be established')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path, help='Maintained-signed Thornhaven .apk (not .aab)')
    parser.add_argument('--serial', help='Explicit adb serial, if multiple devices are connected')
    parser.add_argument('--installed-apk', type=Path,
                        help='Compare an archived APK offline instead of querying an Android device; does not establish the installed app signer')
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--aapt', default='aapt')
    parser.add_argument('--apksigner', default='apksigner')
    args = parser.parse_args(argv)
    if not args.candidate.is_file() or args.candidate.suffix.lower() != '.apk':
        parser.error('Candidate must be an existing APK file (not an AAB)')
    if args.installed_apk is not None:
        if args.serial:
            parser.error('--serial cannot be combined with --installed-apk')
        if not args.installed_apk.is_file() or args.installed_apk.suffix.lower() != '.apk':
            parser.error('--installed-apk must name an existing APK file')
    prefix = [args.adb] + (['-s', args.serial] if args.serial else [])
    try:
        candidate_badging = command([args.aapt, 'dump', 'badging', str(args.candidate)])
        candidate_cert = command([args.apksigner, 'verify', '--verbose', '--print-certs',
                                  str(args.candidate)])
        # Fail closed on a non-release candidate, even before contacting a device.
        _, minimum_sdk = validate_release_candidate(candidate_badging, candidate_cert)
        if args.installed_apk is not None:
            archived_badging = command([args.aapt, 'dump', 'badging', str(args.installed_apk)])
            archived_cert = archived_certificate_report(args.apksigner, args.installed_apk)
            old_code, new_code = validate_pair(archived_badging, archived_cert,
                                               candidate_badging, candidate_cert)
            print(f'PASS (ARCHIVE-ONLY): {PACKAGE} versionCode {old_code} -> {new_code}; APK signing identity matches.')
            print('NO DEVICE INSPECTED OR UPDATE PERFORMED: this compares two local APK files only. It does not establish which signing certificate is installed on a phone, Play App Signing compatibility, or saved-character survival.')
            return 0
        sdk_report = command(prefix + ['shell', 'getprop', 'ro.build.version.sdk']).strip()
        if not re.fullmatch(r'\d+', sdk_report):
            raise PreflightError('Could not identify device Android SDK level')
        if minimum_sdk > int(sdk_report):
            raise PreflightError(f'Candidate requires Android API {minimum_sdk}; '
                                 f'device supports API {sdk_report}')
        paths = command(prefix + ['shell', 'pm', 'path', PACKAGE])
        base = parse_installed_base(paths)
        with tempfile.TemporaryDirectory(prefix='thornhaven-readonly-preflight-') as temp:
            copy = str(Path(temp) / 'installed-base.apk')
            command(prefix + ['pull', base, copy])
            current_badging = command([args.aapt, 'dump', 'badging', copy])
            # A copied installed APK can be a legacy v1-only test build.
            # Never treat apksigner's success exit alone as upgrade-safe:
            # verify v2/v3, or identify a known historical dev key solely
            # to return the explicit recovery warning from validate_pair.
            current_cert = archived_certificate_report(args.apksigner, Path(copy))
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
, gradle, re.M)
    names = re.findall(r"^\s*versionName\s+'([^']+)'\s*$", gradle, re.M)
    if len(codes) != 1 or len(names) != 1:
        raise PreflightError('Ambiguous source Android release identity; no upgrade decision')
    return int(codes[0]), names[0]


def validate_release_candidate(badging, certificate_report):
    """Reject non-release APKs before contacting a phone or reporting upgrade safety."""
    pkg, code = parse_badging(badging)
    if pkg != PACKAGE or parse_certificates(certificate_report) != EXPECTED_RELEASE_SIGNER:
        raise PreflightError('Candidate has incorrect package or signing certificate')
    sdk = re.findall(r"^sdkVersion:'(\d+)'\s*$", badging, re.M)
    if len(sdk) != 1:
        raise PreflightError('Candidate has no unambiguous minimum Android SDK')
    if re.search(r'^application-(?:debuggable|testOnly)(?:\s|$)', badging, re.M):
        raise PreflightError('Candidate is debuggable or testOnly, not a release APK')
    for version in (2, 3):
        flag = (f'Verified using v{version} scheme '
                f'(APK Signature Scheme v{version}): true')
        if not re.search(r'^' + re.escape(flag) + r'\s*$', certificate_report, re.M):
            raise PreflightError(f'Candidate APK does not verify with Android v{version} signing')
    return code, int(sdk[0])


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
    # A single split APK is not the installed base and does not establish
    # that this package can be upgraded while preserving its saved data.
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
        if current_signer in HISTORICAL_DEV_SIGNERS:
            name = HISTORICAL_DEV_SIGNERS[current_signer]
            raise PreflightError(
                f'Installed signer differs: this is the historical {name} development key. '
                'The maintained APK cannot update it in place. These 1.0.57 development '
                'APKs do not bundle the newer cloud-save scripts, so do not assume an '
                'export menu exists. DO NOT uninstall, clear data, or sideload; first '
                'establish and verify an independent lossless character-data recovery path.')
        raise PreflightError('Installed signer differs from maintained APK. DO NOT uninstall, clear data, or sideload. Use the existing Play track or independently verify a lossless export.')
    if new_code <= current_code:
        raise PreflightError(f'Candidate versionCode {new_code} is not newer than installed {current_code}')
    return current_code, new_code


def archived_certificate_report(apksigner, path):
    """Allow recognizing a verified *known bad* v1-only dev signer, never PASS it.

    Legacy 1.0.57 development APKs have only JAR/v1 signatures. A normal
    modern-Android verification may fail before reporting their certificates.
    Validate that old signature for API 23 solely to recognize the two
    explicitly blocked historical development keys. No v1-only APK can PASS.
    """
    try:
        report = command([apksigner, 'verify', '--verbose', '--print-certs', str(path)])
    except PreflightError as initial_error:
        try:
            legacy = command([apksigner, 'verify', '--min-sdk-version', '23',
                              '--max-sdk-version', '23', '--print-certs', str(path)])
        except PreflightError:
            raise initial_error
        if parse_certificates(legacy) not in HISTORICAL_DEV_SIGNERS:
            raise PreflightError(
                'Archived APK verifies only under legacy v1 signing; '
                'modern Android upgrade compatibility cannot be established')
        return legacy
    # A successful apksigner exit alone can still be a v1/JAR-only verification.
    # Fail closed on that case even when the certificate matches our release key.
    # Known development certificates are returned only so validate_pair can
    # provide their specific DO NOT uninstall/clear/sideload warning.
    modern_flags = [
        f'Verified using v{v} scheme (APK Signature Scheme v{v}): true'
        for v in (2, 3)
    ]
    if not any(flag in report.splitlines() for flag in modern_flags):
        if parse_certificates(report) not in HISTORICAL_DEV_SIGNERS:
            raise PreflightError(
                'Archived APK has no verified v2/v3 signing; '
                'archive-only upgrade compatibility cannot be established')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path, help='Maintained-signed Thornhaven .apk (not .aab)')
    parser.add_argument('--serial', help='Explicit adb serial, if multiple devices are connected')
    parser.add_argument('--installed-apk', type=Path,
                        help='Compare an archived APK offline instead of querying an Android device; does not establish the installed app signer')
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--aapt', default='aapt')
    parser.add_argument('--apksigner', default='apksigner')
    args = parser.parse_args(argv)
    if not args.candidate.is_file() or args.candidate.suffix.lower() != '.apk':
        parser.error('Candidate must be an existing APK file (not an AAB)')
    if args.installed_apk is not None:
        if args.serial:
            parser.error('--serial cannot be combined with --installed-apk')
        if not args.installed_apk.is_file() or args.installed_apk.suffix.lower() != '.apk':
            parser.error('--installed-apk must name an existing APK file')
    prefix = [args.adb] + (['-s', args.serial] if args.serial else [])
    try:
        candidate_badging = command([args.aapt, 'dump', 'badging', str(args.candidate)])
        candidate_cert = command([args.apksigner, 'verify', '--verbose', '--print-certs',
                                  str(args.candidate)])
        # Fail closed on a non-release candidate, even before contacting a device.
        _, minimum_sdk = validate_release_candidate(candidate_badging, candidate_cert)
        if args.installed_apk is not None:
            archived_badging = command([args.aapt, 'dump', 'badging', str(args.installed_apk)])
            archived_cert = archived_certificate_report(args.apksigner, args.installed_apk)
            old_code, new_code = validate_pair(archived_badging, archived_cert,
                                               candidate_badging, candidate_cert)
            print(f'PASS (ARCHIVE-ONLY): {PACKAGE} versionCode {old_code} -> {new_code}; APK signing identity matches.')
            print('NO DEVICE INSPECTED OR UPDATE PERFORMED: this compares two local APK files only. It does not establish which signing certificate is installed on a phone, Play App Signing compatibility, or saved-character survival.')
            return 0
        sdk_report = command(prefix + ['shell', 'getprop', 'ro.build.version.sdk']).strip()
        if not re.fullmatch(r'\d+', sdk_report):
            raise PreflightError('Could not identify device Android SDK level')
        if minimum_sdk > int(sdk_report):
            raise PreflightError(f'Candidate requires Android API {minimum_sdk}; '
                                 f'device supports API {sdk_report}')
        paths = command(prefix + ['shell', 'pm', 'path', PACKAGE])
        base = parse_installed_base(paths)
        with tempfile.TemporaryDirectory(prefix='thornhaven-readonly-preflight-') as temp:
            copy = str(Path(temp) / 'installed-base.apk')
            command(prefix + ['pull', base, copy])
            current_badging = command([args.aapt, 'dump', 'badging', copy])
            # A copied installed APK can be a legacy v1-only test build.
            # Never treat apksigner's success exit alone as upgrade-safe:
            # verify v2/v3, or identify a known historical dev key solely
            # to return the explicit recovery warning from validate_pair.
            current_cert = archived_certificate_report(args.apksigner, Path(copy))
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

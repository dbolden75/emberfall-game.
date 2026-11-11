#!/usr/bin/env python3
"""Keep release identity in operator instructions aligned with Android Gradle.

Documentation consistency is NOT Play Console acceptance or device testing.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def one(pattern, text, label):
    matches = re.findall(pattern, text, re.M)
    if len(matches) != 1:
        raise SystemExit(f'FAIL: expected exactly one {label}; found {len(matches)}')
    return matches[0]


def main():
    gradle = (ROOT / 'app' / 'build.gradle').read_text(encoding='utf-8')
    guide = (ROOT / 'BUILD-WORKFLOW.md').read_text(encoding='utf-8')
    package = one(r"^\s*applicationId\s+'([^']+)'\s*$", gradle, 'Android package')
    version = one(r"^\s*versionName\s+'([^']+)'\s*$", gradle, 'Android versionName')
    code = one(r'^\s*versionCode\s+(\d+)\s*$', gradle, 'Android versionCode')
    if package != 'com.vaelbrink.ashvale.newjourney':
        raise SystemExit('FAIL: Android application ID changed, existing installs/saves at risk')
    documented = one(r'^Current main development source: ([^,\n]+), Android versionCode (\d+)(?=[,.])',
                     guide, 'documented current release identity')
    if documented != (version, code):
        raise SystemExit(f'FAIL: BUILD-WORKFLOW.md says {documented}; Android source is {(version, code)}')
    documented_package = one(r'^Package: ([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)', guide,
                             'documented package')
    if documented_package != package:
        raise SystemExit(f'FAIL: BUILD-WORKFLOW.md package {documented_package} != {package}')
    # CI cannot see private signing keys, but inconsistent public hashes or
    # source commits could advertise a stale/unsafe APK after a native rebuild.
    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    continuity = (ROOT / 'THORNHAVEN_CONTINUITY.md').read_text(encoding='utf-8')

    def pinned_sha(body, marker, label):
        rows = [line for line in body.splitlines() if marker in line]
        if len(rows) != 1:
            raise SystemExit(f'FAIL: expected one {label} release hash, found {len(rows)}')
        match = re.search(r'\\x60([a-f0-9]{64})\\x60', rows[0].split(marker, 1)[1])
        if not match:
            raise SystemExit(f'FAIL: missing canonical SHA-256 for {label}')
        return match.group(1)

    for kind in ('APK', 'AAB'):
        digests = (
            pinned_sha(readme, f'Maintained-signed {kind} SHA-256', f'README {kind}'),
            pinned_sha(continuity, f'Canonical signed {version} {kind} SHA-256', f'continuity {kind}'),
            pinned_sha(guide, f'{"canonical signed APK SHA-256 is" if kind == "APK" else "AAB SHA-256 is"}',
                       f'build instructions {kind}'),
        )
        if len(set(digests)) != 1:
            raise SystemExit(f'FAIL: mismatched signed {kind} hashes across release handovers')

    candidate_rows = (
        (readme, 'Maintained-key signed game source:', 'README'),
        (continuity, 'Latest independently verified maintained-key signed candidate:', 'continuity'),
        (guide, 'maintained-key-signed APK/AAB', 'build instructions'),
    )
    commits = []
    for body, marker, label in candidate_rows:
        rows = [line for line in body.splitlines() if marker in line]
        if len(rows) != 1:
            raise SystemExit(f'FAIL: expected one {label} signed candidate reference, found {len(rows)}')
        match = re.search(r'\\[\\x60([a-f0-9]{8})\\x60\\]', rows[0])
        if not match:
            raise SystemExit(f'FAIL: missing signed candidate source commit in {label}')
        commits.append(match.group(1))
    if len(set(commits)) != 1:
        raise SystemExit('FAIL: mismatched signed candidate source commits across handovers')
    print('PASS: three release handovers agree on signed artifact hashes and source commit')
    # Preserve both historic developer-signing identities in operator instructions.
    # Different signing certificates block in-place Android updates, so losing
    # this warning in a release handoff could lead to irreversible save deletion.
    dev_certificates = {
        'Thornhaven-1.0.57-dev-test.apk':
            '09ed9284b3e16e0181f7e9b428e5ed882bc66cf325c900212d40baf9dc817099',
        'Thornhaven-1.0.57-fixes-dev-test.apk':
            'eba47475cc63815c8d16bbf7819a32dcd3991438e5c2336df2bbe10eb9e423b5',
    }
    for filename, certificate in dev_certificates.items():
        if filename not in guide or certificate not in guide:
            raise SystemExit(f'FAIL: missing signed-development migration warning for {filename}')
    maintained_certificate = '38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
    if maintained_certificate not in guide:
        raise SystemExit('FAIL: release documentation lost the maintained signer identity')
    if 'CANNOT perform an in-place update' not in guide or 'NEVER advise uninstalling' not in guide:
        raise SystemExit('FAIL: release instructions no longer warn against data-loss migration')
    print('PASS: both historical development signing identities and save-preservation warning retained')
    print(f'PASS: documented Android release is {package}, version {version}, versionCode {code}')
    print('NOT TESTED: Play Console versionCode availability or upload-signing acceptance')


if __name__ == '__main__':
    main()

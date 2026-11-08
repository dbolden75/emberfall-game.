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
    documented = one(r'^Current main development source: ([^,\n]+), Android versionCode (\d+)\.',
                     guide, 'documented current release identity')
    if documented != (version, code):
        raise SystemExit(f'FAIL: BUILD-WORKFLOW.md says {documented}; Android source is {(version, code)}')
    documented_package = one(r'^Package: ([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)', guide,
                             'documented package')
    if documented_package != package:
        raise SystemExit(f'FAIL: BUILD-WORKFLOW.md package {documented_package} != {package}')
    print(f'PASS: documented Android release is {package}, version {version}, versionCode {code}')
    print('NOT TESTED: Play Console versionCode availability or upload-signing acceptance')


if __name__ == '__main__':
    main()

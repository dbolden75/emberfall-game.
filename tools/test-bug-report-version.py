#!/usr/bin/env python3
"""Keep in-game Jarvis reports tied to the actual Android build version."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def inspect_version(html: bytes, gradle: str) -> str:
    names = re.findall(r"(?m)^\s*versionName\s+'([^']+)'\s*$", gradle)
    assert len(names) == 1, 'Expected exactly one Android versionName'
    expected = names[0].encode('ascii')
    reports = re.findall(rb"const context=\(\)=>\(\{build:'([^']+)'", html)
    assert reports == [expected], f'Jarvis bug-report versions {reports!r} do not match Android {expected!r}'
    assert html.count(b'Version ' + expected + b' \xc2\xb7 Ashvale Reach') == 1, 'Title-screen release version mismatch'
    return names[0]


def main() -> None:
    html = (ROOT / 'app/src/main/assets/index.html').read_bytes()
    gradle = (ROOT / 'app/build.gradle').read_text()
    version = inspect_version(html, gradle)
    target = b"const context=()=>({build:'" + version.encode('ascii') + b"',map:"
    assert html.count(target) == 1
    for wrong_version in (b'1.0.49', b'1.0.68'):
        corrupted = html.replace(target, b"const context=()=>({build:'" + wrong_version + b"',map:", 1)
        assert corrupted != html
        try:
            inspect_version(corrupted, gradle)
        except AssertionError:
            continue
        raise AssertionError('Regression test failed to reject mismatched bug-report build')
    print(f'PASS: Jarvis bug reports and title screen match Android {version}; stale-build mutations rejected')


if __name__ == '__main__':
    main()

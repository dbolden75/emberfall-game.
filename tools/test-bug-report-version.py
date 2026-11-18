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
    for wrong_version in (b'1.0.49', b'999.0.0'):
        corrupted = html.replace(target, b"const context=()=>({build:'" + wrong_version + b"',map:", 1)
        assert corrupted != html
        try:
            inspect_version(corrupted, gradle)
        except AssertionError:
            continue
        raise AssertionError('Regression test failed to reject mismatched bug-report build')
    # The developer-only frame uploader is a separate bundled JS module.
    # Its runtime report identity must come from the installed Android app,
    # not from an independent literal that becomes stale after release.
    editor = (ROOT / 'app/src/main/assets/playtest-editor.js').read_text()
    native = (ROOT / 'app/src/main/java/com/emberfall/ashvale/MainActivity.java').read_text()
    assert 'build:reportBuildVersion()' in editor
    assert "build:'1.0.49'" not in editor
    assert 'getBuildVersion?.()' in editor
    assert 'getPackageManager().getPackageInfo(getPackageName(), 0).versionName' in native
    print('PASS: developer bug reports derive release identity from installed Android package')
    print(f'PASS: Jarvis bug reports and title screen match Android {version}; stale-build mutations rejected')


if __name__ == '__main__':
    main()

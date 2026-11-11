#!/usr/bin/env python3
"""Isolated AAB identity test: only synthetic protobuf XML, no signing keys."""
from pathlib import Path
from tempfile import TemporaryDirectory
import warnings
import zipfile
from aab_manifest_identity import (ANDROID_NAMESPACE, MANIFEST, verify_aab_file)

PACKAGE = 'com.vaelbrink.ashvale.newjourney'


def varint(number):
    out = bytearray()
    while number > 127:
        out.append((number & 127) | 128)
        number >>= 7
    out.append(number)
    return bytes(out)


def field(number, data):
    return varint((number << 3) | 2) + varint(len(data)) + data


def attribute(name, value, namespace='', code=None):
    result = field(2, name.encode()) + field(3, value.encode())
    if namespace:
        result = field(1, namespace.encode()) + result
    if code is not None:
        primitive = varint((6 << 3) | 0) + varint(code)
        result += field(6, field(7, primitive))
    return field(4, result)


def manifest(package=PACKAGE, code='169', compiled=169, version='1.0.67', *,
             duplicate=False, root='manifest', root_test_only=False,
             root_debuggable=False, app_debuggable=False, app_test_only=False,
             duplicate_application=False, omit_application=False):
    body = field(3, root.encode()) + attribute('package', package)
    body += attribute('versionCode', code, ANDROID_NAMESPACE, compiled)
    body += attribute('versionName', version, ANDROID_NAMESPACE)
    if duplicate:
        body += attribute('package', package)
    if root_test_only:
        body += attribute('testOnly', 'true', ANDROID_NAMESPACE)
    if root_debuggable:
        body += attribute('debuggable', 'true', ANDROID_NAMESPACE)
    app = field(3, b'application')
    if app_debuggable:
        app += attribute('debuggable', 'true', ANDROID_NAMESPACE)
    if app_test_only:
        app += attribute('testOnly', 'true', ANDROID_NAMESPACE)
    if not omit_application:
        body += field(5, field(1, app))
    if duplicate_application:
        body += field(5, field(1, app))
    return field(1, body)


def main():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / 'test.aab'

        def check(contents, should_pass=False, repeated=False):
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr(MANIFEST, contents)
                if repeated:
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore', UserWarning)
                        z.writestr(MANIFEST, contents)
            try:
                verify_aab_file(path, PACKAGE, 169, '1.0.67')
                accepted = True
            except (ValueError, zipfile.BadZipFile):
                accepted = False
            assert accepted is should_pass, f'Invalid AAB identity result: {should_pass=}'

        check(manifest(), True)
        check(manifest(package='com.other.app'))
        check(manifest(code='168'))
        check(manifest(compiled=168))
        check(manifest(version='1.0.66'))
        check(manifest(duplicate=True))
        check(manifest(root='activity'))
        # An AAB can have the correct package/version and still request a
        # non-release installation. APK-only badging checks cannot catch this.
        check(manifest(root_test_only=True))
        check(manifest(root_debuggable=True))
        check(manifest(app_debuggable=True))
        check(manifest(app_test_only=True))
        check(manifest(duplicate_application=True))
        check(manifest(omit_application=True))
        check(manifest(), repeated=True)
        check(b'not protobuf XML')
        with zipfile.ZipFile(path, 'w') as z:
            z.writestr('base/assets/index.html', b'test')
        try:
            verify_aab_file(path, PACKAGE, 169, '1.0.67')
            assert False, 'Missing manifest passed'
        except ValueError:
            pass
    print('PASS: AAB manifest identity rejects 15 changed, unsafe, malformed, duplicate, or missing fixture cases')
    print('NOTE: synthetic AAB XML; no actual signing keys or device testing')


if __name__ == '__main__':
    main()

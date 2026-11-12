#!/usr/bin/env python3
"""Read-only compiled APK manifest gate; no SDK, keys or device required."""
import argparse
import struct
import sys
from pathlib import Path
from zipfile import ZipFile

PACKAGE = 'com.vaelbrink.ashvale.newjourney'
BILLING_PERMISSION = 'com.android.vending.BILLING'
BILLING_QUERY = 'com.android.vending.billing.InAppBillingService.BIND'
PROXY = 'com.android.billingclient.api.ProxyBillingActivity'
PROXY_V2 = 'com.android.billingclient.api.ProxyBillingActivityV2'
MAIN = 'com.emberfall.ashvale.MainActivity'


def parse_manifest(binary):
    def word(offset, length=4):
        if offset < 0 or offset + length > len(binary):
            raise ValueError('Truncated Android binary XML')
        return int.from_bytes(binary[offset:offset + length], 'little')

    if len(binary) < 16 or word(0, 2) != 0x0003 or word(8, 2) != 0x0001:
        raise ValueError('Expected compiled binary AndroidManifest.xml')
    total = word(4)
    if total > len(binary) or total < 16:
        raise ValueError('Invalid binary XML size')
    pool_offset = 8
    header_size = word(pool_offset + 2, 2)
    chunk_size = word(pool_offset + 4)
    if header_size < 28 or chunk_size < header_size or pool_offset + chunk_size > total:
        raise ValueError('Invalid Android XML string pool')
    count, flags, start = word(pool_offset + 8), word(pool_offset + 16), word(pool_offset + 20)
    if count > 100000 or header_size + count * 4 > chunk_size:
        raise ValueError('Invalid string pool indices')

    def length8(pos):
        first = word(pos, 1)
        if first & 0x80:
            return ((first & 0x7f) << 8) | word(pos + 1, 1), pos + 2
        return first, pos + 1

    def length16(pos):
        first = word(pos, 2)
        if first & 0x8000:
            return ((first & 0x7fff) << 16) | word(pos + 2, 2), pos + 4
        return first, pos + 2

    strings = []
    for i in range(count):
        string_offset = pool_offset + start + word(pool_offset + header_size + i * 4)
        if flags & 0x100:
            _, pos = length8(string_offset)
            byte_len, pos = length8(pos)
            raw = binary[pos:pos + byte_len]
            if len(raw) != byte_len:
                raise ValueError('Truncated XML UTF-8 string')
            strings.append(raw.decode('utf-8'))
        else:
            unit_len, pos = length16(string_offset)
            raw = binary[pos:pos + unit_len * 2]
            if len(raw) != unit_len * 2:
                raise ValueError('Truncated XML UTF-16 string')
            strings.append(raw.decode('utf-16le'))

    def string(index):
        if index == 0xffffffff:
            return None
        if index >= len(strings):
            raise ValueError('Invalid XML string index')
        return strings[index]

    nodes, stack = [], []
    offset = pool_offset + chunk_size
    while offset < total:
        if offset + 8 > total:
            raise ValueError('Truncated XML chunk header')
        tag, header, size = struct.unpack_from('<HHI', binary, offset)
        if size < header or header < 8 or offset + size > total:
            raise ValueError('Invalid XML chunk')
        if tag == 0x102:
            if header < 16:
                raise ValueError('Invalid start element')
            name = string(word(offset + 20))
            attrs = {}
            attr_start = word(offset + 24, 2)
            attr_size = word(offset + 26, 2)
            attr_count = word(offset + 28, 2)
            if attr_size < 20 or offset + 16 + attr_start + attr_size * attr_count > offset + size:
                raise ValueError('Invalid element attributes')
            for i in range(attr_count):
                pos = offset + 16 + attr_start + attr_size * i
                key = string(word(pos + 4))
                raw = string(word(pos + 8))
                typed = word(pos + 15, 1)
                val = word(pos + 16)
                if raw is not None:
                    value = raw
                elif typed == 3:
                    value = string(val)
                elif typed == 0x12:
                    value = bool(val)
                elif typed in (0x10, 0x11):
                    value = val
                else:
                    value = (typed, val)
                attrs[key] = value
            stack.append(name)
            nodes.append(('/'.join(stack), attrs))
        elif tag == 0x103:
            if not stack or string(word(offset + 20)) != stack[-1]:
                raise ValueError('Malformed XML element nesting')
            stack.pop()
        offset += size
    if stack:
        raise ValueError('Unclosed XML elements')
    return nodes


def validate(nodes, version_code=169):
    def entries(path):
        return [attrs for loc, attrs in nodes if loc == path]

    issues = []
    root = entries('manifest')
    if len(root) != 1 or root[0].get('package') != PACKAGE:
        issues.append('Unexpected app package (must not change installation/save identity)')
    if len(root) != 1 or root[0].get('versionCode') != version_code:
        issues.append('APK versionCode does not match configured release')
    sdks = entries('manifest/uses-sdk')
    if len(sdks) != 1 or sdks[0].get('minSdkVersion') != 24 or sdks[0].get('targetSdkVersion') != 36:
        issues.append('Unexpected minSdk or targetSdk in compiled APK')
    apps = entries('manifest/application')
    if len(apps) != 1 or apps[0].get('allowBackup') is not False:
        issues.append('Compiled application backup policy is not pinned to false')
    permissions = {a.get('name') for a in entries('manifest/uses-permission')}
    if BILLING_PERMISSION not in permissions:
        issues.append('Compiled app lacks Play Billing permission')
    if not any(a.get('name') == BILLING_QUERY for a in entries('manifest/queries/intent/action')):
        issues.append('Compiled manifest lacks Play Billing service visibility query')
    activities = entries('manifest/application/activity')
    for name, expected_exported in [(MAIN, True), (PROXY, False), (PROXY_V2, False)]:
        matches = [a for a in activities if a.get('name') == name]
        if len(matches) != 1 or matches[0].get('exported') is not expected_exported:
            issues.append(f'Compiled activity missing or unsafe exported flag: {name}')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--version-code', type=int, default=169)
    args = parser.parse_args()
    try:
        with ZipFile(args.apk) as archive:
            nodes = parse_manifest(archive.read('AndroidManifest.xml'))
        issues = validate(nodes, args.version_code)
        if issues:
            for issue in issues:
                print(f'FAIL: {issue}', file=sys.stderr)
            return 1
        print(f'PASS: packaged APK identity, code {args.version_code}, save-sensitive backup policy, Billing permission, service query, and unexported Billing proxy activities')
        return 0
    except (OSError, ValueError, KeyError, struct.error, UnicodeError) as error:
        print(f'FAIL: cannot verify packaged AndroidManifest.xml: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

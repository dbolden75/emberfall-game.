"""Verify the base-module AAB manifest identity without build/signing secrets.

Android App Bundles store AndroidManifest.xml as protobuf XML, unlike APKs.
Read only the root element's literal attributes (and the compiled numeric
versionCode) to prevent signing a stale or different Play package from a CI
artifact. This is a release identity gate, not bundletool validation.
"""
from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile

ANDROID_NAMESPACE = 'http://schemas.android.com/apk/res/android'
MANIFEST = 'base/manifest/AndroidManifest.xml'
MAX_MANIFEST_BYTES = 2 * 1024 * 1024


def _varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    for shift in range(0, 70, 7):
        if offset >= len(data):
            raise ValueError('Truncated AAB manifest protobuf varint')
        byte = data[offset]
        offset += 1
        if shift == 63 and byte > 1:
            raise ValueError('Overflowed AAB manifest protobuf varint')
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
    raise ValueError('Oversized AAB manifest protobuf varint')


def _fields(data: bytes):
    index = 0
    while index < len(data):
        tag, index = _varint(data, index)
        field, kind = tag >> 3, tag & 7
        if not field:
            raise ValueError('AAB manifest protobuf contains invalid field zero')
        if kind == 2:
            size, index = _varint(data, index)
            if size > len(data) - index:
                raise ValueError('Truncated AAB manifest protobuf field')
            result = data[index:index + size]
            index += size
        elif kind == 0:
            result, index = _varint(data, index)
        elif kind in (1, 5):
            size = 8 if kind == 1 else 4
            if size > len(data) - index:
                raise ValueError('Truncated AAB manifest protobuf fixed field')
            result = data[index:index + size]
            index += size
        else:
            raise ValueError('Unsupported AAB manifest protobuf wire type')
        yield field, kind, result


def _one(fields, field: int, wire_type: int):
    found = [v for f, t, v in fields if f == field and t == wire_type]
    if len(found) != 1:
        raise ValueError(f'AAB manifest protobuf expected exactly one field {field}')
    return found[0]


def _string(data: bytes) -> str:
    return data.decode('utf-8', 'strict')


def _root_attributes(data: bytes) -> dict[tuple[str, str], tuple[str, bytes | None]]:
    if len(data) > MAX_MANIFEST_BYTES:
        raise ValueError('AAB manifest is unexpectedly large')
    root = list(_fields(data))
    element = _one(root, 1, 2)
    contents = list(_fields(element))
    if _string(_one(contents, 3, 2)) != 'manifest':
        raise ValueError('AAB XML root is not manifest')
    attributes = {}
    for field, wire_type, entry in contents:
        if field != 4:
            continue
        if wire_type != 2:
            raise ValueError('Invalid AAB XML attribute wire type')
        entries = list(_fields(entry))
        key = (_string(_one(entries, 1, 2)) if any(f == 1 for f, _, _ in entries) else '',
               _string(_one(entries, 2, 2)))
        if key in attributes:
            raise ValueError('Duplicate AAB manifest attribute: ' + str(key))
        value = _string(_one(entries, 3, 2))
        compiled = [x for f, t, x in entries if f == 6 and t == 2]
        if len(compiled) > 1:
            raise ValueError('Duplicate compiled AAB XML attribute value')
        attributes[key] = (value, compiled[0] if compiled else None)
    return attributes


def _compiled_code(data: bytes) -> int:
    """Read Item.primitive (field 7), then Primitive.int_decimal (field 6)."""
    item = list(_fields(data))
    primitive = _one(item, 7, 2)
    return _one(list(_fields(primitive)), 6, 0)


def verify_aab_manifest_identity(archive: ZipFile, package: str, code: int | str, version: str) -> None:
    members = [entry for entry in archive.infolist() if entry.filename == MANIFEST]
    if len(members) != 1 or members[0].is_dir() or members[0].file_size > MAX_MANIFEST_BYTES:
        raise ValueError('AAB must contain exactly one valid base-module AndroidManifest.xml')
    attributes = _root_attributes(archive.read(members[0]))
    expected = {
        ('', 'package'): package,
        (ANDROID_NAMESPACE, 'versionCode'): str(code),
        (ANDROID_NAMESPACE, 'versionName'): version,
    }
    for key, value in expected.items():
        actual = attributes.get(key)
        if actual is None or actual[0] != value:
            raise ValueError(f'AAB manifest identity mismatch for {key[1]}')
    compiled = attributes[(ANDROID_NAMESPACE, 'versionCode')][1]
    if compiled is None or _compiled_code(compiled) != int(code):
        raise ValueError('AAB manifest compiled versionCode disagrees with source')


def verify_aab_file(path: Path, package: str, code: int | str, version: str) -> None:
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError('AAB ZIP integrity failure')
        verify_aab_manifest_identity(archive, package, code, version)

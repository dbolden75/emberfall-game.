#!/usr/bin/env python3
"""Compare a signed Thornhaven release against its audited unsigned CI payload.

Checks *all* archive entries, including native DEX, AndroidManifest and Android
resources, rather than only web assets. JAR signature files may be added when
signing. Git's version-control-info.textproto may differ solely in commit SHA
when --allow-revision-diff is explicitly supplied for a post-merge audit.

This is an archive-content gate, NOT cryptographic APK/AAB signature checking.
Use apksigner, jarsigner, aapt and release-payload-checks.py separately.
"""
import argparse
import hashlib
import re
import zipfile
from pathlib import Path

VCS_APK = 'META-INF/version-control-info.textproto'
VCS_AAB = 'base/root/META-INF/version-control-info.textproto'
REVISION = re.compile(rb'(?m)(^  revision: ")[0-9a-f]{40}("$)')
SIGNATURE = re.compile(r'META-INF/(?:MANIFEST\.MF|[A-Za-z0-9_-]+\.(?:SF|RSA|DSA|EC))$')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def hash_entry(archive, name):
    digest = hashlib.sha256()
    with archive.open(name) as data:
        for block in iter(lambda: data.read(1024 * 1024), b''):
            digest.update(block)
    return digest.digest()


def compare(signed_path: Path, unsigned_path: Path, prefix: str, allow_revision_diff: bool):
    vcs = VCS_APK if prefix == 'APK' else VCS_AAB
    with zipfile.ZipFile(signed_path) as signed, zipfile.ZipFile(unsigned_path) as unsigned:
        require(signed.testzip() is None, f'{prefix}: signed archive has a damaged entry')
        require(unsigned.testzip() is None, f'{prefix}: unsigned archive has a damaged entry')
        signed_entries, unsigned_entries = set(signed.namelist()), set(unsigned.namelist())
        require(len(signed_entries) == len(signed.namelist()), f'{prefix}: duplicate signed ZIP entry')
        require(len(unsigned_entries) == len(unsigned.namelist()), f'{prefix}: duplicate unsigned ZIP entry')
        missing = unsigned_entries - signed_entries
        require(not missing, f'{prefix}: signed output lost original entries: {sorted(missing)[:8]}')
        additions = signed_entries - unsigned_entries
        require(all(SIGNATURE.fullmatch(entry) for entry in additions),
                f'{prefix}: unexpected new signed entries: {sorted(additions)[:8]}')
        # APK Signature Scheme v2/v3 signatures live outside ZIP entries, so
        # a correctly signed APK can add zero META-INF files. An AAB instead
        # uses JAR signing and must contain both signature-file types.
        # When an APK *does* add v1/JAR entries, require a complete pair.
        if prefix == 'AAB' or additions:
            require(any(entry.upper().endswith(('.RSA', '.DSA', '.EC')) for entry in additions)
                    and any(entry.upper().endswith('.SF') for entry in additions),
                    f'{prefix}: expected JAR signing entries absent')
        changed = []
        revision_differences = []
        for name in sorted(unsigned_entries):
            if hash_entry(signed, name) == hash_entry(unsigned, name):
                continue
            if name == vcs and allow_revision_diff:
                old, new = signed.read(name), unsigned.read(name)
                old_match = REVISION.search(old)
                new_match = REVISION.search(new)
                if old_match and new_match and REVISION.sub(rb'\g<1><git-sha>\2', old) == REVISION.sub(rb'\g<1><git-sha>\2', new):
                    revision_differences.append((old_match.group()[13:53].decode(), new_match.group()[13:53].decode()))
                    continue
            changed.append(name)
        require(not changed, f'{prefix}: signed payload differs from unsigned CI: {changed[:10]}')
        return len(unsigned_entries), len(additions), revision_differences


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--signed-apk', type=Path, required=True)
    p.add_argument('--unsigned-apk', type=Path, required=True)
    p.add_argument('--signed-aab', type=Path, required=True)
    p.add_argument('--unsigned-aab', type=Path, required=True)
    p.add_argument('--allow-revision-diff', action='store_true',
                   help='Only for comparing a prior signed release with a later CI commit; never use in signing CI')
    args = p.parse_args()
    for label, signed, unsigned in (('APK', args.signed_apk, args.unsigned_apk),
                                    ('AAB', args.signed_aab, args.unsigned_aab)):
        try:
            entries, extras, revisions = compare(signed, unsigned, label, args.allow_revision_diff)
        except (ValueError, KeyError, zipfile.BadZipFile) as exc:
            raise SystemExit(f'FAIL: {exc}') from exc
        print(f'PASS: {label} preserves {entries} unsigned CI archive entries and adds {extras} signing entries')
        if revisions:
            print(f'NOTE: {label} version-control metadata revision differs; allowed only for this post-merge audit')
    print('PASS: native code, Android manifest, resources and game assets match audited unsigned CI payloads')
    print('NOT CHECKED: cryptographic signatures, Play upload, device upgrades or runtime correctness')


if __name__ == '__main__':
    main()

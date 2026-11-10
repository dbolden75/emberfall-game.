"""Publish a verified APK/AAB pair without damaging an earlier release.

Linux-only offline release helper. All three files become visible together via
one same-filesystem directory rename; a reused output is read-only and must
already contain exactly the newly verified artifacts.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import tempfile


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def publish_verified_release(output: Path, apk: Path, aab: Path, version: str) -> tuple[Path, Path, str]:
    """Publish the pair and checksums atomically; never replace older bytes.

    If the destination already exists, accept only an exact, fully verified
    match (idempotent reruns). For a changed candidate use a fresh output path.
    """
    output = Path(output)
    apk = Path(apk)
    aab = Path(aab)
    if not version or '/' in version or '\\' in version or version in ('.', '..'):
        raise RuntimeError('Unsafe release version')
    if not apk.is_file() or not aab.is_file():
        raise RuntimeError('Verified release input missing')
    apk_name = f'Thornhaven-{version}-maintained-key.apk'
    aab_name = f'Thornhaven-{version}-maintained-key.aab'
    apk_hash, aab_hash = sha256(apk), sha256(aab)
    sums = f'{apk_hash}  {apk_name}\n{aab_hash}  {aab_name}\n'
    if output.is_symlink():
        raise RuntimeError('Refusing symlink release output directory')
    if output.exists():
        expected = ((apk_name, apk_hash), (aab_name, aab_hash))
        correct = (output.is_dir()
                   and all((output / name).is_file() and not (output / name).is_symlink()
                           and sha256(output / name) == digest for name, digest in expected)
                   and (output / 'SHA256SUMS.txt').is_file()
                   and not (output / 'SHA256SUMS.txt').is_symlink()
                   and (output / 'SHA256SUMS.txt').read_text() == sums)
        if not correct:
            raise RuntimeError('Existing release differs or is incomplete; use a fresh --output directory. Previous files untouched.')
        return output / apk_name, output / aab_name, sums
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.thornhaven-release-pending-', dir=output.parent) as tmp:
        staged = Path(tmp) / 'release'
        staged.mkdir(mode=0o700)
        for original, name, digest in ((apk, apk_name, apk_hash), (aab, aab_name, aab_hash)):
            dst = staged / name
            shutil.copyfile(original, dst)
            dst.chmod(0o600)
            if sha256(dst) != digest:
                raise RuntimeError(f'Staged {name} differs from verified signed candidate')
        (staged / 'SHA256SUMS.txt').write_text(sums)
        (staged / 'SHA256SUMS.txt').chmod(0o600)
        # Rename a populated directory on the same filesystem. Existing
        # nonempty releases cannot be replaced by this operation on Linux.
        if output.exists() or output.is_symlink():
            raise RuntimeError('Destination appeared during staging; no previous release replaced')
        os.rename(staged, output)
    return output / apk_name, output / aab_name, sums

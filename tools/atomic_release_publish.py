"""Publish a verified APK/AAB pair without damaging an earlier release.

Linux-only offline release helper. All three files become visible together via
one same-filesystem directory rename; a reused output is read-only and must
already contain exactly the newly verified artifacts.
"""
from __future__ import annotations

import ctypes
import errno
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

def rename_dir_no_replace(staged: Path, output: Path) -> None:
    """Linux atomic rename that *cannot* replace even an empty racing output.

    Plain os.rename() silently replaces an existing EMPTY directory on Linux,
    leaving a last-moment creation race in our previous release publisher.
    Fail closed if renameat2(RENAME_NOREPLACE) is unavailable.
    """
    libc = ctypes.CDLL(None, use_errno=True)
    renameat2 = getattr(libc, 'renameat2', None)
    if renameat2 is None:
        raise RuntimeError('Linux renameat2(RENAME_NOREPLACE) unavailable; release unpublished')
    renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p,
                          ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    renameat2.restype = ctypes.c_int
    at_fdcwd, rename_noreplace = -100, 1
    if renameat2(at_fdcwd, os.fsencode(staged), at_fdcwd, os.fsencode(output), rename_noreplace):
        code = ctypes.get_errno()
        if code in (errno.EEXIST, errno.ENOTEMPTY):
            raise RuntimeError('Destination appeared during staging; previous release untouched')
        raise OSError(code, os.strerror(code), os.fspath(output))


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
                   and {entry.name for entry in output.iterdir()} == {apk_name, aab_name, 'SHA256SUMS.txt'}
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
        # The prior os.rename could replace an empty directory that appeared
        # after the existence check. Linux RENAME_NOREPLACE fails atomically
        # for *any* existing destination, including an empty directory.
        if output.exists() or output.is_symlink():
            raise RuntimeError('Destination appeared during staging; no previous release replaced')
        rename_dir_no_replace(staged, output)
    return output / apk_name, output / aab_name, sums

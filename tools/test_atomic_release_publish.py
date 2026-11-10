#!/usr/bin/env python3
"""No signing keys/tools: exercise publish, refuse overwrite, and failure cleanup."""
from pathlib import Path
from unittest.mock import patch
import tempfile

from atomic_release_publish import publish_verified_release, rename_dir_no_replace, sha256


def main():
    with tempfile.TemporaryDirectory(prefix='thornhaven-publish-qa-') as tmp:
        folder = Path(tmp)
        apk, aab = folder / 'signed.apk', folder / 'signed.aab'
        apk.write_bytes(b'synthetic signed APK (not installable)')
        aab.write_bytes(b'synthetic signed AAB (not Play-usable)')
        out = folder / 'release'
        new_apk, new_aab, sums = publish_verified_release(out, apk, aab, '1.0.67')
        assert new_apk.read_bytes() == apk.read_bytes()
        assert new_aab.read_bytes() == aab.read_bytes()
        assert out.joinpath('SHA256SUMS.txt').read_text() == sums
        old_hash = sha256(new_apk)
        rerun = publish_verified_release(out, apk, aab, '1.0.67')
        assert rerun[2] == sums and sha256(new_apk) == old_hash
        # Exact idempotent output: a stray file must not be silently approved.
        extra = out / 'unverified-asset.bin'
        extra.write_bytes(b'not part of the signed release')
        try:
            publish_verified_release(out, apk, aab, '1.0.67')
            assert False, 'Unexpected release file was approved as verified'
        except RuntimeError:
            pass
        assert extra.read_bytes() == b'not part of the signed release'
        extra.unlink()
        apk.write_bytes(b'changed synthetic APK')
        try:
            publish_verified_release(out, apk, aab, '1.0.67')
            assert False, 'Conflicting signed release overwrote published candidate'
        except RuntimeError as exc:
            assert 'previous' in str(exc).lower()
        assert sha256(new_apk) == old_hash and out.joinpath('SHA256SUMS.txt').read_text() == sums
        incomplete = folder / 'incomplete'
        incomplete.mkdir()
        try:
            publish_verified_release(incomplete, apk, aab, '1.0.67')
            assert False, 'Incomplete existing release allowed'
        except RuntimeError:
            pass
        assert list(incomplete.iterdir()) == []
        link = folder / 'linked'
        link.symlink_to(out, target_is_directory=True)
        try:
            publish_verified_release(link, apk, aab, '1.0.67')
            assert False, 'Symlinked release output allowed'
        except RuntimeError:
            pass
        assert link.is_symlink()
        fresh = folder / 'never-published'
        with patch('atomic_release_publish.shutil.copyfile', side_effect=OSError('synthetic disk failure')):
            try:
                publish_verified_release(fresh, apk, aab, '1.0.67')
                assert False, 'Staging error published incomplete files'
            except OSError:
                pass
        assert not fresh.exists()
        # Simulate a concurrent writer creating an empty output directory
        # after the staging-time existence check but before the rename.
        racing = folder / 'racing-release'
        def introduce_race(staged, destination):
            destination.mkdir()
            rename_dir_no_replace(staged, destination)
        with patch('atomic_release_publish.rename_dir_no_replace', side_effect=introduce_race):
            try:
                publish_verified_release(racing, apk, aab, '1.0.67')
                assert False, 'Publication replaced a concurrently-created release directory'
            except RuntimeError as exc:
                assert 'destination' in str(exc).lower()
        assert racing.is_dir() and list(racing.iterdir()) == []
        assert not fresh.exists()
        assert not list(folder.glob('.thornhaven-release-pending-*'))
    print('PASS: paired atomic publication, idempotent rerun, conflict refusal, symlink guard, exact file set, empty-directory race rejection, staging failure cleanup')
    print('NOTE: synthetic files only; no signing keys or physical device used')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Reject ambiguous CI payload/private backup ZIPs before extracting signing inputs.

Synthetic archives only: this does not read any real signing credentials, sign
an Android package, or operate on a device.
"""
import importlib.util
from pathlib import Path
import sys
import tempfile
import warnings
import zipfile

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('thornhaven_ci_signer', TOOLS / 'sign-ci-payload.py')
signer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signer)


def make_archive(path, entries):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, payload in entries:
                archive.writestr(name, payload)


def check_failure(root, label, entries, selected, message):
    archive = root / (label.replace(' ', '-') + '.zip')
    dest = root / (label.replace(' ', '-') + '-extracted')
    dest.mkdir()
    make_archive(archive, entries)
    try:
        signer.extract_selected(archive, dest, selected)
    except RuntimeError as error:
        if message not in str(error):
            raise AssertionError(f'{label}: unexpected failure {error!r}') from error
    else:
        raise AssertionError(f'{label}: ambiguous archive accepted')
    if list(dest.rglob('*')):
        raise AssertionError(f'{label}: partial files extracted before rejection')
    print('PASS:', label)


def main():
    with tempfile.TemporaryDirectory(prefix='thornhaven-ci-archive-fixtures-') as temp:
        root = Path(temp)
        archive = root / 'valid.zip'
        output = root / 'valid-extracted'
        output.mkdir()
        selected = ('app-release-unsigned.apk', 'tools/apksigner')
        normal = [
            (selected[0], b'synthetic unsigned APK; not installable'),
            (selected[1], b'synthetic signing utility; not executable'),
            ('SHA256SUMS.txt', b'auxiliary metadata'),
        ]
        make_archive(archive, normal)
        signer.extract_selected(archive, output, selected)
        assert (output / selected[0]).read_bytes() == normal[0][1]
        assert (output / selected[1]).read_bytes() == normal[1][1]
        assert (output / selected[0]).stat().st_mode & 0o777 == 0o600
        assert (output / selected[1]).stat().st_mode & 0o777 == 0o700
        print('PASS: unambiguous CI artifact extracts only requested files')

        check_failure(root, 'duplicate APK payload',
                      normal + [(selected[0], normal[0][1])],
                      selected, 'duplicate entries')
        check_failure(root, 'conflicting duplicate APK payload',
                      normal + [(selected[0], b'different APK bytes')],
                      selected, 'duplicate entries')
        check_failure(root, 'duplicate unselected metadata',
                      normal + [('SHA256SUMS.txt', b'other metadata')],
                      selected, 'duplicate entries')
        check_failure(root, 'missing signing tool',
                      [normal[0], normal[2]], selected,
                      'missing required entries')
        check_failure(root, 'requested directory instead of file',
                      [(selected[0] + '/', b''), normal[1]],
                      (selected[0] + '/', selected[1]), 'is a directory')

        # The original signing backup must be even stricter: duplicates cannot
        # select an arbitrary keystore or properties file as the last ZIP entry.
        backup_names = ('signing.properties', 'vaelbrink-maintained.jks')
        dummy_backup = [(backup_names[0], b'not secret fixture properties'),
                        (backup_names[1], b'not a real keystore')]
        check_failure(root, 'duplicate archived keystore',
                      dummy_backup + [(backup_names[1], b'other dummy bytes')],
                      backup_names, 'duplicate entries')
        check_failure(root, 'missing archived properties',
                      [dummy_backup[1]], backup_names,
                      'missing required entries')
    print('PASS: offline signer CI artifact/backup extraction is fail-closed')
    print('NOT TESTED: real keystore, AAB/APK signing, physical device or Google Play')


if __name__ == '__main__':
    main()

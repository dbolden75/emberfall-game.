#!/usr/bin/env python3
"""Read-only upgrade preflight fail-closed regression tests; no adb device needed."""
import importlib.util
import pathlib
import unittest

modpath = pathlib.Path(__file__).with_name('android-upgrade-preflight.py')
spec = importlib.util.spec_from_file_location('upgrade_preflight', modpath)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class PreflightTests(unittest.TestCase):
    CERT = preflight.EXPECTED_RELEASE_SIGNER
    OTHER_CERT = 'f' * 64

    @staticmethod
    def info(code, pkg=preflight.PACKAGE):
        return f"package: name='{pkg}' versionCode='{code}' versionName='1.0.{code}'\n"

    @staticmethod
    def cert(digest):
        return f'Signer #1 certificate DN: CN=Thornhaven\nSigner #1 certificate SHA-256 digest: {digest}\n'

    def verify(self, old=157, new=169, current_cert=None, target_cert=None, current_pkg=None, target_pkg=None):
        return preflight.validate_pair(
            self.info(old, current_pkg or preflight.PACKAGE),
            self.cert(current_cert or self.CERT),
            self.info(new, target_pkg or preflight.PACKAGE),
            self.cert(target_cert or self.CERT))

    def test_valid_in_place_candidate(self):
        self.assertEqual(self.verify(), (157, 169))

    def test_play_app_signing_mismatch_fails_closed(self):
        with self.assertRaisesRegex(preflight.PreflightError, 'Installed signer differs'):
            self.verify(current_cert=self.OTHER_CERT)

    def test_bad_candidate_signer_fails_closed(self):
        with self.assertRaisesRegex(preflight.PreflightError, 'Candidate is not signed'):
            self.verify(target_cert=self.OTHER_CERT)

    def test_wrong_package_fails_closed(self):
        for key in ('current_pkg', 'target_pkg'):
            with self.subTest(key=key), self.assertRaisesRegex(preflight.PreflightError, 'Package identity'):
                self.verify(**{key: 'com.example.notthornhaven'})

    def test_downgrade_and_same_version_rejected(self):
        for version in (157, 156):
            with self.subTest(version=version), self.assertRaisesRegex(preflight.PreflightError, 'not newer'):
                self.verify(new=version)

    def test_missing_or_multiple_signers_rejected(self):
        with self.assertRaisesRegex(preflight.PreflightError, 'exactly one'):
            preflight.parse_certificates('no signer')
        with self.assertRaisesRegex(preflight.PreflightError, 'exactly one'):
            preflight.parse_certificates(self.cert(self.CERT) + self.cert(self.OTHER_CERT).replace('Signer #1','Signer #2'))

    def test_invalid_badging_fails_closed(self):
        with self.assertRaises(preflight.PreflightError):
            preflight.parse_badging('versionCode: 169')

    def test_single_or_split_package_base(self):
        self.assertEqual(preflight.parse_installed_base('package:/data/app/org/base.apk\npackage:/data/app/org/split_config.arm64_v8a.apk\n'), '/data/app/org/base.apk')
        self.assertEqual(preflight.parse_installed_base('package:/data/app/org/base.apk\n'), '/data/app/org/base.apk')
        with self.assertRaises(preflight.PreflightError):
            preflight.parse_installed_base('package:/data/app/org/split_config.arm64_v8a.apk\npackage:/data/app/org/other.apk\n')



# Full CLI dispatch rehearsal: mocks adb/aapt/apksigner and therefore never
# accesses a physical phone. Protect against accidentally destructive adb
# commands or false PASS outcomes when Play signers and local copies differ.
import contextlib
import io
import tempfile
from unittest import mock


class UpgradePreflightCliTests(unittest.TestCase):
    def exercise_cli(self, *, bad_candidate=False, bad_installed=False,
                     ambiguous_path=False, pull_fails=False):
        with tempfile.TemporaryDirectory() as tmp:
            candidate = pathlib.Path(tmp) / 'candidate.apk'
            candidate.write_bytes(b'mocked-candidate')
            calls = []

            def fake_command(args):
                calls.append(tuple(args))
                if args[0] == 'aapt':
                    code = 169 if str(candidate) == args[-1] else 159
                    return f"package: name='{preflight.PACKAGE}' versionCode='{code}' versionName='1.0.67'\n"
                if args[0] == 'apksigner':
                    wrong = ((bad_candidate and str(candidate) == args[-1])
                             or (bad_installed and args[-1] != str(candidate)))
                    digest = 'f' * 64 if wrong else preflight.EXPECTED_RELEASE_SIGNER
                    return f'Signer #1 certificate SHA-256 digest: {digest}\n'
                if args[0] == 'adb' and args[1:4] == ['-s', 'mock-serial', 'shell']:
                    if ambiguous_path:
                        return 'package:/data/app/test/split_config.apk\npackage:/data/app/test/split_en.apk\n'
                    return 'package:/data/app/test/base.apk\npackage:/data/app/test/split_config.apk\n'
                if args[0] == 'adb' and args[1:4] == ['-s', 'mock-serial', 'pull']:
                    if pull_fails:
                        raise preflight.PreflightError('Read-only installed APK copy failed')
                    return '1 file pulled'
                raise AssertionError(f'Unexpected external command: {args!r}')

            stdout, stderr = io.StringIO(), io.StringIO()
            with mock.patch.object(preflight, 'command', side_effect=fake_command), \
                 contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                result = preflight.main([str(candidate), '--serial', 'mock-serial'])
            for args in calls:
                if args[0] == 'adb':
                    self.assertEqual(args[1:3], ('-s', 'mock-serial'))
                    self.assertIn(args[3], ('shell', 'pull'))
                    self.assertNotIn('install', args)
                    self.assertNotIn('uninstall', args)
                    self.assertNotIn('clear', args)
            return result, calls, stdout.getvalue(), stderr.getvalue()

    def test_cli_good_sideload_preflight_uses_only_read_commands(self):
        result, calls, out, err = self.exercise_cli()
        self.assertEqual(result, 0, err)
        self.assertIn('NO UPDATE PERFORMED', out)
        self.assertEqual(sum('pull' in cmd for cmd in calls), 1)

    def test_cli_bad_candidate_rejected_before_device_access(self):
        result, calls, out, err = self.exercise_cli(bad_candidate=True)
        self.assertEqual(result, 1)
        self.assertIn('Candidate has incorrect package or signing certificate', err)
        self.assertFalse(any(cmd[0] == 'adb' for cmd in calls))

    def test_cli_play_signer_mismatch_blocks_without_mutation(self):
        result, calls, out, err = self.exercise_cli(bad_installed=True)
        self.assertEqual(result, 1)
        self.assertIn('Installed signer differs', err)
        self.assertEqual(sum('pull' in cmd for cmd in calls), 1)

    def test_cli_ambiguous_install_paths_block_before_pull(self):
        result, calls, out, err = self.exercise_cli(ambiguous_path=True)
        self.assertEqual(result, 1)
        self.assertIn('Could not uniquely locate', err)
        self.assertFalse(any('pull' in cmd for cmd in calls))

    def test_cli_pull_failure_never_claims_success(self):
        result, calls, out, err = self.exercise_cli(pull_fails=True)
        self.assertEqual(result, 1)
        self.assertIn('Read-only installed APK copy failed', err)
        self.assertNotIn('PASS:', out)


if __name__ == '__main__':
    unittest.main(verbosity=2)

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
                     ambiguous_path=False, pull_fails=False,
                     missing_v2=False, missing_v3=False, debuggable=False,
                     test_only=False, device_sdk='35'):
        with tempfile.TemporaryDirectory() as tmp:
            candidate = pathlib.Path(tmp) / 'candidate.apk'
            candidate.write_bytes(b'mocked-candidate')
            calls = []

            def fake_command(args):
                calls.append(tuple(args))
                if args[0] == 'aapt':
                    code = 169 if str(candidate) == args[-1] else 159
                    extra = ''
                    if str(candidate) == args[-1]:
                        if debuggable:
                            extra += 'application-debuggable\n'
                        if test_only:
                            extra += 'application-testOnly\n'
                    return (f"package: name='{preflight.PACKAGE}' versionCode='{code}' "
                            "versionName='1.0.67'\nsdkVersion:'24'\n" + extra)
                if args[0] == 'apksigner':
                    is_candidate = str(candidate) == args[-1]
                    wrong = ((bad_candidate and is_candidate)
                             or (bad_installed and not is_candidate))
                    digest = 'f' * 64 if wrong else preflight.EXPECTED_RELEASE_SIGNER
                    v2 = 'false' if is_candidate and missing_v2 else 'true'
                    v3 = 'false' if is_candidate and missing_v3 else 'true'
                    return (f'Verified using v2 scheme (APK Signature Scheme v2): {v2}\n'
                            f'Verified using v3 scheme (APK Signature Scheme v3): {v3}\n'
                            f'Signer #1 certificate SHA-256 digest: {digest}\n')
                if args[0] == 'adb' and args[1:4] == ['-s', 'mock-serial', 'shell']:
                    if args[4:] == ['getprop', 'ro.build.version.sdk']:
                        return device_sdk
                    if args[4:] == ['pm', 'path', preflight.PACKAGE]:
                        if ambiguous_path:
                            return ('package:/data/app/test/split_config.apk\n'
                                    'package:/data/app/test/split_en.apk\n')
                        return ('package:/data/app/test/base.apk\n'
                                'package:/data/app/test/split_config.apk\n')
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


    def test_cli_unsigned_v2_or_v3_candidate_blocked_before_device_access(self):
        for key in ('missing_v2', 'missing_v3'):
            with self.subTest(key=key):
                result, calls, out, err = self.exercise_cli(**{key: True})
                self.assertEqual(result, 1)
                self.assertIn('does not verify with Android', err)
                self.assertNotIn('PASS:', out)
                self.assertFalse(any(cmd[0] == 'adb' for cmd in calls))

    def test_cli_debug_or_test_only_candidate_blocked_before_device_access(self):
        for key in ('debuggable', 'test_only'):
            with self.subTest(key=key):
                result, calls, out, err = self.exercise_cli(**{key: True})
                self.assertEqual(result, 1)
                self.assertIn('not a release APK', err)
                self.assertNotIn('PASS:', out)
                self.assertFalse(any(cmd[0] == 'adb' for cmd in calls))

    def test_cli_too_old_android_device_blocked_before_installed_apk_pull(self):
        result, calls, out, err = self.exercise_cli(device_sdk='23')
        self.assertEqual(result, 1)
        self.assertIn('Candidate requires Android API 24', err)
        self.assertNotIn('PASS:', out)
        self.assertFalse(any('pull' in cmd for cmd in calls))

    def test_cli_invalid_android_sdk_response_blocks(self):
        result, calls, out, err = self.exercise_cli(device_sdk='unknown')
        self.assertEqual(result, 1)
        self.assertIn('Could not identify device Android SDK', err)
        self.assertNotIn('PASS:', out)
        self.assertFalse(any('pull' in cmd for cmd in calls))


class ReleaseCandidateValidationTests(unittest.TestCase):
    def report(self, v2='true', v3='true'):
        return (f'Verified using v2 scheme (APK Signature Scheme v2): {v2}\n'
                f'Verified using v3 scheme (APK Signature Scheme v3): {v3}\n'
                f'Signer #1 certificate SHA-256 digest: {preflight.EXPECTED_RELEASE_SIGNER}\n')

    def badge(self, extra=''):
        return (f"package: name='{preflight.PACKAGE}' versionCode='169' "
                "versionName='1.0.67'\nsdkVersion:'24'\n" + extra)

    def test_valid_release_metadata(self):
        self.assertEqual(preflight.validate_release_candidate(self.badge(), self.report()),
                         (169, 24))

    def test_missing_or_ambiguous_minimum_sdk_rejected(self):
        for bad in (self.badge().replace("sdkVersion:'24'\n", ''),
                    self.badge("sdkVersion:'27'\n")):
            with self.subTest(bad=bad), self.assertRaisesRegex(
                    preflight.PreflightError, 'minimum Android SDK'):
                preflight.validate_release_candidate(bad, self.report())

    def test_duplicate_package_identity_rejected(self):
        with self.assertRaisesRegex(preflight.PreflightError, 'uniquely identify'):
            preflight.validate_release_candidate(self.badge() + self.badge(), self.report())




# The older Bash operator entry point must use the same audited implementation
# as the Python CLI. Mock only the Python executable: no adb/SDK or device used.
import os
import subprocess
import json


class LegacyWrapperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.candidate = self.root / 'safe candidate.apk'
        self.candidate.write_bytes(b'fixture: not installed')
        self.mock_python = self.root / 'fake-python'
        self.mock_python.write_text('#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n')
        self.mock_python.chmod(0o700)

    def run_wrapper(self, candidate=None, **kwargs):
        env = {**os.environ, 'PYTHON_BIN': str(self.mock_python)}
        for name in ('ADB_BIN', 'AAPT_BIN', 'APKSIGNER_BIN', 'ADB_SERIAL'):
            env.pop(name, None)
        env.update(kwargs)
        return subprocess.run(['bash', str(modpath.with_name('maintained-upgrade-preflight.sh')),
                               str(candidate or self.candidate)],
                              text=True, capture_output=True, env=env, check=False)

    def test_delegates_to_readonly_python_preflight(self):
        proc = self.run_wrapper()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        args = json.loads(proc.stdout)
        self.assertEqual(pathlib.Path(args[0]).name, 'android-upgrade-preflight.py')
        self.assertEqual(args[1:], [str(self.candidate), '--adb', 'adb', '--aapt',
                                    'aapt', '--apksigner', 'apksigner'])
        self.assertFalse(any(a in ('install', 'uninstall', 'clear') for a in args))

    def test_explicit_device_and_sdk_paths_passed_through(self):
        proc = self.run_wrapper(ADB_BIN='/opt/sdk/adb', AAPT_BIN='/opt/sdk/aapt',
                                APKSIGNER_BIN='/opt/sdk/apksigner', ADB_SERIAL='device-A')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        args = json.loads(proc.stdout)
        self.assertEqual(args[-8:], ['--adb', '/opt/sdk/adb', '--aapt', '/opt/sdk/aapt',
                                     '--apksigner', '/opt/sdk/apksigner', '--serial', 'device-A'])

    def test_invalid_inputs_rejected_before_any_device_interaction(self):
        for filename, data in (('missing.apk', None), ('empty.apk', b''), ('wrong.aab', b'abc')):
            with self.subTest(filename=filename):
                candidate = self.root / filename
                if data is not None:
                    candidate.write_bytes(data)
                proc = self.run_wrapper(candidate)
                self.assertEqual(proc.returncode, 2)
                self.assertIn('Usage:', proc.stderr)
                self.assertNotIn('android-upgrade-preflight.py', proc.stdout)



class InstalledBaseStrictnessTests(unittest.TestCase):
    def test_single_split_only_path_does_not_masquerade_as_base(self):
        with self.assertRaisesRegex(preflight.PreflightError, 'installed base APK'):
            preflight.parse_installed_base(
                'package:/data/app/org/split_config.arm64_v8a.apk\\n')


class CommandTimeoutTests(unittest.TestCase):
    def test_unresponsive_adb_metadata_fails_closed(self):
        with mock.patch.object(preflight.subprocess, 'run',
                               side_effect=preflight.subprocess.TimeoutExpired('adb', 60)) as runner:
            with self.assertRaisesRegex(preflight.PreflightError, 'Timed out running adb after 60s'):
                preflight.command(['adb', 'shell', 'getprop', 'ro.build.version.sdk'])
            self.assertEqual(runner.call_args.kwargs['timeout'], 60)

    def test_large_installed_base_copy_uses_longer_bounded_timeout(self):
        with mock.patch.object(preflight.subprocess, 'run',
                               side_effect=preflight.subprocess.TimeoutExpired('adb', 240)) as runner:
            with self.assertRaisesRegex(preflight.PreflightError, 'Timed out running adb after 240s'):
                preflight.command(['adb', '-s', 'mock', 'pull',
                                   '/data/app/base.apk', '/tmp/installed-base.apk'])
            self.assertEqual(runner.call_args.kwargs['timeout'], 240)


if __name__ == '__main__':
    unittest.main(verbosity=2)

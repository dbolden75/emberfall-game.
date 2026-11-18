#!/usr/bin/env python3
"""Negative regressions for the compiled APK Play Billing manifest release gate."""
import importlib.util
import unittest
from unittest import mock
from pathlib import Path

script = Path(__file__).with_name('check-android-billing-manifest.py')
spec = importlib.util.spec_from_file_location('billing_manifest_gate', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    return [
        ('manifest', {'package': module.PACKAGE, 'versionCode': 171, 'versionName': '1.0.69'}),
        ('manifest/uses-sdk', {'minSdkVersion': 24, 'targetSdkVersion': 36}),
        ('manifest/application', {'allowBackup': False}),
        ('manifest/uses-permission', {'name': module.BILLING_PERMISSION}),
        ('manifest/queries/intent/action', {'name': module.BILLING_QUERY}),
        ('manifest/application/activity', {'name': module.MAIN, 'exported': True}),
        ('manifest/application/activity', {'name': module.PROXY, 'exported': False}),
        ('manifest/application/activity', {'name': module.PROXY_V2, 'exported': False}),
        ('manifest/application/receiver', {'name': module.PROFILE_RECEIVER, 'exported': True, 'permission': module.PROFILE_PERMISSION}),
    ]


class BinaryManifestGateTests(unittest.TestCase):
    def test_expected_manifest(self):
        self.assertEqual(module.validate(fixture(), 171), [])

    def test_installation_and_version_identity_fail_closed(self):
        for key, value in [('package', 'another.app'), ('versionCode', 169)]:
            with self.subTest(key=key):
                data = fixture()
                data[0][1][key] = value
                self.assertTrue(module.validate(data, 171))

    def test_release_version_name_is_pinned(self):
        for name in ('1.0.68', '1.0.70', '', None):
            with self.subTest(name=name):
                data = fixture()
                data[0][1]['versionName'] = name
                self.assertTrue(any('versionName' in issue for issue in module.validate(data, 171)))

    def test_unexpected_exported_components_are_blocked(self):
        for kind in ('activity', 'activity-alias', 'service', 'receiver', 'provider'):
            for flag in (True, None, 1, 'true'):
                with self.subTest(kind=kind, flag=flag):
                    data = fixture()
                    data.append((f'manifest/application/{kind}', {
                        'name': 'com.example.UnexpectedComponent', 'exported': flag
                    }))
                    self.assertTrue(any('unprotected exported' in issue
                                        for issue in module.validate(data, 171)))
        for kind in ('service', 'receiver', 'provider', 'activity-alias'):
            with self.subTest(kind=kind):
                data = fixture()
                data.append((f'manifest/application/{kind}', {
                    'name': 'com.example.SafeComponent', 'exported': False
                }))
                self.assertEqual(module.validate(data, 171), [])

    def test_profile_receiver_must_remain_platform_permission_protected(self):
        for permission in (None, '', 'com.example.DUMP'):
            with self.subTest(permission=permission):
                data = fixture()
                data[-1][1]['permission'] = permission
                self.assertTrue(any('unprotected exported' in issue
                                    for issue in module.validate(data, 171)))

    def test_backup_flag_and_sdk_levels_fail_closed(self):
        for entry, key, value in [(2, 'allowBackup', True), (1, 'minSdkVersion', 23), (1, 'targetSdkVersion', 35)]:
            with self.subTest(key=key):
                data = fixture()
                data[entry][1][key] = value
                self.assertTrue(module.validate(data, 171))

    def test_debuggable_or_test_only_release_is_rejected(self):
        # The release package must never ship as an inspectable or test-only build.
        for flag in ('debuggable', 'testOnly'):
            for value in (True, 1, 'true'):
                with self.subTest(flag=flag, value=value):
                    data = fixture()
                    data[2][1][flag] = value
                    self.assertTrue(any('debuggable or testOnly' in issue
                                        for issue in module.validate(data, 171)))
            with self.subTest(flag=flag, value=False):
                data = fixture()
                data[2][1][flag] = False
                self.assertEqual(module.validate(data, 171), [])

    def test_duplicate_application_node_fails_closed(self):
        data = fixture()
        data.append(('manifest/application', {'allowBackup': False}))
        self.assertTrue(any('debuggable or testOnly' in issue
                            for issue in module.validate(data, 171)))

    def test_missing_billing_permission_and_service_visibility_fail(self):
        for path, name in [('manifest/uses-permission', module.BILLING_PERMISSION),
                           ('manifest/queries/intent/action', module.BILLING_QUERY)]:
            with self.subTest(name=name):
                data = [x for x in fixture() if not (x[0] == path and x[1]['name'] == name)]
                self.assertTrue(module.validate(data, 171))

    def test_missing_or_exported_billing_proxies_fail(self):
        for name in (module.PROXY, module.PROXY_V2):
            with self.subTest(name=name):
                data = [x for x in fixture() if x[1].get('name') != name]
                self.assertTrue(module.validate(data, 171))
                data = fixture()
                next(attrs for path, attrs in data if attrs.get('name') == name)['exported'] = True
                self.assertTrue(module.validate(data, 171))

    def test_current_release_manifest_gate_tracks_android_version(self):
        gradle = (script.parent.parent / 'app' / 'build.gradle').read_text()
        self.assertIn('versionCode 171', gradle)
        self.assertIn("versionName '1.0.69'", gradle)
        self.assertEqual(module.validate(fixture(), 171), [])
        # Accepting 169 by default would incorrectly validate a superseded APK.
        self.assertTrue(module.validate(fixture(), 169))

    def test_version_code_must_be_explicit_in_cli_and_python_api(self):
        with self.assertRaises(TypeError):
            module.validate(fixture())
        with mock.patch('sys.argv', [
            'check-android-billing-manifest.py', '--apk', 'unused.apk'
        ]):
            with self.assertRaises(SystemExit) as error:
                module.main()
        self.assertEqual(error.exception.code, 2)

    def test_malformed_axml_rejected(self):
        for raw in (b'', b'<manifest/>', bytes(32)):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    module.parse_manifest(raw)


if __name__ == '__main__':
    unittest.main()

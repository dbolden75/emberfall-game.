#!/usr/bin/env python3
"""Negative regressions for the compiled APK Play Billing manifest release gate."""
import importlib.util
import unittest
from pathlib import Path

script = Path(__file__).with_name('check-android-billing-manifest.py')
spec = importlib.util.spec_from_file_location('billing_manifest_gate', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    return [
        ('manifest', {'package': module.PACKAGE, 'versionCode': 169}),
        ('manifest/uses-sdk', {'minSdkVersion': 24, 'targetSdkVersion': 36}),
        ('manifest/application', {'allowBackup': False}),
        ('manifest/uses-permission', {'name': module.BILLING_PERMISSION}),
        ('manifest/queries/intent/action', {'name': module.BILLING_QUERY}),
        ('manifest/application/activity', {'name': module.MAIN, 'exported': True}),
        ('manifest/application/activity', {'name': module.PROXY, 'exported': False}),
        ('manifest/application/activity', {'name': module.PROXY_V2, 'exported': False}),
    ]


class BinaryManifestGateTests(unittest.TestCase):
    def test_expected_manifest(self):
        self.assertEqual(module.validate(fixture(), 169), [])

    def test_installation_and_version_identity_fail_closed(self):
        for key, value in [('package', 'another.app'), ('versionCode', 168)]:
            with self.subTest(key=key):
                data = fixture()
                data[0][1][key] = value
                self.assertTrue(module.validate(data, 169))

    def test_backup_flag_and_sdk_levels_fail_closed(self):
        for entry, key, value in [(2, 'allowBackup', True), (1, 'minSdkVersion', 23), (1, 'targetSdkVersion', 35)]:
            with self.subTest(key=key):
                data = fixture()
                data[entry][1][key] = value
                self.assertTrue(module.validate(data, 169))

    def test_missing_billing_permission_and_service_visibility_fail(self):
        for path, name in [('manifest/uses-permission', module.BILLING_PERMISSION),
                           ('manifest/queries/intent/action', module.BILLING_QUERY)]:
            with self.subTest(name=name):
                data = [x for x in fixture() if not (x[0] == path and x[1]['name'] == name)]
                self.assertTrue(module.validate(data, 169))

    def test_missing_or_exported_billing_proxies_fail(self):
        for name in (module.PROXY, module.PROXY_V2):
            with self.subTest(name=name):
                data = [x for x in fixture() if x[1].get('name') != name]
                self.assertTrue(module.validate(data, 169))
                data = fixture()
                next(attrs for path, attrs in data if attrs.get('name') == name)['exported'] = True
                self.assertTrue(module.validate(data, 169))

    def test_malformed_axml_rejected(self):
        for raw in (b'', b'<manifest/>', bytes(32)):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    module.parse_manifest(raw)


if __name__ == '__main__':
    unittest.main()

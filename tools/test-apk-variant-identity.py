#!/usr/bin/env python3
"""Manifest-policy regressions, not APK installation tests."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('identity', Path(__file__).with_name('check-apk-variant-identity.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def fixture(variant):
    return [('manifest', {'package': gate.DEBUG if variant == 'debug' else gate.PRODUCTION,
                          'versionCode': 169, 'versionName': '1.0.67'}),
            ('manifest/application', {'debuggable': variant == 'debug'})]


def label(variant):
    return "application-label:'" + (gate.QA_LABEL if variant == 'debug' else 'Thornhaven: New Journey') + "'\n"


class IdentityTests(unittest.TestCase):
    def test_expected_variants(self):
        for variant in ('debug', 'release'):
            gate.validate(fixture(variant), label(variant), variant, 169, '1.0.67')

    def test_historical_production_package_debug_rejected(self):
        nodes = fixture('debug')
        nodes[0][1]['package'] = gate.PRODUCTION
        for mode in ('debug', 'release'):
            with self.assertRaises(ValueError):
                gate.validate(nodes, label(mode), mode, 169, '1.0.67')

    def test_wrong_package_version_flags_and_ambiguous_manifest(self):
        for variant in ('debug', 'release'):
            for index, field, value in [(0, 'package', 'another.app'), (0, 'versionCode', 170),
                                        (0, 'versionName', 'wrong'), (1, 'testOnly', True),
                                        (1, 'debuggable', variant != 'debug')]:
                with self.subTest(variant=variant, field=field):
                    nodes = fixture(variant)
                    nodes[index][1][field] = value
                    with self.assertRaises(ValueError):
                        gate.validate(nodes, label(variant), variant, 169, '1.0.67')
            for nodes in ([], fixture(variant) * 2):
                with self.assertRaises(ValueError):
                    gate.validate(nodes, label(variant), variant, 169, '1.0.67')

    def test_missing_or_misleading_localized_qa_label_rejected(self):
        for badging in ('', label('release'), label('debug') + "application-label-en:'Thornhaven'\n"):
            with self.assertRaises(ValueError):
                gate.validate(fixture('debug'), badging, 'debug', 169, '1.0.67')

    def test_absent_release_flags_are_false(self):
        nodes = fixture('release')
        nodes[1][1].clear()
        gate.validate(nodes, label('release'), 'release', 169, '1.0.67')


if __name__ == '__main__':
    unittest.main()

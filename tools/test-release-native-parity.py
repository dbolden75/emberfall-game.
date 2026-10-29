#!/usr/bin/env python3
"""Attack/compatibility regression cases for release-native-parity.py."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('parity', Path(__file__).with_name('release-native-parity.py'))
parity = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parity)

VCS_A = b'repositories {\n  system: GIT\n  local_root_path: "$PROJECT_DIR"\n  revision: "' + b'a' * 40 + b'"\n}\n'
VCS_B = VCS_A.replace(b'a' * 40, b'b' * 40)


class SignedPayloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='thornhaven-test-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def pair(self, *, prefix='APK', mutate=None, missing=None, extra=None, vcs=VCS_A, unsigned_vcs=VCS_A, signatures=True):
        revision = parity.VCS_APK if prefix == 'APK' else parity.VCS_AAB
        entries = {'classes.dex': b'actual-native-code',
                   'assets/index.html': b'the game', revision: unsigned_vcs}
        signed_entries = {**entries, revision: vcs}
        if missing:
            del signed_entries[missing]
        if mutate:
            signed_entries[mutate] = b'not-original-content'
        if extra:
            signed_entries[extra] = b'unexpected'
        if signatures:
            signed_entries.update({'META-INF/MANIFEST.MF': b'Manifest-Version: 1.0\n',
                                   'META-INF/VAELBRIN.SF': b'signature-file',
                                   'META-INF/VAELBRIN.RSA': b'signature-container'})
        unsigned = self.dir / ('unsigned-' + prefix + '.zip')
        signed = self.dir / ('signed-' + prefix + '.zip')
        for path, payload in ((unsigned, entries), (signed, signed_entries)):
            with zipfile.ZipFile(path, 'w') as archive:
                for name, data in payload.items():
                    archive.writestr(name, data)
        return signed, unsigned

    def test_exact_parity_apk_and_aab(self):
        for prefix in ('APK', 'AAB'):
            with self.subTest(prefix=prefix):
                self.assertEqual(parity.compare(*self.pair(prefix=prefix), prefix, False)[:2], (3, 3))

    def test_altered_native_code_rejected(self):
        with self.assertRaisesRegex(ValueError, 'classes.dex'):
            parity.compare(*self.pair(mutate='classes.dex'), 'APK', False)

    def test_missing_game_asset_rejected(self):
        with self.assertRaisesRegex(ValueError, 'lost original entries'):
            parity.compare(*self.pair(missing='assets/index.html'), 'APK', False)

    def test_unknown_injected_file_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unexpected new'):
            parity.compare(*self.pair(extra='assets/secret.js'), 'APK', False)

    def test_v2_v3_apk_without_jar_signatures(self):
        # Real maintained-key 1.0.64 APKs have v2/v3 signing blocks,
        # which are outside the ZIP entry table.
        signed, unsigned = self.pair(prefix='APK', signatures=False)
        self.assertEqual(parity.compare(signed, unsigned, 'APK', False)[:2], (3, 0))

    def test_partial_v1_apk_jar_signatures_rejected(self):
        with self.assertRaisesRegex(ValueError, 'signing entries absent'):
            parity.compare(*self.pair(prefix='APK', signatures=False,
                                      extra='META-INF/VAELBRIN.SF'), 'APK', False)

    def test_missing_aab_jar_signatures_rejected(self):
        with self.assertRaisesRegex(ValueError, 'signing entries absent'):
            parity.compare(*self.pair(prefix='AAB', signatures=False), 'AAB', False)

    def test_vcs_revision_only_diff_requires_explicit_opt_in(self):
        pair = self.pair(vcs=VCS_B)
        with self.assertRaisesRegex(ValueError, 'version-control-info'):
            parity.compare(*pair, 'APK', False)
        self.assertEqual(len(parity.compare(*pair, 'APK', True)[2]), 1)

    def test_changed_vcs_structure_rejected_despite_opt_in(self):
        pair = self.pair(vcs=VCS_B.replace(b'system: GIT', b'system: NOTGIT'))
        with self.assertRaisesRegex(ValueError, 'version-control-info'):
            parity.compare(*pair, 'APK', True)


if __name__ == '__main__':
    unittest.main(verbosity=2)

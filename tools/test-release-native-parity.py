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

    def test_both_signing_flows_enforce_16k_alignment(self):
        base = Path(__file__).resolve().parents[1]
        offline = (base / 'tools/sign-ci-payload.py').read_text()
        workflow = (base / '.github/workflows/thornhaven-release.yml').read_text()
        self.assertIn("check_run([zipalign, '-P', '16', '-f', '4',", offline)
        self.assertIn("check_run([zipalign, '-c', '-P', '16', '4',", offline)
        self.assertIn('zipalign" -P 16 -f 4', workflow)
        self.assertIn('zipalign" -c -P 16 4', workflow)

    def test_offline_aab_requires_one_matching_certificate(self):
        spec = importlib.util.spec_from_file_location(
            'offline_sign', Path(__file__).with_name('sign-ci-payload.py'))
        signer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(signer)
        fingerprint = ':'.join(signer.EXPECTED_CERT[i:i+2]
                               for i in range(0, len(signer.EXPECTED_CERT), 2)).upper()
        valid = 'Signer #1:\n    SHA256: ' + fingerprint + '\n'
        signer.verify_aab_signing_identity(valid)
        for invalid in ('', valid + 'Signer #2:\n',
                        valid.replace(fingerprint, 'AA' + fingerprint[2:]),
                        'Signer #1:\n    SHA256: NOT-A-FINGERPRINT\n'):
            with self.subTest(invalid=invalid[:32]):
                with self.assertRaisesRegex(RuntimeError, 'AAB maintained-key'):
                    signer.verify_aab_signing_identity(invalid)

    def test_offline_signer_compares_every_game_asset(self):
        # In-memory miniature APK/AAB archives: no keystore or device involved.
        spec = importlib.util.spec_from_file_location(
            'offline_sign_asset_parity', Path(__file__).with_name('sign-ci-payload.py'))
        signer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(signer)

        assets = {'index.html': b'game',
                  'purchase-api.js': b'checkout bridge',
                  'art/map.webp': b'map pixels'}

        def verify(label, apk_assets, aab_assets, *, baseline=False):
            apk_path = self.dir / (label + '-apk.zip')
            aab_path = self.dir / (label + '-aab.zip')
            with zipfile.ZipFile(apk_path, 'w') as archive:
                for name, data in apk_assets.items():
                    archive.writestr('assets/' + name, data)
                if baseline:
                    archive.writestr('assets/dexopt/baseline.prof', b'android metadata')
            with zipfile.ZipFile(aab_path, 'w') as archive:
                for name, data in aab_assets.items():
                    archive.writestr('base/assets/' + name, data)
            with zipfile.ZipFile(apk_path) as apk, zipfile.ZipFile(aab_path) as aab:
                return signer.verify_cross_package_assets(apk, aab)

        self.assertEqual(verify('matching', assets, assets, baseline=True), 3)
        with self.assertRaisesRegex(RuntimeError, 'content mismatch: purchase-api.js'):
            verify('tampered-js', assets, {**assets, 'purchase-api.js': b'stale checkout bridge'})
        with self.assertRaisesRegex(RuntimeError, 'manifest mismatch'):
            verify('missing-art', assets, {k: v for k, v in assets.items() if k != 'art/map.webp'})
        with self.assertRaisesRegex(RuntimeError, 'manifest mismatch'):
            verify('extra-aab-asset', assets, {**assets, 'art/unknown.webp': b'extra'})
        with self.assertRaisesRegex(RuntimeError, 'missing index.html'):
            verify('missing-index', {k: v for k, v in assets.items() if k != 'index.html'}, assets)

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

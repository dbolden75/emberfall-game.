#!/usr/bin/env python3
"""Run the complete source/native regression set after restoring game assets.

Browser journeys and hosted Android packaging are separate checks. The report
records the tested commit and generated payload; tracked changes are refused.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYTHON_CHECKS = [
    'verify.py', 'verify-release-candidate-169.py',
    'test-release-instructions.py', 'test-android-upgrade-preflight.py',
    'test-offline-signing.py', 'test-play-bundle-signing.py',
    'test-aab-manifest-identity.py', 'test-android-billing-manifest.py',
    'test-bug-report-version.py', 'test-release-native-parity.py',
    'test_atomic_release_publish.py', 'test-ci-artifact-extraction.py',
    'test-release-payload-duplicates.py',
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'reports/quest-choice-regressions.json')
    args = parser.parse_args()
    subprocess.run(['git', 'diff', '--exit-code', 'HEAD'], cwd=ROOT, check=True)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    commands = [['node', str(p.relative_to(ROOT))] for p in sorted((ROOT / 'tools').glob('*checks.cjs'))]
    commands += [['python3', 'tools/' + p] for p in PYTHON_CHECKS]
    commands += [['node', p] for p in [
        'scripts/test-atlas-geography.cjs', 'scripts/test-world-map.cjs',
        'tools/native-billing-completion-test.cjs', 'tools/native-billing-delivery-test.cjs',
    ]]
    results = []
    with tempfile.TemporaryDirectory() as classes:
        for source, test in [('TrustedGameNavigation', 'TrustedGameNavigationTest'),
                             ('BillingSignature', 'BillingSignatureTest'),
                             ('BackupDocumentIntegrity', 'BackupDocumentIntegrityTest')]:
            commands += [['javac', '-d', classes, 'app/src/main/java/com/emberfall/ashvale/' + source + '.java', 'tools/' + test + '.java'],
                         ['java', '-cp', classes, 'com.emberfall.ashvale.' + test]]
        for command in commands:
            try:
                result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
                row = {'command': command, 'code': result.returncode, 'output': result.stdout + result.stderr}
            except OSError as error:
                row = {'command': command, 'code': 127, 'output': str(error)}
            results.append(row)
            if row['code']:
                print('FAIL:', ' '.join(command), flush=True)
    same_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip() == head
    clean = subprocess.run(['git', 'diff', '--quiet', 'HEAD'], cwd=ROOT).returncode == 0
    report = {'head': head, 'unchanged_tracked_tree': same_head and clean,
              'source_sha256': hashlib.sha256((ROOT / 'app/src/main/assets/index.html').read_bytes()).hexdigest(),
              'tests': results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    passed = sum(row['code'] == 0 for row in results)
    print(f'{head}: {passed}/{len(results)} passed; unchanged tracked tree: {same_head and clean}')
    return 0 if passed == len(results) and same_head and clean else 1

if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
"""Check a compiled APK before offering it as a debug or release artifact.

This checks manifest identity, not certificate trust or installation success.
Release signing/certificate verification remains a separate mandatory gate.
"""
import argparse
import importlib.util
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile

PRODUCTION = 'com.vaelbrink.ashvale.newjourney'
DEBUG = PRODUCTION + '.debug'
QA_LABEL = 'Thornhaven QA (Debug)'
spec = importlib.util.spec_from_file_location(
    'billing_manifest', Path(__file__).with_name('check-android-billing-manifest.py'))
manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manifest)


def validate(nodes, badging, variant, code, version):
    roots = [attrs for path, attrs in nodes if path == 'manifest']
    apps = [attrs for path, attrs in nodes if path == 'manifest/application']
    expected = DEBUG if variant == 'debug' else PRODUCTION
    if len(roots) != 1 or len(apps) != 1:
        raise ValueError('Expected one manifest and one application')
    root, app = roots[0], apps[0]
    if root.get('package') != expected:
        raise ValueError(f'{variant} APK must use {expected}')
    if root.get('versionCode') != code or root.get('versionName') != version:
        raise ValueError('APK version differs from app/build.gradle')
    if app.get('testOnly', False) is not False:
        raise ValueError('Do not offer testOnly APKs as installable artifacts')
    if app.get('debuggable', False) is not (variant == 'debug'):
        raise ValueError('Unexpected debuggable flag for APK variant')
    labels = re.findall(r"^application-label(?:-[^:]+)?:'(.*)'$", badging, re.M)
    expected_label = QA_LABEL if variant == 'debug' else 'Thornhaven: New Journey'
    if not labels or any(label != expected_label for label in labels):
        raise ValueError(f'{variant} APK must display {expected_label!r}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--variant', choices=['debug', 'release'], required=True)
    parser.add_argument('--gradle', type=Path, default=Path('app/build.gradle'))
    parser.add_argument('--aapt', required=True)
    args = parser.parse_args()
    source = args.gradle.read_text()
    code = int(re.search(r'\bversionCode\s+(\d+)', source)[1])
    version = re.search(r"\bversionName\s+'([^']+)'", source)[1]
    with ZipFile(args.apk) as archive:
        nodes = manifest.parse_manifest(archive.read('AndroidManifest.xml'))
    badging = subprocess.check_output([args.aapt, 'dump', 'badging', str(args.apk)], text=True)
    validate(nodes, badging, args.variant, code, version)
    print(f'PASS: compiled {args.variant} APK package, version, label and debug/testOnly flags')


if __name__ == '__main__':
    main()

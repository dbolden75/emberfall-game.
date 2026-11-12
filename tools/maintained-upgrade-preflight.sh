#!/usr/bin/env bash
# Compatibility entry point for the read-only Thornhaven upgrade preflight.
# Keep one source of truth for signature, package, Android SDK and saved-data
# protections. This script never installs, uninstalls or clears application data.
set -euo pipefail

if [[ $# -ne 1 || ! -s "$1" || "$1" != *.apk ]]; then
  echo 'Usage: bash tools/maintained-upgrade-preflight.sh /path/to/maintained-key.apk' >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
args=("$1" --adb "${ADB_BIN:-adb}" --aapt "${AAPT_BIN:-aapt}" --apksigner "${APKSIGNER_BIN:-apksigner}")
if [[ -n "${ADB_SERIAL:-}" ]]; then
  args+=(--serial "$ADB_SERIAL")
fi
exec "${PYTHON_BIN:-python3}" "$script_dir/android-upgrade-preflight.py" "${args[@]}"

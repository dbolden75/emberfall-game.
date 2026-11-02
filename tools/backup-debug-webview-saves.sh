#!/usr/bin/env bash
# Preserve a raw, *local* read-only WebView save snapshot from a debuggable
# Thornhaven installation. For legacy 1.0.56-dev builds distributed under
# a 1.0.57 filename, this may be the only non-root data recovery route.
# It never installs, uninstalls, clears, stops, or changes the Android app.
# The .tar is NOT a portable Cloud Save JSON and must not be published.
set -euo pipefail
umask 077
PACKAGE='com.vaelbrink.ashvale.newjourney'
ADB=${ADB_BIN:-adb}
if [[ $# -ne 1 || -z "$1" ]]; then
  echo 'Usage: bash tools/backup-debug-webview-saves.sh /safe/private/Thornhaven-webview-backup.tar' >&2
  exit 2
fi
DEST=$1
if [[ -e "$DEST" || -L "$DEST" ]]; then
  echo 'BLOCKED: destination already exists. No file has been overwritten.' >&2
  exit 1
fi
command -v "$ADB" >/dev/null 2>&1 || { echo 'BLOCKED: adb is unavailable.' >&2; exit 2; }
command -v tar >/dev/null 2>&1 || { echo 'BLOCKED: local tar is unavailable.' >&2; exit 2; }
if [[ -n "${ADB_SERIAL:-}" ]]; then
  adb_args=(-s "$ADB_SERIAL")
else
  mapfile -t connected < <("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')
  [[ ${#connected[@]} -eq 1 ]] || {
    echo 'BLOCKED: connect exactly one authorized device or set ADB_SERIAL.' >&2
    exit 1
  }
  adb_args=(-s "${connected[0]}")
fi
paths=$("$ADB" "${adb_args[@]}" shell pm path "$PACKAGE") || {
  echo 'BLOCKED: cannot read the installed Thornhaven package.' >&2; exit 1;
}
if ! grep -q '^package:' <<< "${paths//$'\r'/}"; then
  echo 'BLOCKED: Thornhaven is not installed on the selected device.' >&2; exit 1
fi
# Android restricts run-as to apps installed with android:debuggable=true.
# Never attempt privilege escalation or switch to a different app ID.
if ! "$ADB" "${adb_args[@]}" shell run-as "$PACKAGE" pwd >/dev/null 2>&1; then
  echo 'BLOCKED: installed app is not debuggable or run-as is unavailable.' >&2
  echo 'Do not uninstall your Play Store installation or attempt to replace its signing key.' >&2
  exit 1
fi
PARENT=$(dirname -- "$DEST")
[[ -d "$PARENT" ]] || { echo 'BLOCKED: output directory does not exist.' >&2; exit 1; }
TMP=$(mktemp "$PARENT/.thornhaven-raw-save.XXXXXXXX")
trap 'rm -f -- "$TMP"' EXIT
# exec-out is binary-safe. Read ONLY the WebView Local Storage directory.
# Android WebView uses one of two directory layouts.
if ! "$ADB" "${adb_args[@]}" exec-out run-as "$PACKAGE" /system/bin/sh -c '
  if [ -d "app_webview/Default/Local Storage/leveldb" ]; then
    path="app_webview/Default/Local Storage/leveldb"
  elif [ -d "app_webview/Local Storage/leveldb" ]; then
    path="app_webview/Local Storage/leveldb"
  else
    exit 3
  fi
  tar -cf - "$path"
' > "$TMP"; then
  echo 'BLOCKED: cannot read WebView Local Storage; no app data was changed.' >&2
  exit 1
fi
# Catch adb stdout error messages, truncated archives, and empty snapshots.
if [[ ! -s "$TMP" ]] || ! tar -tf "$TMP" >/dev/null; then
  echo 'BLOCKED: incomplete or invalid archive; no backup was accepted.' >&2
  exit 1
fi
if ! tar -tf "$TMP" | grep -q '^app_webview/\(Default/\)\?Local Storage/leveldb/'; then
  echo 'BLOCKED: WebView LevelDB directory missing from archive.' >&2
  exit 1
fi
chmod 600 "$TMP"
mv -n -- "$TMP" "$DEST"
# Some mv implementations return success even when -n skips an existing target.
[[ -f "$DEST" && ! -e "$TMP" ]] || { echo 'BLOCKED: backup could not be finalized.' >&2; exit 1; }
trap - EXIT
printf 'PASS: archived legacy WebView Local Storage to %s\n' "$DEST"
sha256sum -- "$DEST"
echo 'Raw private backup only; not an importable Cloud Save JSON or a verified character migration.'
echo 'Do not uninstall the existing app or upload this archive to a public repository.'

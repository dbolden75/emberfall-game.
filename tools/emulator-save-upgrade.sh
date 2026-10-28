#!/usr/bin/env bash
# Native WebView save/town QA on disposable emulator. Upgrade the authentic
# archived 1.0.57 *game source* (versionCode 159) to 1.0.63 (165), packaging
# both with the same temporary DEBUG key. Neither APK is Play-signed and this
# never touches the user's installed app or their saved progress.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
OLD=qa-historical-157/app/build/outputs/apk/debug/app-debug.apk
NEW=app/build/outputs/apk/debug/app-debug.apk
AAPT="$ANDROID_HOME/build-tools/36.0.0/aapt"
mkdir -p reports/emulator
test -s "$OLD" && test -s "$NEW"
# Both versions must be debug-signed with EXACTLY the same ephemeral key.
# Otherwise adb install -r would reject an upgrade rather than test saves.
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
old_cert="$("$APKSIGNER" verify --print-certs "$OLD" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1)"
new_cert="$("$APKSIGNER" verify --print-certs "$NEW" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1)"
test -n "$old_cert" && test "$old_cert" = "$new_cert" || { echo 'FAIL: historical and current debug APK signing certificates differ'; exit 1; }
echo "PASS: historical/current APK DEBUG signing certificate matches: $old_cert"
"$AAPT" dump badging "$OLD" | grep -q "package: name='$PKG' versionCode='159'"
"$AAPT" dump badging "$NEW" | grep -q "package: name='$PKG' versionCode='165'"
# Remove only the transient DEBUG app in the disposable GitHub emulator.
adb uninstall "$PKG" | tee reports/emulator/qa-reset.txt
adb install "$OLD" | tee reports/emulator/qa-install-157.txt
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/qa-start-157.txt
sleep 12
adb shell dumpsys package "$PKG" > reports/emulator/qa-package-157.txt
grep -q 'versionCode=159' reports/emulator/qa-package-157.txt
oldpid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$oldpid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$oldpid"
node tools/emulator-webview-probe.cjs create | tee reports/emulator/qa-town-save.txt
adb forward --remove tcp:9222
# Allow Chromium DOM-storage writes to commit and the native activity to
# receive onPause. Force-stopping immediately after evaluate can drop writes.
adb shell input keyevent KEYCODE_HOME
sleep 6
adb shell am force-stop "$PKG"
# Distinguish historical 1.0.57 cold-start retention from actual game-source migration.
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/qa-restart-157.txt
sleep 10
checkpid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$checkpid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$checkpid"
node tools/emulator-webview-probe.cjs preupgrade | tee reports/emulator/qa-preupgrade-157-save.txt
adb forward --remove tcp:9222
adb shell input keyevent KEYCODE_HOME
sleep 5
adb shell am force-stop "$PKG"
adb install -r "$NEW" | tee reports/emulator/qa-upgrade-165.txt
adb shell dumpsys package "$PKG" > reports/emulator/qa-package-165.txt
grep -q 'versionCode=165' reports/emulator/qa-package-165.txt
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/qa-start-165.txt
sleep 12
newpid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$newpid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$newpid"
node tools/emulator-webview-probe.cjs verify | tee reports/emulator/qa-save-retained.txt
adb forward --remove tcp:9222
# Verify the newly wired cloud backup button actually opens Android's SAF
# document picker, and that cancelling never replaces character saves.
# These are intentionally cancel-only tests; successful Drive upload/download
# needs a real provider/account and remains unverified.
for action in save load; do
  activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
  test -n "$activepid"
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
  node tools/emulator-webview-probe.cjs "picker-$action" | tee "reports/emulator/qa-picker-$action.txt"
  adb forward --remove tcp:9222
  sleep 4
  adb shell uiautomator dump /sdcard/thornhaven-documents.xml >/dev/null
  adb shell cat /sdcard/thornhaven-documents.xml > "reports/emulator/qa-picker-$action-ui.xml"
  # Android 14's DocumentsUI may be Google's or the AOSP provider.
  grep -Eiq 'documentsui|com.android.documents|com.google.android.documents' "reports/emulator/qa-picker-$action-ui.xml" ||
    { echo "FAIL: Android document picker was not presented for $action"; exit 1; }
  adb exec-out screencap -p > "reports/emulator/qa-picker-$action.png"
  adb shell input keyevent KEYCODE_BACK
  sleep 4
  resumed="$(adb shell pidof "$PKG" | tr -d '\r')"
  test -n "$resumed"
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$resumed"
  node tools/emulator-webview-probe.cjs picker-cancel | tee "reports/emulator/qa-picker-$action-cancel.txt"
  node tools/emulator-webview-probe.cjs verify | tee "reports/emulator/qa-picker-$action-saves.txt"
  adb forward --remove tcp:9222
done
# Complete a real Android Storage Access Framework export and import preview.
# Previous picker tests only cancelled; they never proved that a provider
# accepted and returned the actual JSON bytes. All files here are ephemeral
# and the imported backup is REVIEWED ONLY, never committed over test saves.
activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$activepid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
node tools/emulator-webview-probe.cjs picker-save | tee reports/emulator/qa-native-cloud-save-start.txt
adb forward --remove tcp:9222
sleep 4
python3 tools/emulator-document-picker.py save | tee reports/emulator/qa-native-cloud-save-ui.txt
sleep 6
python3 tools/emulator-document-picker.py verify | tee reports/emulator/qa-native-cloud-export-integrity.txt
activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$activepid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
node tools/emulator-webview-probe.cjs picker-saved | tee reports/emulator/qa-native-cloud-export-callback.txt
node tools/emulator-webview-probe.cjs picker-load | tee reports/emulator/qa-native-cloud-load-start.txt
adb forward --remove tcp:9222
sleep 4
python3 tools/emulator-document-picker.py load | tee reports/emulator/qa-native-cloud-load-ui.txt
sleep 6
activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$activepid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
node tools/emulator-webview-probe.cjs picker-reviewed | tee reports/emulator/qa-native-cloud-import-review.txt
node tools/emulator-webview-probe.cjs verify | tee reports/emulator/qa-native-cloud-original-saves.txt
adb forward --remove tcp:9222
# After the safe review-and-cancel roundtrip, test a real user-approved
# restore. Deliberately create newer local progress, re-import the previously
# exported Android document, approve the older backup, and assert that the
# new recovery copy retains the overwritten local state.
activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$activepid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
node tools/emulator-webview-probe.cjs picker-prepare-restore | tee reports/emulator/qa-cloud-restore-newer-progress.txt
node tools/emulator-webview-probe.cjs picker-load | tee reports/emulator/qa-cloud-restore-load-start.txt
adb forward --remove tcp:9222
sleep 4
python3 tools/emulator-document-picker.py load | tee reports/emulator/qa-cloud-restore-provider-read.txt
sleep 6
activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$activepid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
node tools/emulator-webview-probe.cjs picker-commit | tee reports/emulator/qa-cloud-restore-confirm.txt
adb forward --remove tcp:9222
sleep 12
activepid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$activepid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$activepid"
node tools/emulator-webview-probe.cjs picker-restored | tee reports/emulator/qa-cloud-restore-persisted.txt
adb forward --remove tcp:9222
adb logcat -d -v time > reports/emulator/qa-logcat.txt
if grep -q "Process: $PKG," reports/emulator/qa-logcat.txt; then
  echo 'FAIL: Android Runtime recorded Thornhaven process crash during synthetic update'
  exit 1
fi
echo 'PASS: native emulator WebView enters four historical 1.0.57 towns and saves survive actual game-source 1.0.57 (159)->1.0.63 (165) same-DEBUG-key upgrade.'
echo 'PASS: Android DocumentsUI exported valid JSON, reviewed it without replacing progress, then restored both heroes with explicit approval and preserved overwritten local progress in recovery.'
echo 'NOT VERIFIED: Google Drive cloud sync, maintained-key/Play-signed in-place upgrade, Play App Signing, actual Play delivery, real user saves or physical hardware.'

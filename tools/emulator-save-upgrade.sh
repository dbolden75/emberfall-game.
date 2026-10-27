#!/usr/bin/env bash
# Native WebView save/town QA on disposable emulator with SYNTHETIC debug
# 164 -> 165 versionCode upgrade. This is NOT an installed Play app, not
# the actual 1.0.62 binary, and never touches the user's saved progress.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
OLD=app/build/qa/thornhaven-synthetic-164-debug.apk
NEW=app/build/outputs/apk/debug/app-debug.apk
AAPT="$ANDROID_HOME/build-tools/36.0.0/aapt"
mkdir -p reports/emulator
test -s "$OLD" && test -s "$NEW"
"$AAPT" dump badging "$OLD" | grep -q "package: name='$PKG' versionCode='164'"
"$AAPT" dump badging "$NEW" | grep -q "package: name='$PKG' versionCode='165'"
# Remove only the transient debug app in the disposable GitHub emulator.
adb uninstall "$PKG" | tee reports/emulator/qa-reset.txt
adb install "$OLD" | tee reports/emulator/qa-install-164.txt
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/qa-start-164.txt
sleep 12
adb shell dumpsys package "$PKG" > reports/emulator/qa-package-164.txt
grep -q 'versionCode=164' reports/emulator/qa-package-164.txt
oldpid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$oldpid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$oldpid"
node tools/emulator-webview-probe.cjs create | tee reports/emulator/qa-town-save.txt
adb forward --remove tcp:9222
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
adb logcat -d -v time > reports/emulator/qa-logcat.txt
if grep -q "Process: $PKG," reports/emulator/qa-logcat.txt; then
  echo 'FAIL: Android Runtime recorded Thornhaven process crash during synthetic update'
  exit 1
fi
echo 'PASS: native emulator WebView enters all four towns and saves survive synthetic same-debug-key 164->165 in-place upgrade.'
echo 'NOT VERIFIED: historical signed build upgrade, Play App Signing, actual Play delivery, user saves or physical hardware.'

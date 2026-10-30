#!/usr/bin/env bash
# Disposable Android 14 release-variant install / restart smoke test.
# The APK is signed with a ONE-RUN test certificate, never the maintained Play
# key. It must never be distributed or used to upgrade an installed Play app.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
APK=app/build/outputs/apk/release/thornhaven-ephemeral-release-QA.apk
AAPT="$ANDROID_HOME/build-tools/36.0.0/aapt"
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
mkdir -p reports/emulator
# This must not silently turn into a production signing workflow.
test -s "$APK"
"$APKSIGNER" verify --verbose "$APK" > reports/emulator/qa-release-apk-verified.txt
"$AAPT" dump badging "$APK" | tee reports/emulator/qa-release-badging.txt
grep -q "package: name='$PKG' versionCode='166' versionName='1.0.64'" reports/emulator/qa-release-badging.txt
# Destroy ONLY the synthetic test characters on the disposable CI emulator.
# Historical debug and release-QA certificates differ; adb install -r must NOT
# be used here, and no real user device or save is involved.
adb uninstall "$PKG" | tee reports/emulator/qa-release-remove-debug.txt
adb install "$APK" | tee reports/emulator/qa-release-install.txt
adb shell dumpsys package "$PKG" > reports/emulator/qa-release-package.txt
grep -q 'versionCode=166' reports/emulator/qa-release-package.txt
adb logcat -c
# Avoid am start -W, which has hung for >40 minutes on hosted emulator CI.
timeout --signal=TERM --kill-after=10s 90s adb shell am start -n "$PKG/$ACTIVITY" | tee reports/emulator/qa-release-start.txt
sleep 12
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL: release-variant app exited after launch'; exit 1; }
adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
node tools/emulator-webview-probe.cjs create | tee reports/emulator/qa-release-gameplay.txt
adb forward --remove tcp:9222
adb exec-out screencap -p > reports/emulator/qa-release-gameplay.png
# Check a genuine activity/process restart retains both created characters.
adb shell input keyevent KEYCODE_HOME
sleep 6
adb shell am force-stop "$PKG"
timeout --signal=TERM --kill-after=10s 90s adb shell am start -n "$PKG/$ACTIVITY" | tee reports/emulator/qa-release-restart.txt
sleep 12
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL: release-variant app exited after restart'; exit 1; }
adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
node tools/emulator-webview-probe.cjs verify | tee reports/emulator/qa-release-save-persistence.txt
adb forward --remove tcp:9222
adb logcat -d -v time > reports/emulator/qa-release-logcat.txt
if grep -q "Process: $PKG," reports/emulator/qa-release-logcat.txt; then
  echo 'FAIL: Android Runtime recorded release-variant process crash'
  exit 1
fi
echo 'PASS: release-configuration APK with disposable QA certificate installed, rendered all four towns, and retained two character slots across cold restart.'
echo 'NOT VERIFIED: maintained-key APK installation, Google Play signature/versionCode acceptance, in-place maintained-key upgrade, physical Samsung or authenticated Drive account.'

#!/usr/bin/env bash
# Dedicated Android 14 control-matrix QA in a CLEAN disposable emulator.
# This intentionally runs apart from the 1.0.57 -> 1.0.64 upgrade/SAF
# DocumentsUI stress test so graphics-emulator exhaustion cannot hide a
# genuine control-layout failure. Production signing materials are never used.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
APK=app/build/outputs/apk/debug/app-debug.apk
orientation="${1:-both}"
case "$orientation" in portrait|landscape|both) ;; *) echo "Invalid matrix orientation: $orientation" >&2; exit 2 ;; esac
mkdir -p reports/control-matrix
failure_report () {
  local rc="$1"
  trap - EXIT
  if (( rc != 0 )); then
    echo "Control matrix failed with exit code $rc" > reports/control-matrix/failure.txt
    timeout 8s adb devices -l > reports/control-matrix/devices.txt 2>&1 || true
    timeout 8s adb logcat -d -v time > reports/control-matrix/logcat.txt 2>&1 || true
    free -m > reports/control-matrix/host-memory.txt 2>&1 || true
  fi
  exit "$rc"
}
trap 'failure_report $?' EXIT
test -s "$APK"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose "$APK"
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging "$APK" | tee reports/control-matrix/badging.txt
grep -q "package: name='$PKG' versionCode='166' versionName='1.0.64'" reports/control-matrix/badging.txt
# Never uninstall or clear data from a user device. This is a brand-new,
# ephemeral Android emulator used only for synthetic test characters.
adb install "$APK" | tee reports/control-matrix/install.txt
timeout 90s adb shell am start -n "$PKG/$ACTIVITY" | tee reports/control-matrix/start.txt
sleep 12
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL control matrix app failed to start'; exit 1; }
adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
# Create two persisted synthetic slots WITHOUT the four-town render sweep.
# The independent release-smoke job still runs that full GPU-heavy coverage.
node tools/emulator-webview-probe.cjs create-controls | tee reports/control-matrix/create.txt
if [[ "$orientation" == both ]]; then
  node tools/emulator-webview-probe.cjs control-preferences | tee reports/control-matrix/controls.txt
else
  node tools/emulator-webview-probe.cjs "control-preferences-$orientation" | tee reports/control-matrix/controls.txt
fi
adb forward --remove tcp:9222
timeout 10s adb logcat -d -v time > reports/control-matrix/logcat.txt || true
echo "PASS: Android 14 emulator native controls $orientation: left/right and touch/arrows; two synthetic save slots preserved. Both matrix legs must pass for eight configurations."
echo 'NOT VERIFIED: original-key installation, production Play delivery, real Samsung finger input.'

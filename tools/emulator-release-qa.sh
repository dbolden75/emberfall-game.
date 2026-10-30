#!/usr/bin/env bash
# Disposable Android 14 same-signer RELEASE -> RELEASE upgrade with synthetic saves.
# Both 1.0.57 and 1.0.64 APKs use the SAME one-run QA certificate, never the
# maintained Play/upload key. No APK here may be distributed to players.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
OLD_APK=qa-historical-157/app/build/outputs/apk/release/thornhaven-ephemeral-historical-release-QA.apk
APK=app/build/outputs/apk/release/thornhaven-ephemeral-release-QA.apk
AAPT="$ANDROID_HOME/build-tools/36.0.0/aapt"
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
mkdir -p reports/emulator
for apk in "$OLD_APK" "$APK"; do
  test -s "$apk"
  "$APKSIGNER" verify --verbose "$apk" > /dev/null
done
"$AAPT" dump badging "$OLD_APK" | tee reports/emulator/qa-release-old-badging.txt
"$AAPT" dump badging "$APK" | tee reports/emulator/qa-release-badging.txt
grep -q "package: name='$PKG' versionCode='159' versionName='1.0.57'" reports/emulator/qa-release-old-badging.txt
grep -q "package: name='$PKG' versionCode='166' versionName='1.0.64'" reports/emulator/qa-release-badging.txt

# This emulator is disposable: the preceding DEBUG-key smoke/upgrade phases
# created only synthetic QA saves. A different QA key cannot update that app.
# NEVER perform this uninstall on a real user device or an existing Play app.
adb uninstall "$PKG" | tee reports/emulator/qa-release-remove-debug.txt
adb install "$OLD_APK" | tee reports/emulator/qa-release-old-install.txt
adb shell dumpsys package "$PKG" > reports/emulator/qa-release-old-package.txt
grep -q 'versionCode=159' reports/emulator/qa-release-old-package.txt
adb logcat -c

start_game () {
  local stage="$1"
  # am start -W has previously hung on the hosted runner.
  timeout --signal=TERM --kill-after=10s 90s adb shell am start -n "$PKG/$ACTIVITY" | tee "reports/emulator/qa-release-$stage-start.txt"
  sleep 12
  local pid
  pid="$(adb shell pidof "$PKG" | tr -d '\r')"
  test -n "$pid" || { echo "FAIL: $stage app exited after launch"; exit 1; }
}
webview_phase () {
  local phase="$1" stage="$2" pid
  pid="$(adb shell pidof "$PKG" | tr -d '\r')"
  test -n "$pid" || { echo "FAIL: no $stage WebView process"; exit 1; }
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
  node tools/emulator-webview-probe.cjs "$phase" | tee "reports/emulator/qa-release-$stage-$phase.txt"
  adb forward --remove tcp:9222
}

# Render every town and create two real synthetic character saves in the
# historical 1.0.57 RELEASE variant, not just a debug build.
start_game old
webview_phase create old
adb exec-out screencap -p > reports/emulator/qa-release-old-gameplay.png
adb shell am force-stop "$PKG"

# CRITICAL: keep Android app-private data in place during this upgrade.
# Android will reject this command if the two ephemeral signatures differ.
# NO adb uninstall or pm clear is permitted between the two installs.
adb install -r "$APK" | tee reports/emulator/qa-release-in-place-upgrade.txt
adb shell dumpsys package "$PKG" > reports/emulator/qa-release-package.txt
grep -q 'versionCode=166' reports/emulator/qa-release-package.txt
start_game upgraded
webview_phase verify upgraded
# Re-render all four towns in the NEW release variant and save again. The
# second QA create uses the same synthetic fixture, not player information.
webview_phase create upgraded
adb exec-out screencap -p > reports/emulator/qa-release-gameplay.png

# A real process/activity restart must not lose either character or active slot.
adb shell input keyevent KEYCODE_HOME
sleep 6
adb shell am force-stop "$PKG"
start_game restart
webview_phase verify restart

# Exercise the actual Android background lifecycle path. Deliberately change
# the synthetic hero in memory without calling saveGame or waiting 2 seconds.
# The app must persist that change when Home causes Activity.onPause.
webview_phase lifecycle-stage restart
adb shell input keyevent KEYCODE_HOME
sleep 7
adb shell am force-stop "$PKG"
start_game background
webview_phase lifecycle-check background

adb logcat -d -v time > reports/emulator/qa-release-logcat.txt
if grep -q "Process: $PKG," reports/emulator/qa-release-logcat.txt; then
  echo 'FAIL: Android Runtime recorded release-variant process crash'
  exit 1
fi
echo 'PASS: same disposable QA signer: 1.0.57 RELEASE -> 1.0.64 RELEASE upgrade retained 2 character slots, inventory, XP and active slot; four towns rendered before/after; cold restart and Android background lifecycle saves passed.'
echo 'NOT VERIFIED: maintained-key APK installation, Google Play distribution/signing/versionCode acceptance, physical Samsung, authenticated Drive account.'

#!/usr/bin/env bash
# Test a disposable QA-signed universal APK generated from the *unmodified*
# production release AAB. Its signer matches the emulator's prior release-QA
# install, not Thornhaven's original maintained/Google Play signing identity.
# Never use this test on a real player device.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
APK="$RUNNER_TEMP/thornhaven-aab-install-qa.apk"
AAPT="$ANDROID_HOME/build-tools/36.0.0/aapt"
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
OUT=reports/emulator
mkdir -p "$OUT"
test -s "$APK"
"$APKSIGNER" verify --verbose "$APK" > "$OUT/qa-aab-universal-signature.txt"
"$AAPT" dump badging "$APK" | tee "$OUT/qa-aab-universal-badging.txt"
grep -q "package: name='$PKG' versionCode='166' versionName='1.0.64'" "$OUT/qa-aab-universal-badging.txt"
adb wait-for-device
# The previous emulator-release-qa stage already installed synthetic saves in
# version 166 using this same disposable QA signer. Do not uninstall/clear it.
adb shell dumpsys package "$PKG" > "$OUT/qa-aab-before-package.txt"
grep -q 'versionCode=166' "$OUT/qa-aab-before-package.txt"
# Android keeps the original first-install timestamp on a genuine in-place
# replacement. A reinstall after uninstalling would reset it and invalidate
# this non-destructive install test, even if the fresh APK could launch.
before_first_install="$(sed -n 's/^[[:space:]]*firstInstallTime=//p' "$OUT/qa-aab-before-package.txt" | head -n 1)"
test -n "$before_first_install" || { echo 'FAIL: prior package firstInstallTime unavailable'; exit 1; }
adb shell am force-stop "$PKG"
# A successful same-signer in-place replacement is the key packaging check.
# No -d, uninstall, clear-data or data-reset fallbacks are allowed.
timeout --signal=TERM --kill-after=10s 120s adb install -r "$APK" | tee "$OUT/qa-aab-install-in-place.txt"
grep -qx 'Success' "$OUT/qa-aab-install-in-place.txt"
adb shell dumpsys package "$PKG" > "$OUT/qa-aab-after-package.txt"
grep -q 'versionCode=166' "$OUT/qa-aab-after-package.txt"
after_first_install="$(sed -n 's/^[[:space:]]*firstInstallTime=//p' "$OUT/qa-aab-after-package.txt" | head -n 1)"
test "$before_first_install" = "$after_first_install" || {
  echo 'FAIL: Android firstInstallTime changed during AAB install; not a verified in-place replacement'
  exit 1
}
printf 'PASS: app firstInstallTime preserved across the AAB-derived APK replacement: %s\n' "$after_first_install" |
  tee "$OUT/qa-aab-package-preservation.txt"
adb shell pm path "$PKG" | grep -q '^package:'
adb logcat -c
# Production WebView debugging is disabled in this AAB. We therefore verify
# native launch, two process lifecycles, screen capture and crash signals;
# no claim is made that character save content was inspected in this phase.
for stage in start restart; do
  timeout --signal=TERM --kill-after=10s 90s adb shell am start -n "$PKG/$ACTIVITY" | tee "$OUT/qa-aab-$stage-activity.txt"
  sleep 12
  pid="$(adb shell pidof "$PKG" | tr -d '\r')"
  test -n "$pid" || { echo "FAIL: AAB-derived universal APK process exited on $stage"; exit 1; }
  # A live background process is not enough: the installed production-mode
  # Activity must actually be resumed in Android's foreground.
  timeout 20s adb shell dumpsys activity activities > "$OUT/qa-aab-$stage-foreground.txt"
  grep -E 'topResumedActivity=|mResumedActivity=' "$OUT/qa-aab-$stage-foreground.txt" |
    grep -F "$PKG" > /dev/null ||
    { echo "FAIL: Thornhaven was not the foreground-resumed Activity on $stage"; exit 1; }
  adb exec-out screencap -p > "$OUT/qa-aab-$stage-screen.png"
  python3 - "$OUT/qa-aab-$stage-screen.png" <<'PY'
from pathlib import Path
from struct import unpack
import sys
p=Path(sys.argv[1]); data=p.read_bytes()
assert data[:8] == bytes.fromhex('89504e470d0a1a0a'), f'Not a PNG: {p}'
w,h=unpack('>II', data[16:24])
assert w>=200 and h>=200 and len(data)>10000, f'Empty screen: {p}: {w}x{h}, {len(data)} bytes'
print(f'PASS: AAB-derived app {p.name}: {w}x{h}, {len(data)} bytes')
PY
  adb shell am force-stop "$PKG"
done
adb logcat -d -v time > "$OUT/qa-aab-logcat.txt"
if grep -q "Process: $PKG," "$OUT/qa-aab-logcat.txt"; then
  echo 'FAIL: Android Runtime reported Thornhaven crash in AAB-derived APK'
  exit 1
fi
echo 'PASS: uninstrumented AAB -> QA-signed universal APK installed in-place on Android 14 emulator and launched/restarted without native crash.'
echo 'NOT VERIFIED: original maintained-key APK install, Google Play upload/upgrade, actual saved-character content, physical Samsung, authenticated Drive sync.'

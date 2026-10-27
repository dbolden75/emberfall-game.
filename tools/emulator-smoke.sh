#!/usr/bin/env bash
# Ephemeral Android emulator startup/restart check. Not a Play or physical-device test.
set -euo pipefail
PKG=com.vaelbrink.ashvale.newjourney
ACTIVITY=com.emberfall.ashvale.MainActivity
APK=app/build/outputs/apk/debug/app-debug.apk
mkdir -p reports/emulator
test -s "$APK"
adb wait-for-device
adb install -r "$APK" | tee reports/emulator/install.txt
adb shell pm path "$PKG" | grep -q '^package:'
adb shell input keyevent KEYCODE_WAKEUP || true
adb shell wm dismiss-keyguard || true
adb logcat -c
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/start.txt
sleep 20
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL: Game process exited during startup'; adb logcat -d > reports/emulator/logcat.txt; exit 1; }
adb exec-out screencap -p > reports/emulator/startup.png
test -s reports/emulator/startup.png
# PNG signature, dimensions and screenshot data are checked before accepting output.
python3 - <<'PY'
from pathlib import Path
from struct import unpack
p=Path('reports/emulator/startup.png')
data=p.read_bytes()
assert data[:8]==bytes.fromhex('89504e470d0a1a0a'), 'Emulator screenshot not PNG'
width,height=unpack('>II', data[16:24])
assert width>=200 and height>=200 and len(data)>1000, 'Invalid or empty startup screenshot'
print(f'PASS: emulator screenshot {width}x{height} ({len(data)} bytes)')
PY
adb shell am force-stop "$PKG"
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/restart.txt
sleep 10
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL: Game process exited after restart'; adb logcat -d > reports/emulator/logcat.txt; exit 1; }
adb logcat -d -v time > reports/emulator/logcat.txt
if grep -q "Process: $PKG," reports/emulator/logcat.txt; then
  echo 'FAIL: Android Runtime reported a Thornhaven process crash'
  exit 1
fi
echo 'PASS: ephemeral Android emulator installs, starts and restarts Thornhaven debug package.'
echo 'NOT TESTED: gameplay/town-entry touches, original signing key, Play upgrade, save preservation, physical hardware.'

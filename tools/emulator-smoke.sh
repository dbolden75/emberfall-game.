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
# Prevent SystemUI's first-run immersive tutorial from covering game UI.
adb shell settings put secure immersive_mode_confirmations confirmed
adb logcat -c
adb shell am start -W -n "$PKG/$ACTIVITY" | tee reports/emulator/start.txt
sleep 15
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL: Game process exited during startup'; adb logcat -d > reports/emulator/logcat.txt; exit 1; }
# Android 14 presents a first-run "Viewing full screen / GOT IT" system tutorial
# over the game. Merely capturing that tutorial previously gave false confidence.
adb exec-out screencap -p > reports/emulator/first-frame.png
read -r width height < <(python3 - <<'PY'
from pathlib import Path
from struct import unpack
p = Path('reports/emulator/first-frame.png').read_bytes()
assert p[:8] == bytes.fromhex('89504e470d0a1a0a') and len(p) > 10000
print(*unpack('>II', p[16:24]))
PY
)
# Capture exposed game UI, not the Android system's fullscreen tutorial.
sleep 3
adb exec-out screencap -p > reports/emulator/startup.png
# Avoid launching the memory-heavy UIAutomator instrumentation process just
# to detect the fullscreen tutorial. On API34 that process was the last action
# after valid game screenshots immediately before a shell exit 137. A focused
# window belonging to our MainActivity ensures SystemUI is not covering it.
timeout 12s adb shell dumpsys window > reports/emulator/window-state.txt
if ! grep -F 'mCurrentFocus=' reports/emulator/window-state.txt |
     grep -Fq "$PKG/$ACTIVITY"; then
  echo 'FAIL: Thornhaven is not the focused window (possible SystemUI overlay)'
  grep -F 'mCurrentFocus=' reports/emulator/window-state.txt || true
  exit 1
fi
# Interact with Start New Game on the landscape title screen, then check for
# native process crashes. This is still not a full gameplay/save-upgrade test.
adb shell input tap "$((width * 26 / 100))" "$((height * 27 / 100))"
sleep 10
adb exec-out screencap -p > reports/emulator/after-new-game.png
python3 - <<'PY'
from pathlib import Path
from struct import unpack
for name in ('first-frame.png', 'startup.png', 'after-new-game.png'):
    p=Path('reports/emulator') / name
    data=p.read_bytes()
    assert data[:8]==bytes.fromhex('89504e470d0a1a0a'), f'Not a PNG: {name}'
    width,height=unpack('>II', data[16:24])
    assert width>=200 and height>=200 and len(data)>10000, f'Empty frame: {name}'
    print(f'PASS: {name}: {width}x{height} ({len(data)} bytes)')
PY
pid="$(adb shell pidof "$PKG" | tr -d '\r')"
test -n "$pid" || { echo 'FAIL: Game process exited after menu interaction'; adb logcat -d > reports/emulator/logcat.txt; exit 1; }
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
echo 'PASS: ephemeral Android emulator boots, touches title screen, and restarts Thornhaven debug package.'
echo 'NOT TESTED: gameplay/town-entry touches, original signing key, Play upgrade, save preservation, physical hardware.'

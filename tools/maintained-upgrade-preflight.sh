#!/usr/bin/env bash
# Read-only preflight for an installed Thornhaven app versus a maintained-key APK.
# Never installs, uninstalls, clears app data, or uploads the installed APK.
# A Play-delivered install may use Google's distinct app-signing certificate;
# in that case this intentionally BLOCKS sideloading, protecting saved heroes.
set -euo pipefail

PACKAGE='com.vaelbrink.ashvale.newjourney'
MAINTAINED_CERT='38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22'
if [[ $# -ne 1 || ! -s "$1" ]]; then
  echo 'Usage: bash tools/maintained-upgrade-preflight.sh /path/to/maintained-key.apk' >&2
  exit 2
fi
CANDIDATE=$1
ADB=${ADB_BIN:-adb}
AAPT=${AAPT_BIN:-aapt}
APKSIGNER=${APKSIGNER_BIN:-apksigner}
for executable in "$ADB" "$AAPT" "$APKSIGNER"; do
  command -v "$executable" >/dev/null 2>&1 || { echo "BLOCKED: required command missing: $executable" >&2; exit 2; }
done

badging() {
  # Consume the whole aapt output: grep -m1 closes the pipe early, which
  # can SIGPIPE aapt and falsely fail the preflight under set -o pipefail.
  "$AAPT" dump badging "$1" | awk '
    /^package: / { package_count++; if (package_count == 1) print; next }
    /^sdkVersion:/ { sdk_count++; if (sdk_count == 1) print; next }
    END { if (package_count != 1 || sdk_count != 1) exit 1 }
  '
}
package_field() {
  local badge=$1 field=$2
  if [[ "$badge" =~ ${field}=\'([^\']+)\' ]]; then printf '%s' "${BASH_REMATCH[1]}"; else return 1; fi
}
certificate() {
  local report
  report=$("$APKSIGNER" verify --verbose --print-certs "$1") || return 1
  local count
  count=$(printf '%s\n' "$report" | grep -Ec '^Signer #[0-9]+ certificate SHA-256 digest: ' || true)
  [[ "$count" -eq 1 ]] || return 1
  printf '%s\n' "$report" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | tr -d ':' | tr '[:upper:]' '[:lower:]' | head -n1
}

candidate_badging=$(badging "$CANDIDATE") || { echo 'BLOCKED: unreadable candidate APK manifest' >&2; exit 1; }
candidate_min_sdk=$(printf '%s\n' "$candidate_badging" | sed -n "s/^sdkVersion:'\\([0-9][0-9]*\\)'$/\\1/p")
[[ "$candidate_min_sdk" =~ ^[0-9]+$ ]] || {
  echo 'BLOCKED: candidate APK has no valid minimum Android SDK' >&2; exit 1;
}
candidate_pkg=$(package_field "$candidate_badging" name) || exit 1
candidate_code=$(package_field "$candidate_badging" versionCode) || exit 1
[[ "$candidate_pkg" == "$PACKAGE" && "$candidate_code" =~ ^[0-9]+$ ]] || {
  echo "BLOCKED: candidate package/version wrong ($candidate_pkg, $candidate_code)" >&2; exit 1;
}
candidate_cert=$(certificate "$CANDIDATE") || { echo 'BLOCKED: candidate signature failed verification' >&2; exit 1; }
[[ "$candidate_cert" == "$MAINTAINED_CERT" ]] || {
  echo 'BLOCKED: candidate is not signed with the historical maintained Thornhaven certificate' >&2; exit 1;
}

# Require precisely one authorized device. Avoid accidentally checking another phone.
if [[ -n "${ADB_SERIAL:-}" ]]; then
  adb_args=(-s "$ADB_SERIAL")
else
  adb_args=()
  mapfile -t connected < <("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')
  [[ ${#connected[@]} -eq 1 ]] || { echo 'BLOCKED: connect exactly one authorized Android device or set ADB_SERIAL' >&2; exit 1; }
  adb_args=(-s "${connected[0]}")
fi

device_sdk=$("$ADB" "${adb_args[@]}" shell getprop ro.build.version.sdk) || {
  echo 'BLOCKED: cannot query the Android device SDK level' >&2; exit 1;
}
device_sdk=${device_sdk//$'\r'/}
device_sdk=${device_sdk//$'\n'/}
[[ "$device_sdk" =~ ^[0-9]+$ ]] || {
  echo 'BLOCKED: Android device SDK level is missing or invalid' >&2; exit 1;
}
if (( 10#$candidate_min_sdk > 10#$device_sdk )); then
  echo "BLOCKED: candidate requires Android API $candidate_min_sdk, device only supports API $device_sdk" >&2
  exit 1
fi

paths=$("$ADB" "${adb_args[@]}" shell pm path "$PACKAGE") || {
  echo 'BLOCKED: Thornhaven package not installed or unreadable on Android device' >&2; exit 1;
}
base_path=$(printf '%s\n' "$paths" | tr -d '\r' | sed -n 's/^package:\(.*\/base\.apk\)$/\1/p' | head -n1)
[[ -n "$base_path" ]] || { echo 'BLOCKED: could not locate installed base.apk' >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
"$ADB" "${adb_args[@]}" pull "$base_path" "$tmp/installed-base.apk" >/dev/null || {
  echo 'BLOCKED: could not read installed base.apk for signature comparison' >&2; exit 1;
}
installed_badging=$(badging "$tmp/installed-base.apk") || {
  echo 'BLOCKED: installed APK manifest could not be verified' >&2; exit 1;
}
installed_pkg=$(package_field "$installed_badging" name) || exit 1
installed_code=$(package_field "$installed_badging" versionCode) || exit 1
[[ "$installed_pkg" == "$PACKAGE" && "$installed_code" =~ ^[0-9]+$ ]] || {
  echo 'BLOCKED: installed APK package/version does not match Thornhaven' >&2; exit 1;
}
installed_cert=$(certificate "$tmp/installed-base.apk") || {
  echo 'BLOCKED: installed APK certificate could not be verified' >&2; exit 1;
}
if [[ "$installed_cert" != "$candidate_cert" ]]; then
  echo 'BLOCKED: installed Thornhaven uses a different certificate (possibly Google Play App Signing).' >&2
  echo 'Do not uninstall or sideload over this app. Use the enrolled Google Play update track.' >&2
  exit 1
fi
if (( 10#$candidate_code <= 10#$installed_code )); then
  echo "BLOCKED: candidate versionCode $candidate_code is not newer than installed $installed_code" >&2
  exit 1
fi
printf 'PASS: candidate signer matches installed app; package %s; installed versionCode %s -> candidate %s.\n' "$PACKAGE" "$installed_code" "$candidate_code"
echo 'This was READ-ONLY preflight. No APK was installed and no saved data was changed.'

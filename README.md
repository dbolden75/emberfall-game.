# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate (verified November 15, 2026)
- **Version:** 1.0.67 (versionCode 169), package `com.vaelbrink.ashvale.newjourney`.
- **Maintained-key signed game source:** [`5bfb31d3`](https://github.com/dbolden75/emberfall-game./commit/5bfb31d398392199bc475f3c23290d5b9ff8084b) (merged PR #298; protects future top-level quest, currency and world-progress fields against destructive saves and purchase commits). This supersedes the PR #291/297 signed packages.
- **Post-merge CI:** [Android APK/AAB #43694551620](https://github.com/dbolden75/emberfall-game./actions/runs/43694551620) and [seven-job emulator matrix #43694551670](https://github.com/dbolden75/emberfall-game./actions/runs/43694551670) both passed at `5bfb31d`. Emulator jobs do **not** establish physical Samsung or Play-delivered installation.
- **Maintained-signed APK SHA-256:** `d3623239479d6800fc89d1d0c84688a735850a49b74742f1e2284cbac04588ab` (37,624,860 bytes).
- **Maintained-signed AAB SHA-256:** `a9094a779c813c513da61a7be82ed87ca6a292584884b0adcf968c8001e672ce` (37,201,532 bytes).
- **Certificate SHA-256:** `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22` (matches maintained-key signed historical 1.0.57).

The exact signed PR #298 packages passed APK v2/v3 and AAB JAR signature verification, 16 KiB APK alignment, ZIP/CRC integrity, 25/25 identical gameplay assets, JavaScript syntax, and deterministic save-protection regressions. Both signed binaries were archived in Google Drive and verified after download: [APK](https://drive.google.com/file/d/1_cy6Fh9K-IMKzQT2BZwR5IurVfWY-t9Q/view) and [AAB](https://drive.google.com/file/d/1lNsoeRtLn-zkMzFGpJdCyzIDmlXd-VXe/view). These Drive links are release backups, **not** public tester enrollment. GitHub's ordinary Android CI produces unsigned release payloads; the signed files are not confirmed accepted by Google Play. Consult [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6) for audit and outstanding gates.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

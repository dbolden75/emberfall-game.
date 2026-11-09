# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate
- **Version:** 1.0.67 (versionCode 169).
- **Application ID:** `com.vaelbrink.ashvale.newjourney` (must remain unchanged to preserve existing game data).
- **Merged source:** [`10d1c491`](https://github.com/dbolden75/emberfall-game./commit/10d1c4918231d0b741224a5e35d840791637f2ff), including PR #224's safer damaged-save recovery.
- **CI:** [Android APK/AAB build](https://github.com/dbolden75/emberfall-game./actions/runs/42576678427) and [seven Android emulator checks](https://github.com/dbolden75/emberfall-game./actions/runs/42576678561) passed on November 9, 2026.
- **Maintained-key-signed APK SHA-256:** `546a8bf3eba4d5b3bc28d288ac59c9ba11508639248a8a3572c4bd34ff5a1add`.
- **Maintained-key-signed AAB SHA-256:** `e086385db4e1fdbfa75e1a377024b3b9d166987c3f0b24e5cd9d5876268d686f`.

The signed packages and QA report are backed up privately under **Google Drive → Thornhaven → APKs**. GitHub Actions builds use unsigned/disposable QA signing, not the maintained release key.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

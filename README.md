# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate
- **Version:** 1.0.67 (versionCode 169).
- **Application ID:** `com.vaelbrink.ashvale.newjourney` (must remain unchanged to preserve existing game data).
- **Merged source:** [`b1181589`](https://github.com/dbolden75/emberfall-game./commit/b11815892cbae8e0e3c0e2c44ba02bdfca56bb46), including PR #224's save recovery and PR #226's corrected 1.0.67 title/menu labels.
- **CI:** [Android APK/AAB build](https://github.com/dbolden75/emberfall-game./actions/runs/42595838898) and [seven Android emulator checks](https://github.com/dbolden75/emberfall-game./actions/runs/42595838766) passed on November 9, 2026.
- **Maintained-key-signed APK SHA-256:** `e2de191323734d6c5df781a9fb9599a13968d4c331a2f8a59f8b551b069a900a`.
- **Maintained-key-signed AAB SHA-256:** `d3e168752b117e5b52b6a1cdec21c510f6631fbd908cc6ca730ee8aad279bb22`.

The signed packages and QA report are backed up privately under **Google Drive → Thornhaven → APKs**. GitHub Actions builds use unsigned/disposable QA signing, not the maintained release key.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

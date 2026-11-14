# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate (verified November 14, 2026)
- **Version:** 1.0.67 (versionCode 169), package `com.vaelbrink.ashvale.newjourney`.
- **Maintained-key signed game source:** [`e18b2e3b`](https://github.com/dbolden75/emberfall-game./commit/e18b2e3b285f424427deab25c89bae35aeaceb43) (PR #291; forge-rank save/purchase guard), merged into main. PR #292 added compatible backup/restore regression coverage without modifying the signed gameplay payload.
- **Post-merge CI:** [Android APK/AAB #43612167596](https://github.com/dbolden75/emberfall-game./actions/runs/43612167596) and [seven-job emulator matrix #43612167592](https://github.com/dbolden75/emberfall-game./actions/runs/43612167592) passed at signed source `e18b2e3b`. Emulator jobs use disposable QA signatures, **not** the maintained-signed APK or a Play-delivered update.
- **Maintained-signed APK SHA-256:** `1e8d8358aba8a7e058019ccec2b5beb443012281a992fc8ba9de6227c4843585`.
- **Maintained-signed AAB SHA-256:** `2e9fe6a1869dc69c7e191e8fda928f1790b1c3a310ede8b6897678cb56a60c27`.
- **Certificate SHA-256:** `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`.

The PR #291 signed APK and canonical Drive AAB were re-hashed and ZIP-checked on November 14; maintained certificate verification and 25/25 shared game assets matched. Previous GitHub Actions checks verified APK v2/v3 signing and 16 KiB alignment. Signing credentials remain private. Exact signed files are backed up on private Google Drive: [APK](https://drive.google.com/file/d/1go7Nxs-gRzC03vTXbxL_vzjQQFidilbw/view) and [AAB](https://drive.google.com/file/d/1UkMHGXEqsFcwH_Ji80J1p_u2VxQK-vXA/view). They are not public tester links. GitHub's ordinary Android workflow publishes unsigned release payloads, not Play-accepted binaries. See [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6) for provenance and remaining Play checks.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

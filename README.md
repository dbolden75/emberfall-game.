# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate (verified November 11, 2026)
- **Version:** 1.0.67 (versionCode 169), package `com.vaelbrink.ashvale.newjourney`.
- **Maintained-key signed game source:** [`3bedd23d`](https://github.com/dbolden75/emberfall-game./commit/3bedd23d126de76611ab157c7e04b6d8cde86ca2). This build includes the Play Billing stale-offer refresh fix in PR #253; earlier signed 1.0.67 binaries based on `3dc2ac0b` are superseded.
- **Main-branch CI:** [Android APK/AAB build #43026599320](https://github.com/dbolden75/emberfall-game./actions/runs/43026599320) and [emulator matrix #43026599074](https://github.com/dbolden75/emberfall-game./actions/runs/43026599074) passed at `3bedd23d`. Emulator jobs use temporary QA signatures, **not** a Play-delivered update.
- **Maintained-signed APK SHA-256:** `ac10f36f992a2721c763b06df05fc1a2306f2f2d7c726cef38edd5d6b15dd4cd`.
- **Maintained-signed AAB SHA-256:** `24e898f0b9a79f732c75ba20177c5448a68090d35c3e488f4d8c5f4228834c1c`.
- **Certificate SHA-256:** `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`.

These exact APK/AAB bytes were independently re-hashed, ZIP-checked, and offline-signed using the original maintained signing certificate on November 11. Signature verification, 16 KiB APK alignment, and packaged game-asset parity passed; original signing material remains private. GitHub's ordinary Android workflow publishes unsigned release payloads, not Play-accepted binaries. See [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6) for provenance and unresolved Play checks.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

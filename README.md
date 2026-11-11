# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate (verified November 11, 2026)
- **Version:** 1.0.67 (versionCode 169), package `com.vaelbrink.ashvale.newjourney`.
- **Maintained-key signed game source:** [`b7378a9d`](https://github.com/dbolden75/emberfall-game./commit/b7378a9d4494a6b40da0fd08a4f1c937d88de008) (PR #256), merged to main at [`df0544aa`](https://github.com/dbolden75/emberfall-game./commit/df0544aa2bcbfdadcbe1690d6a1eed17b3c68604). Includes PR #253's stale-offer fix and PR #256's protection against delayed Play reconnection callbacks. The earlier signed `3bedd23d` packages are superseded.
- **PR-head CI:** [Android APK/AAB #43088537603](https://github.com/dbolden75/emberfall-game./actions/runs/43088537603) and [seven-job emulator matrix #43088537638](https://github.com/dbolden75/emberfall-game./actions/runs/43088537638) passed at signed source `b7378a9d`. Emulator jobs use temporary QA signatures, **not** a Play-delivered update; post-merge main CI is a separate verification.
- **Maintained-signed APK SHA-256:** `6ee4170c08889a556673c2a427a576d7f618ffee5ea9115cea6636f037c2074c`.
- **Maintained-signed AAB SHA-256:** `1399f8ecf45624b48e8ef0484afa4efd15ebbe04eb42fb702838e73b47ef01bb`.
- **Certificate SHA-256:** `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`.

These exact APK/AAB bytes were independently re-hashed, ZIP-checked, and offline-signed using the original maintained signing certificate on November 11. Signature verification, 16 KiB APK alignment, and packaged game-asset parity passed; original signing material remains private. The newly signed packages were saved to private Google Drive and downloaded back byte-for-byte identical: [APK](https://drive.google.com/file/d/1fngw44mVVhGLmMvztrcB-Vh4kZoYa-dd/view) and [AAB](https://drive.google.com/file/d/1Z6cwlAYXQ5zpxqcR0JRqDhYvCvEWIP84/view). They are not public tester links. GitHub's ordinary Android workflow publishes unsigned release payloads, not Play-accepted binaries. See [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6) for provenance and unresolved Play checks.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

# Thornhaven: New Journey

Thornhaven is a single-player Android RPG under active development.

## Current Android release candidate (verified November 11, 2026)
- **Version:** 1.0.67 (versionCode 169), package `com.vaelbrink.ashvale.newjourney`.
- **Maintained-key signed game source:** [`3dc2ac0b`](https://github.com/dbolden75/emberfall-game./commit/3dc2ac0b8cf73e5701bcff1d304414759482ef21); later changes to main update **release QA tooling**, not compiled gameplay.
- **Main-branch CI:** [Android APK/AAB build #42990810727](https://github.com/dbolden75/emberfall-game./actions/runs/42990810727) passed at `c9dff46a`; [emulator matrix #42959319330](https://github.com/dbolden75/emberfall-game./actions/runs/42959319330) passed with **temporary QA signatures**, not a Play-delivered update.
- **Maintained-signed APK SHA-256:** `c37cf54a52cd2223c68dbe6b8470dfa95f8cc03946c437c10f1f4e28db516dd7`.
- **Maintained-signed AAB SHA-256:** `9078bca83932e46e8101a6b5e924b754081910f5fc9c941ba110e9ad2e196623`.
- **Certificate SHA-256:** `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`.

These exact APK/AAB bytes were independently re-hashed and archive-tested on November 11. Original signing material remains private; GitHub main builds publish unsigned release payloads and disposable debug QA packages. See [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6) for the candidate's Drive provenance and unresolved Play checks.

## Testing links
- [Enroll in Thornhaven Google Play testing](https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney)
- [Google Play app listing](https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney)

These are the project's maintained package links; they do not establish that a tester is enrolled, the latest build is present on a Play track, or the application is publicly available.

## Release safety
Google Play Console must still verify whether versionCode 169 can be uploaded and whether the established upload certificate is accepted. Actual licensed Google Play purchases, restoration, Play-delivered upgrades retaining existing characters, and physical Samsung installation remain **unverified**.

**Never uninstall an existing Play-installed Thornhaven copy to force a sideload update**; that risks deleting saved characters and may bypass a distinct Google Play App Signing certificate. Use a same-certificate read-only preflight or a Play-delivered in-place update instead. See [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md) and [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6).

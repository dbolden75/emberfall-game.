# Thornhaven — Continuity and Release Handover

Updated 2026-11-11. This document is safe for the public repository. **Never** add passwords, keystores, signing-property files, access tokens, recovery codes or personal information.

## Current Android release identity (verified 2026-11-11)

- Player-facing title: **Thornhaven**; historical project names are Emberfall and Vaelbrink. The repository name is `dbolden75/emberfall-game.` (the trailing period is intentional).
- Existing Google Play application ID: `com.vaelbrink.ashvale.newjourney`. **Do not change the application ID, WebView origin, established save keys or maintained signing certificate.**
- Latest independently verified maintained-key signed candidate: **1.0.67**, Android `versionCode 169`; compiled game from commit [`3dc2ac0b`](https://github.com/dbolden75/emberfall-game./commit/3dc2ac0b8cf73e5701bcff1d304414759482ef21). Later merged changes through `c9dff46a` affect release-testing tooling rather than compiled game content.
- Historical maintained-key **1.0.57** release APK used for certificate comparison: versionCode 159.
- Maintained certificate SHA-256: `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`. This is the public certificate fingerprint, **not** the private signing key.
- Canonical signed 1.0.67 APK SHA-256: `c37cf54a52cd2223c68dbe6b8470dfa95f8cc03946c437c10f1f4e28db516dd7`.
- Canonical signed 1.0.67 AAB SHA-256: `9078bca83932e46e8101a6b5e924b754081910f5fc9c941ba110e9ad2e196623`.
- Current release evidence and Drive provenance: [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6), plus [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md). [BUILD-STATUS.txt](BUILD-STATUS.txt) is a historical log, not the authority for the current candidate.

## What has actually passed

- [Main Android build #42990810727](https://github.com/dbolden75/emberfall-game./actions/runs/42990810727) completed successfully after the recent release QA changes at commit `c9dff46a`. This builds unsigned release artifacts, not Play-accepted binaries.
- [Seven-job emulator matrix #42959319330](https://github.com/dbolden75/emberfall-game./actions/runs/42959319330) passed with **temporary debug signatures**, covering launch, controls, game-source save migrations and synthetic backup/restore. It did **not** install the maintained-signed APK.
- The historical 1.0.57 maintained signing certificate matched the independently verified 1.0.67 signed APK/AAB. APK v2/v3, AAB signature, 16 KiB alignment, game-asset parity and archive checks passed. The exact signed file SHA-256 values were rechecked on November 11, 2026.
- This does **not** prove Play Console acceptance, production app-signing compatibility, physical-device behavior, live purchase flows, or actual personal save retention.

## Open production gates — do not mark as Play-ready

1. Read Play Console's highest allocated version code. **169 may already be used.** Never upload a duplicate or lower code; choose a higher code only after checking Play Console.
2. Confirm Play App Signing/upload-certificate acceptance against the established app, including the correct upload key where applicable. The maintained-key certificate matching an archived APK does **not** prove Play acceptance.
3. Install a Play-delivered update *over the existing installation* on a test device; verify that characters, inventory, quests, settlement, house chests and backups survive.
4. Test gameplay on a physical Samsung device and authenticated Google Drive provider export/restore. These have **not** been established by emulator tests.
5. Review Play crash/ANR results and tester feedback before promoting a production release.\n6. Complete the Play Console trader-status declaration by **February 1, 2027** (deadline stated in Google's November 4, 2026 developer notice). Determine trader/non-trader status accurately; the account may also require app-level confirmation. This is an **account/policy task**, not something an APK rebuild can resolve.

**Do not uninstall an existing Play Store installation merely to test an APK.** Uninstallation can delete app-private character saves.

## Supported build paths

- Primary unsigned Android CI: `.github/workflows/thornhaven-android-build.yml`, which uses the maintained Gradle Android project and validates package identity for 1.0.67 (169).
- Legacy `.github/workflows/android-apk.yml` is now a compatibility dispatcher to that same maintained Android build, **not** the old alternate `com.thornhaven.game` Capacitor package (corrected in PR67).
- `.github/workflows/thornhaven-emulator-smoke.yml` runs disposable Android emulator tests with **debug** signatures.
- `.github/workflows/thornhaven-release.yml` can sign only if all original maintained-key secrets are present and verified. The normal safe route is to sign the CI-produced **unsigned** payload offline using the original maintained credentials. Do not invent a new keystore, embed secrets in source, or claim an unsigned artifact can update the Play app.
- The maintained-signed candidate uses `versionCode 169`; choose a fresh higher code **only if** Play Console confirms 169 is already allocated, then perform a clean build and sign with the original maintained credential.

## Product and project continuity

- Prioritize reliable launch, save protection, crash/freeze fixes, and monetization correctness over adding features.
- Preserve the four starting classes and Ashvale, Sunmere, Brackenford, Stonewatch, existing quests/endings, pets, companions, settlement systems and vampire storyline.
- Read [DESIGN-REFERENCE.txt](DESIGN-REFERENCE.txt) and [AGENTS.md](AGENTS.md) before changing maps, interface, rendering or packaging. A Sorrow-inspired visual redesign is a **direction**, not proof it has already shipped.
- Keep gameplay design proposals separate from implemented code, especially the emerging Bellwether storyline.

## Maintainer checklist

- Confirm access through Google Play Console's supported user-management controls; never share a Google account password.
- Keep separate backups of source, exact signed APK/AAB, provenance audit and original signing credentials.
- Confirm GitHub Actions, Drive file access, Play release status, testers, website/forum distribution and payout administration.
- Preserve a dated changelog. Never publish a replacement package ID or an unverified release.
- Play tester enrollment: https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney
- Play listing: https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney

**Release state as of 2026-11-11:** Maintained-signed 1.0.67 candidate and automated CI/emulator checks passed, but Google Play production-update compatibility, policy/account completion, and real-device save preservation remain unverified.

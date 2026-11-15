# Thornhaven — Continuity and Release Handover

Updated 2026-11-15. This document is safe for the public repository. **Never** add passwords, keystores, signing-property files, access tokens, recovery codes or personal information.

## Current Android release identity (verified 2026-11-15)

- Player-facing title: **Thornhaven**; historical project names are Emberfall and Vaelbrink. Repository: `dbolden75/emberfall-game.` (trailing period is intentional).
- Established Google Play application ID: `com.vaelbrink.ashvale.newjourney`. **Do not change the application ID, WebView origin, established save keys or maintained signing certificate.**
- Latest independently verified maintained-key signed candidate: **1.0.67**, versionCode **169**, merged GitHub main [`5bfb31d`](https://github.com/dbolden75/emberfall-game./commit/5bfb31d398392199bc475f3c23290d5b9ff8084b) after PR #298. The change prevents old clients from silently erasing future top-level world, quest and currency fields during saving or purchase delivery. Older PR #291/297 candidates are superseded.
- Original-key signed historical **1.0.57** release APK for certificate continuity: versionCode 159. The two separate 1.0.57 **dev-test** APKs use different signers and are **not** safe in-place upgrade bases.
- Maintained signing certificate SHA-256: `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`. This is the public certificate fingerprint, **not** a signing key.
- Canonical signed APK: [private Drive backup](https://drive.google.com/file/d/1_cy6Fh9K-IMKzQT2BZwR5IurVfWY-t9Q/view); SHA-256 `d3623239479d6800fc89d1d0c84688a735850a49b74742f1e2284cbac04588ab`; 37,624,860 bytes.
- Canonical signed AAB: [private Drive backup](https://drive.google.com/file/d/1lNsoeRtLn-zkMzFGpJdCyzIDmlXd-VXe/view); SHA-256 `a9094a779c813c513da61a7be82ed87ca6a292584884b0adcf968c8001e672ce`; 37,201,532 bytes.
- Release evidence and unresolved gates: [issue #6](https://github.com/dbolden75/emberfall-game./issues/6) and [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md). [BUILD-STATUS.txt](BUILD-STATUS.txt) is a historical log.

## What has actually passed

- [Android post-merge CI #43694551620](https://github.com/dbolden75/emberfall-game./actions/runs/43694551620) completed successfully at `5bfb31d`. The regular CI unsigned payload is **not** itself distributable.
- [Seven-job emulator CI #43694551670](https://github.com/dbolden75/emberfall-game./actions/runs/43694551670) passed at the same source; disposable QA signing and emulation are **not** physical Samsung/Play-installed testing.
- Original signed PR #298 APK v2/v3, AAB JAR signature, 16 KiB APK alignment, package/save identity, ZIP integrity and all 25 shared game assets were independently verified. Drive round-trip SHA-256 matched both signed originals. The deterministic top-level save guard passed 72/72 checks, and the historical 1.0.56 build kit passed its static verifier plus eight Node test suites.
- Unverified: Google Play Console versionCode 169 acceptance, upload-key/Play App Signing certificate match, Play-delivered in-place update with existing characters, real licensed purchase/restoration, and production rollout. **Do not uninstall or clear data** to bypass an upgrade blocker.

## Open production gates — do not mark as Play-ready

1. Read Play Console's highest allocated version code. **169 may already be used.** Never upload a duplicate or lower code; choose a higher code only after checking Play Console.
2. Confirm Play App Signing/upload-certificate acceptance against the established app, including the correct upload key where applicable. The maintained-key certificate matching an archived APK does **not** prove Play acceptance.
3. Install a Play-delivered update *over the existing installation* on a test device; verify that characters, inventory, quests, settlement, house chests and backups survive.
4. Test gameplay on a physical Samsung device and authenticated Google Drive provider export/restore. These have **not** been established by emulator tests.
5. Review Play crash/ANR results and tester feedback before promoting a production release.
6. Complete the Play Console trader-status declaration by **February 1, 2027** (deadline stated in Google's November 4, 2026 developer notice). Determine trader/non-trader status accurately; the account may also require app-level confirmation. This is an **account/policy task**, not something an APK rebuild can resolve.

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

**Release state as of 2026-11-15:** Maintained-signed 1.0.67 candidate and automated CI/emulator checks passed, but Google Play production-update compatibility, policy/account completion, and real-device save preservation remain unverified.

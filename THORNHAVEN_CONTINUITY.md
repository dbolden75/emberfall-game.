# Thornhaven — Continuity and Release Handover

Updated 2026-10-29. This document is safe for the public repository. **Never** add passwords, keystores, signing-property files, access tokens, recovery codes or personal information.

## Current Android release identity (verified in PR68)

- Player-facing title: **Thornhaven**; historical project names are Emberfall and Vaelbrink. The repository name is `dbolden75/emberfall-game.` (the trailing period is intentional).
- Existing Google Play application ID: `com.vaelbrink.ashvale.newjourney`. **Do not change the application ID, WebView origin, established save keys or maintained signing certificate.**
- Latest signed candidate: **1.0.64**, Android `versionCode 166`, from merged [PR68](https://github.com/dbolden75/emberfall-game./pull/68).
- Historical maintained-key **1.0.57** release APK used for certificate comparison: versionCode 159.
- Maintained certificate SHA-256: `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`. This is the public certificate fingerprint, **not** the private signing key.
- PR68 APK SHA-256: `9479cd2074f13286dd12f53b1071bb9fd8db7ec7c45b7340fb8e088534daf348`.
- PR68 AAB SHA-256: `06ce56a5d34d6ffdf06b8c3232dbef21f4075d49267d901543a1f76f15d35d4f`.
- Full verification and historical context: [BUILD-STATUS.txt](BUILD-STATUS.txt) and [BUILD-WORKFLOW.md](BUILD-WORKFLOW.md). The historical 1.0.55 notes below this project's earlier handovers are superseded by those current records.

## What has actually passed

- Fresh post-merge Android lint, regression checks and unsigned Gradle APK/AAB compilation: [Actions run 40961596542](https://github.com/dbolden75/emberfall-game./actions/runs/40961596542).
- Android 14 **debug-signed** emulator smoke and save upgrade from historical debug 1.0.57 to debug 1.0.64, including two saved characters and Android backup document export/restore: [Actions run 40961596604](https://github.com/dbolden75/emberfall-game./actions/runs/40961596604).
- Privately signed PR68 APK/AAB: original maintained certificate match, APK v2/v3 signature, AAB JAR signature, 16 KB alignment, ZIP integrity and game-asset parity. See the PR68 audit documented in [BUILD-STATUS.txt](BUILD-STATUS.txt).
- Prior release records report successful Google Drive backups with SHA-256 roundtrip verification. Do not assume a new package is backed up until checked independently.

**Important distinction:** The privately signed release APK was verified but **not installed** during the emulator upgrade test; the emulator uses debug-signed APKs. A successful debug upgrade does not establish Play signing or production upgrade compatibility.

## Open production gates — do not mark as Play-ready

1. Read Play Console's highest allocated version code. **166 may already be used.** Never upload a duplicate or lower code; choose a higher code only after checking Play Console.
2. Confirm Play App Signing/upload-certificate acceptance against the established app, including the correct upload key where applicable. The maintained-key certificate matching an archived APK does **not** prove Play acceptance.
3. Install a Play-delivered update *over the existing installation* on a test device; verify that characters, inventory, quests, settlement, house chests and backups survive.
4. Test gameplay on a physical Samsung device and authenticated Google Drive provider export/restore. These have **not** been established by emulator tests.
5. Review Play crash/ANR results and tester feedback before promoting a production release.

**Do not uninstall an existing Play Store installation merely to test an APK.** Uninstallation can delete app-private character saves.

## Supported build paths

- Primary unsigned Android CI: `.github/workflows/thornhaven-android-build.yml`, which uses the maintained Gradle Android project and validates package identity.
- Legacy `.github/workflows/android-apk.yml` is now a compatibility dispatcher to that same maintained Android build, **not** the old alternate `com.thornhaven.game` Capacitor package (corrected in PR67).
- `.github/workflows/thornhaven-emulator-smoke.yml` runs disposable Android emulator tests with **debug** signatures.
- `.github/workflows/thornhaven-release.yml` can sign only if all original maintained-key secrets are present and verified. The normal safe route is to sign the CI-produced **unsigned** payload offline using the original maintained credentials. Do not invent a new keystore, embed secrets in source, or claim an unsigned artifact can update the Play app.
- Multiple 1.0.64 candidates share `versionCode 166`; only one newly approved code should be selected for Play release after console verification.

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

**Release state as of 2026-10-29:** Signed candidate exists and package/signing checks passed; Google Play production-update compatibility and on-device save preservation remain unverified.

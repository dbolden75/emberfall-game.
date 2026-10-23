# Thornhaven — Continuity and Release Handover

Updated 2026-10-23. This document is intentionally safe for a public repository. NEVER add passwords, keystores, recovery codes, API tokens, or personal legal information here.

## Current known status
- Latest source package: Thornhaven-1.0.55-Play-Build-Kit.zip, in Google Drive / Thornhaven / Source and Build Kits.
- Version 1.0.55 adds equipment prizes to tavern games; automated JavaScript checks were reported passing. Android-device testing is still required.
- Android package identifier for the existing Google Play listing: com.vaelbrink.ashvale.newjourney.
- Google Play tester enrollment: https://play.google.com/apps/testing/com.vaelbrink.ashvale.newjourney
- Google Play listing: https://play.google.com/store/apps/details?id=com.vaelbrink.ashvale.newjourney
- A signed 1.0.55 AAB and Google Play release have NOT been verified.
- This repository's legacy android-apk.yml generates a DEBUG APK with the WRONG package ID. Do not use it for Play Store releases.
- Dedicated release workflow: .github/workflows/thornhaven-release.yml. Requires privately configured source and signing secrets and verification of build-kit structure. Do not assume it is operational without a successful run.

## Immediate priorities
1. Confirm private backup and access for a designated trusted maintainer through Google's supported account and app-access management; never share a Google account password.
2. Verify current Play Console release status and tester enrollment.
3. Make a signed AAB using the existing Play app signing/upload identity; verify applicationId, versionCode increment, certificate, and installability.
4. Release to internal/closed testing; review crashes, ANRs, and tester reports before wider release.
5. Update website and forum only with accurately verified release information.
6. Prioritize crash/freeze fixes and essential gameplay over new features.

## Continuity checklist for designated maintainer
- Confirm access to source archives and build kits in Drive.
- Confirm access to GitHub repository and Actions.
- Confirm appropriate Play Console user permissions via Play Console user management.
- Confirm website/forum administration and domain renewal details.
- Confirm that signing material is backed up securely, not in public GitHub.
- Confirm payment and payout administration is assigned appropriately; consult platform requirements.
- Keep a dated changelog, issues backlog, and backup of every released AAB.
- Do not publish unverified builds or rotate signing keys casually.

## Build/release acceptance
- Automated tests pass.
- Signed AAB generated with correct application ID and increased version code.
- Device installation and smoke tests pass (start, movement, combat, tavern rewards, inventory, save/load).
- Google Play processing succeeds and tester installation is confirmed.

## Current blocker
No verified signed 1.0.55 AAB or Play Console publishing connection. Release workflow requires secure inputs. This is a handover plan, not proof of release.

Provisional release candidate: 1.0.70/code172, pending highest uploaded Play versionCode confirmation. No signed 1.0.70 artifacts exist yet. The signed evidence below belongs to prior releases. Audio plus dormant Last Lantern only; PR313/314/315 excluded.

# Thornhaven build and test workflow

## Prior signed candidate — November 18, 2026

**Prior release:** Thornhaven **1.0.69**, versionCode **171**, package `com.vaelbrink.ashvale.newjourney`. The already-existing maintained-key-signed APK/AAB were built from game source commit [`2c57469a`](https://github.com/dbolden75/emberfall-game./commit/2c57469a), and their compiled game/native payload was independently compared with successful [post-merge Android CI at `fedca249`](https://github.com/dbolden75/emberfall-game./actions/runs/44283591292); only Git revision metadata differs. This comparison is **not** Play delivery or physical-device verification.

- **Signed APK:** [private Drive copy](https://drive.google.com/file/d/1mG3TkziZ57x1Pe-klXa6qqPfLlqTSMfq/view) — 41,442,899 bytes; SHA-256 `fc9cd5cb8eb2cbc51d45e52e0c30604be9d57572cb567a8e5e63d0238b4d9541` (canonical signed APK SHA-256 is `fc9cd5cb8eb2cbc51d45e52e0c30604be9d57572cb567a8e5e63d0238b4d9541`).
- **Signed AAB:** [private Drive copy](https://drive.google.com/file/d/12zeAVsIz_6g-r97E8fFskWGceeCjcSPe/view) — 40,962,262 bytes; AAB SHA-256 is `6efb75b13265bbbeb25727409efcc62b1b4292de5a559037dfbe5333603b4dfc`.
- **Upload certificate:** SHA-256 `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`; matches historical maintained-key 1.0.57, **not necessarily Play App Signing's delivery certificate**. Existing 1.0.57 development APKs have different signers.
- **Completed evidence:** successful post-merge CI, independent APK v2/v3 and AAB signature checks, 16-KiB APK ZIP alignment and byte-exact game assets. The current signed files were not rebuilt or resigned by this documentation update.

**Play Console is still the release gate:** confirm versionCode **171** is unused and the maintained AAB is accepted under this app's upload certificate; use an existing internal/closed testing track, and verify an over-the-top Play update retains character saves. Then test licensed Billing purchase, acknowledgement and restoration, plus physical Samsung touch/orientation/performance. **Do not uninstall or clear app data to force an update.** See [release issue #6](https://github.com/dbolden75/emberfall-game./issues/6). No Play upload, physical installation or live purchase is claimed here.

### Historical release instructions (do not select these old APKs for the next Play submission)


Current integration candidate source: 1.0.70, Android versionCode 172.

Current candidate integrates owner-approved browser v11: compact Party HUD, painted atlas, smoother movement/following, terrain/scale improvements and nonnegative defeated-enemy health. Native save keys and bridge retained. New Google Play submission and device acceptance remain pending; previous 1.0.68 evidence below is historical.

Development candidate: Alabama-inspired atlas geography; original 81 regions and quest routes retained. The original-key signed 1.0.68 APK/AAB passed offline verification; see the new atlas playtest links in README.md. The signed 1.0.67 candidate below remains the previous release.

**Previous maintained-signed release (November 15, 2026):** versionName `1.0.67`, versionCode `169`, package `com.vaelbrink.ashvale.newjourney`. The historical signed APK/AAB correspond to merged main commit [`5bfb31d3`](https://github.com/dbolden75/emberfall-game./commit/5bfb31d398392199bc475f3c23290d5b9ff8084b) (PR #298). The historical APK SHA-256 is `d3623239479d6800fc89d1d0c84688a735850a49b74742f1e2284cbac04588ab` (37,624,860 bytes). Historical AAB digest `a9094a779c813c513da61a7be82ed87ca6a292584884b0adcf968c8001e672ce` (37,201,532 bytes). Maintained certificate SHA-256: `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`. [Post-merge Android build #43694551620](https://github.com/dbolden75/emberfall-game./actions/runs/43694551620) and [7/7 emulator jobs #43694551670](https://github.com/dbolden75/emberfall-game./actions/runs/43694551670) passed. Exact signed files: [APK backup](https://drive.google.com/file/d/1_cy6Fh9K-IMKzQT2BZwR5IurVfWY-t9Q/view), [AAB backup](https://drive.google.com/file/d/1lNsoeRtLn-zkMzFGpJdCyzIDmlXd-VXe/view). Offline package/certificate checks passed. Play upload, Play App Signing identity, physical Samsung in-place update, existing-save survival and actual Google Play purchases/restoration are **not verified**.

Before submission, check the HIGHEST versionCode already uploaded to Google Play Console: current candidate versionCode 172 may not be available. Confirm the AAB's signing certificate is accepted as the existing application's upload certificate. Test a Play-delivered in-place update with existing saved characters, without uninstalling, and test real license-tester purchases and restoration. Physical Samsung testing and production Play acceptance remain unverified. IMPORTANT: the two historical 1.0.57 development APKs have distinct signatures, neither matching the maintained release. Thornhaven-1.0.57-dev-test.apk has certificate SHA-256 09ed9284b3e16e0181f7e9b428e5ed882bc66cf325c900212d40baf9dc817099. Thornhaven-1.0.57-fixes-dev-test.apk has certificate SHA-256 eba47475cc63815c8d16bbf7819a32dcd3991438e5c2336df2bbe10eb9e423b5. **Archive manifest correction (independently read with aapt):** despite their `1.0.57` filenames, both historical `dev-test` APKs actually declare `versionCode 158` and `versionName 1.0.56-dev`. The separately archived maintained-signed `Thornhaven-1.0.57.apk` declares code 159/name 1.0.57 and uses the maintained certificate. Never decide upgrade compatibility from filenames alone. A user with either development APK installed CANNOT perform an in-place update to a maintained-signed APK; an attempted uninstall can erase private local character saves. Before changing apps, independently verify an export/recovery path on the actual installed version; do not imply the later Cloud Save menu exists in both historical development APKs. NEVER advise uninstalling, clearing app storage, or sideloading the maintained APK over a differently signed installation without confirming recoverable character data. A Google Play-delivered app may have a different Play app-signing certificate than the upload certificate; test updates through the correct Play track rather than assuming upload-key APK compatibility.
### Read-only installed APK compatibility preflight

On a computer with a connected, authorized Android device and the Android SDK `adb`, `aapt` and `apksigner` tools installed, run:

```bash
python3 tools/android-upgrade-preflight.py /path/to/Thornhaven-1.0.70-maintained-key.apk
```

To compare a **saved historical APK file** without attaching a phone, run:

```bash
python3 tools/android-upgrade-preflight.py /path/to/Thornhaven-1.0.70-maintained-key.apk --installed-apk /path/to/Thornhaven-1.0.57.apk
```

This archive-only check reads the two APK manifests and signing certificates without `adb`, and fails closed on historical development-key APKs. The two known 1.0.57 development APKs are JAR/v1-only signed; the checker can recognize their certificates using bounded API-23 verification solely to display the specific blocking warning. It never reports a compatibility PASS on an APK that verifies only with legacy v1 signing. A passing archive comparison **does not verify what is installed on the Samsung phone**, its Play App Signing certificate, or saved characters; use the device preflight or a Play-delivered update for those gates. Never uninstall or clear app data to resolve a mismatch.

Use `--serial DEVICE_SERIAL` if more than one Android device is attached. This copies the *installed* base APK into a temporary computer directory without modifying the phone, checks both package identities and original-key signer SHA-256, and rejects a same-version/downgrade attempt. It **does not install anything or prove that character saves survive an update**. It fails closed if Android/SDK commands cannot inspect the installed application. A Google Play App Signing build may have a different installed signer than the locally maintained-signed APK; in that case never uninstall/clear data or sideload. Update through the existing Play track and validate saved characters instead. CI runs `python3 tools/test-android-upgrade-preflight.py` using mock manifests/certificates, not a real device.

BUILD-STATUS.txt is a dated historical status log, not the current release authority. Earlier entries below are historical release notes.
Package: com.vaelbrink.ashvale.newjourney. Keep this identity and the maintained signing key.

Run from this directory:

    python3 tools/build-test.py --signing-dir /private/key-folder --sdk /path/to/android-sdk --java-home /path/to/jdk17 --gradle /path/to/gradle-8.11.1/bin/gradle --browser /path/to/chrome

The signing folder contains signing.properties and vaelbrink-maintained.jks.
Never distribute that folder, create a replacement key, or put signing passwords in command arguments.
Release packaging starts with a clean build to prevent stale incremental ZIP entries. The signing tool requires the established certificate SHA-256 and deletes an output signed with a different certificate.

Requirements: JDK 17, Gradle 8.11.1, Android platform 36, build tools 36.0.0, Node, Python 3, and Playwright. Dependencies must already be cached for offline builds. A fresh host needs permitted access to the official repositories to install them. Runtime caches are temporary and are not included in this source kit.

Fallbacks:
- Drive source download: fetch raw files with include_base64=false. Inline downloads of this archive failed.
- Use an installed Gradle when the wrapper distribution download is unavailable.
- If browser startup fails with the known host socket restriction, the command automatically retains the log, records the unavailable browser test, and continues through the remaining gates. Other browser or gameplay errors remain fatal. --skip-browser is also available for an explicit omission. The report explicitly records skipped visual tests. Do not bypass host access controls or call this full gameplay testing.
- No connected Android device/emulator was available. Installation, touch controls, rendering and normal-speed gameplay must be tested on a permitted device/browser.

Checks: inline and external JavaScript syntax; static HTML asset references; mocked pet lifecycle regressions; Android release lint; release compilation; APK signing and certificate verification. Reports go to reports/, APKs to dist/.

Release process: edit versionCode/versionName in app/build.gradle; run the command; inspect reports/build-test.json; verify ZIP integrity and embedded game payload; save source and APK to the existing private Drive folders. Deliver the APK as a direct chat file link, not a Google Drive download page. Do not call a build fully tested when browser/device checks were skipped.

1.0.46 playtest changes:
- Open world atlas, no fog overlay.
- Local map with per-character saved exploration cells, discovered NPCs/objects, nearby enemies, pan, pinch zoom, location centering and player arrow.
- Additional Bloodbound Scout/Veil Stalker encounters in Whisperwood and Redfen. Existing vampire encounters retained. No added town/camp spawns.
- First quest pet claim free; replacements purchased with earned crowns. Existing owned pets count as already claimed.
- Earned pet death removes it; manual retreat, visible health bars and low-health warning. Removed automatic perfect pet dodging; human companions retain their existing dodge behavior.
- Pets explicitly tagged purchasedWithRealMoney recover rather than disappear. Current pet sanctuary uses earned crowns; any future payment grant must set this flag.
- Real-time combat retained; strikes followed by recovery openings: ordinary enemies 0.35s, vampires 0.45s, bosses 0.65s. Regression checks cover one strike and recovery expiry.
- Pet idle/attack motion, class-specific lunge, vampire attack windup motion and button feedback. Reduced hero texture bands from 40 to 28 for rendering cost.

Animation pass uses the existing artwork: added foliage/fire motion, monster anticipation/recovery poses, pet idle/attack motion, class lunges and menu transitions. Local maps use town building/road coordinates and discovered exits; exact quest-object markers appear only when the object explicitly matches the tracked quest. Quest directions remain visible in the footer. Terrain is schematic, not a miniature screenshot.

Limits: visual/device testing still required. This playtest does not contain newly drawn sprite sheets for every creature or all future settlement/narrative expansions. Existing companion and settlement systems remain intact. No complete normal-speed balance playthrough or Samsung A14 performance measurement has been performed.

1.0.47 graphics performance pass:
- Existing Android hardware acceleration remains enabled.
- Opaque world canvas avoids unnecessary alpha compositing.
- Offscreen environment artwork is culled with camera/zoom-aware bounds; rotated art retains normal rendering.
- Idle class bodies use one texture draw rather than 36 bands; walking and attack deformation remain intact.
- tools/render-checks.cjs validates culling and idle/moving draw counts. This is a draw-call reduction, not a measured FPS gain.
- Browser launch unavailable under host socket policy; Android device/GPU timing remains untested.

1.0.48: connected town progression. The settlement home shows a next objective using existing Edda rescue, founding, hall, frontier chapter, forge and lodge conditions. Buildings are grouped in a submenu. Repeatable timber/iron supply commissions require three fresh wilderness defeats after accepting; deliver in town for settlement supplies. No expiration or login streak. Claims check capacity and expected commission identity. Regression checks cover resource consumption, duplicate claims, save roundtrip and fresh patrol requirements. This is the first town loop, not the full future tavern/resident narrative or isometric map redesign. Android emulator setup is incomplete; no device playability claim.

1.0.49 (versionCode151): TheDanCode frame flags, local queue and acknowledgement-aware native HTTPS transport; session-only receiver settings; explicit world-canvas sharing; launch-adjacent ChatGPT request. Receiver prototype and editor regression checks included. No deployed receiver, AI viewer, live editing or device test. Android emulator reached ADB device state but did not complete startup within the test window.

1.0.50 (versionCode152): regional-map playtest. Walking-view fog now shares saved per-character exploration with the local map; world atlas opens at current region in detail mode and remains revealed. More fixed wilderness vampire placements use existing level scaling. Respawns defer near the player and quest/NPC objects. Visible modal panels stop simulation. Existing foliage/fire motion retained, fishing-water ripples added. No new attack sprite overhaul, schools or purchase features in this build. regional-checks.cjs covers fog, target visibility, spawn exclusions and panel detection. Device visual testing remains required.
Map-detail follow-up: biome-colored local terrain, main east/west road aligned with walking geometry, tree silhouettes and rock shapes replacing dots, restrained fixed ground flecks, and water ripples. Uses original rendering only; no Sorrow artwork included and no isometric conversion claimed.

1.0.52 (versionCode154): client-only Google Play Billing checkout, receipt verification, atomic purchase delivery, character-bound level/boost credits, cosmetic restore. See BILLING-RELEASE-NOTES.txt for tests, device-test gates and offline/refund limitations. Only Ember Halo configured in Play Console; remaining SKUs unavailable.

1.0.53 (versionCode155): published Android privacy policy linked from Options. TheDanCode developer character can grant test-only premium items without checkout, no expiry, local to that character; normal characters cannot invoke this grant and retain Play checkout. Google Play reviewer instructions disclose this mode. Normal builder progression gates remain. Purchase and reviewer checks passed; device and real Play purchase tests still required.

1.0.54 (versionCode156): removed obsolete asynchronous private scope around synchronous game initialization. All extension scripts now share the game bindings they require. Reproduced 1.0.53 ReferenceError activeMap in regionalSpawnSafe after a monster dies, which stops the frame loop and recurs on reload. Full-script mocked runtime regression now exercises Elderwood with a dead monster; no Android visual claim.

2026-10-27 1.0.63 release asset parity gate:
After rebuilding, tools/release-payload-checks.py asserts source/APK/AAB byte-for-byte parity for all game assets, unmodified historical localStorage save keys and WebView origin, versionCode greater than archived 1.0.62, and APK badging identity. This is not signing verification and does not establish Google Play acceptance or device save-preserving installation. CI runs this gate before offering unsigned release payloads. The maintained-key offline signing step and Play internal-test device upgrade remain separate requirements.

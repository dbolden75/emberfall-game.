# Thornhaven build and test workflow

Current main development source: 1.0.67, Android versionCode 169.

**Current candidate (November 14, 2026):** versionName `1.0.67`, versionCode `169`, package `com.vaelbrink.ashvale.newjourney`. The maintained-key-signed APK/AAB use source commit `e18b2e3b` (PR #291). The canonical signed APK SHA-256 is `1e8d8358aba8a7e058019ccec2b5beb443012281a992fc8ba9de6227c4843585`; AAB SHA-256 is `2e9fe6a1869dc69c7e191e8fda928f1790b1c3a310ede8b6897678cb56a60c27`. Maintained signer certificate SHA-256: `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`. [Android build #43612167596](https://github.com/dbolden75/emberfall-game./actions/runs/43612167596) and [seven emulator jobs #43612167592](https://github.com/dbolden75/emberfall-game./actions/runs/43612167592) passed. On November 14, independently verified signed APK and canonical Drive AAB matched all 25 shared assets and 15 Cloud Save compatibility assertions passed. Neither original-key package has been confirmed Play-accepted or physically installed on Samsung.

Before submission, check the HIGHEST versionCode already uploaded to Google Play Console: versionCode 169 may not be available. Confirm the AAB's signing certificate is accepted as the existing application's upload certificate. Test a Play-delivered in-place update with existing saved characters, without uninstalling, and test real license-tester purchases and restoration. Physical Samsung testing and production Play acceptance remain unverified. IMPORTANT: the two historical 1.0.57 development APKs have distinct signatures, neither matching the maintained release. Thornhaven-1.0.57-dev-test.apk has certificate SHA-256 09ed9284b3e16e0181f7e9b428e5ed882bc66cf325c900212d40baf9dc817099. Thornhaven-1.0.57-fixes-dev-test.apk has certificate SHA-256 eba47475cc63815c8d16bbf7819a32dcd3991438e5c2336df2bbe10eb9e423b5. A user with either development APK installed CANNOT perform an in-place update to a maintained-signed APK; an attempted uninstall can erase private local character saves. Before changing apps, independently verify an export/recovery path on the actual installed version; do not imply the later Cloud Save menu exists in both historical development APKs. NEVER advise uninstalling, clearing app storage, or sideloading the maintained APK over a differently signed installation without confirming recoverable character data. A Google Play-delivered app may have a different Play app-signing certificate than the upload certificate; test updates through the correct Play track rather than assuming upload-key APK compatibility.
### Read-only installed APK compatibility preflight

On a computer with a connected, authorized Android device and the Android SDK `adb`, `aapt` and `apksigner` tools installed, run:

```bash
python3 tools/android-upgrade-preflight.py /path/to/Thornhaven-1.0.67-main-e18b2e3-PR291-original-signed.apk
```

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

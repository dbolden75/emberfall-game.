# Thornhaven first audio pass — draft QA

The branch bundles 17 CC0 OGG files (7,227,525 bytes) behind 18 catalog cues.
Town, exploration and battle scores, forest and tomb ambience, and recorded
movement/combat/spell/heal/loot/gathering/UI effects replace the six oscillators.
Dungeon currently shares the battle recording at lower gain. Fishing uses a coin
reward cue provisionally; it is not a water recording. Physical-device audition
is still required before judging musical fit, repetition or mix balance.

## Runtime and source integrity

`game-audio.js` streams music/ambience, caps effects at eight voices and long
streams at two per bus, overlaps loop boundaries for three seconds, and holds
outgoing audio until incoming playback succeeds. Effects expire after 300 ms of
startup delay. Separate volume/mute preferences survive reload and migrate the
existing effects keys without changing saves. Trusted gestures unlock playback;
pagehide/visibility/focus events pause it, and Android resume dispatches pageshow.

`audio-integration.js` selects title/town/exploration/dungeon/combat soundscapes
with a combat release tail. `apply-audio-overlay.py` adds cues to successful
existing gameplay events; footsteps require actual movement. Story, compact HUD,
painted atlas, followers, gameplay, save format and billing remain unchanged.

Historical source payload pins remain enforced. Final HTML is reconstructed
through the baseline-pinned audio overlay; unrelated approved asset hashes stay
unchanged. `source-payload/audio-sha256.json` pins added audio sources and media.
No package/version bump, signing-key change, merge, release or deployment.

## Provenance and processing

`art-licenses/audio/provenance.json` records each output's author, exact source
member, source URL, original source/archive SHA-256, CC0 license, transformation,
output SHA-256, duration and size. Saved source-page evidence and Kenney's bundled
license accompany it; `art-licenses/audio/CREDITS.md` lists voluntary attribution.
`tools/prepare-audio-assets.py` reproduces processing from the verified source
bundle. This executor acquired the prepared media via the repository, not Library.

Exploration/battle silence margins were trimmed, music gain staged conservatively,
and forest ambience raised 20 dB before limiting. Real native-rate decoding found
fishing peak 1.027382: the follow-up applies 3 dB attenuation, records the
intermediate hash and postprocessing command, and updates output provenance/pins.
The original 8 kHz mono check could miss peaks; asset tests now inspect every
channel at the native sample rate. No subjective listening has been performed.

## Verification and reproduction

- `node tools/audio-checks.cjs`: mocked failure/race tests, gesture retry,
  repeated events, zero/mute, storage failure, missing assets, late promises,
  readiness-gated fades, loop handoffs, expiry and bounded concurrency.
- `node tools/audio-assets-checks.cjs`: catalog coverage, no missing/unused media,
  17 provenance/hash records, real FFmpeg decode and native-rate signal peaks.
- `python3 tools/browser-audio-media-qa.py`: real Chromium decodes all 17 files;
  verifies advancing media clocks and nonzero Web Audio analyser signals,
  overlapping scene/loop streams, repeated effects, zero/mute, paused clocks,
  resume, rapid transitions, actual game settings and persisted preferences.
  Active game pagehide/pageshow wiring is checked with real playing media.
  Console/page/media failures fail the test. Report: reports/audio-browser-media.json.
- `python3 tools/verify.py`, `python3 tools/verify-release-candidate-169.py`,
  `node tools/release-identity-checks.cjs`: JS/static references and source pins.
- `python3 tools/test-release-native-parity.py`: 12 archive-parity fixture tests;
  these do not establish parity for a newly built APK/AAB.
- All 136 `tools/*checks.cjs` pass, including the Java-dependent guards. This host
  contains OpenJDK compiler module 21.0.12.1 despite lacking a `javac` launcher.
  A temporary launcher invokes `/usr/bin/java com.sun.tools.javac.Main "$@"`;
  no compiler download or system package modification was needed.

Real browser signal measurements are automated evidence, not human listening.
No Android SDK, adb, sdkmanager or installed Gradle is available; no new Android
APK/AAB was built. Physical Android/WebView, Bluetooth/audio-focus interruptions,
phone loudness, performance and subjective loop/music suitability remain untested.

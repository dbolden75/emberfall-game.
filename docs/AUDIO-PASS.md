# Audio implementation work in progress

This branch is NOT a completed real-audio pass and must not be released. Media
acquisition is blocked: OpenGameArt page and file requests return HTTP 403 from
the environment network proxy, including an approved escalated download attempt.
The catalog is explicitly empty. There are no new licensed media files bundled,
no downloaded archive to inspect, no media SHA-256 provenance, and no audition.
The previous oscillators are replaced, so this WIP branch is silent until the
catalog and verified media are populated. No placeholder beep assets were added.

## Completed code

- `game-audio.js`: reusable streamed HTML audio engine, eight effect voices and
  at most two streams per long-form bus, 3-second playback-ready fades, per-cue rate limits,
  independent volume/mute preferences and migration of prior effects settings.
- `audio-integration.js`: title/town/exploration/dungeon/combat selection, combat
  tail, gesture unlock/retry, background silence, and settings controls.
- `apply-audio-overlay.py`: deterministic, baseline-pinned source edits for the
  six legacy effects, successful gathering/loot, spell/heal and damage events;
  footsteps require actual movement. Story and simulation remain unchanged.
- Android resume dispatches pageshow, paired with its existing pause/pagehide.
- Historical payload hashes remain enforced. Only the intended final HTML digest
  changed; new audio sources have additive pins in audio-sha256.json.

## Required asset handoff

The parent researcher verified CC0 on each item page (2026-11-18). This executor
could not independently retrieve those pages or files. These are candidate
provenance records, NOT claims that downloaded media has been verified:

| Role | Author | Item page | Download filename |
|---|---|---|---|
| Town | cynicmusic | https://opengameart.org/content/town-theme-rpg | TownTheme.mp3 |
| Exploration | pauliuw | https://opengameart.org/content/the-field-of-dreams | the_field_of_dreams.mp3 |
| Battle | Wolfgang_ | https://opengameart.org/content/battle-theme-0 | Battle.mp3 |
| Forest | TinyWorlds | https://opengameart.org/content/forest-ambience | Forest_Ambience.mp3 |
| Dungeon ambience | kindland | https://opengameart.org/content/forgoten-tomb-ambience | Forgoten_tombs_1.mp3 |
| Effects | rubberduck | https://opengameart.org/content/80-cc0-rpg-sfx | 80-CC0-RPG-SFX_0.zip |

Downloads are under `https://opengameart.org/sites/default/files/`. The proposed
catalog keys are step, attack, hit, quest, level, menu, spell, heal, loot, mining,
woodcutting, fishing; town, exploration, combat, dungeon; forest, tomb. Each row
requires `{src:'audio/<file>', gain:<0..1>}`. Select matching recorded effects from
the inspected archive. Dungeon can initially share a conservatively mixed battle
score if listening confirms suitability. Do not infer looping quality from names.

Before completing: save source-page license evidence and original-file/archive
hashes; record exact source members, author, CC0 URL, transformation command,
output hash/duration/size per bundled file; transcode long files conservatively,
check decode integrity and peaks, inspect loop seams, and audition on Android.
Add an asset-integrity test that rejects missing catalog files and unused media.
Update audio-sha256.json for the actual catalog and every media file.

## Validation boundaries

`node tools/audio-checks.cjs` exercises the engine with mock media: repeated
cues, bounded concurrency, zero volumes, mute persistence, blocked autoplay and
next-gesture retry, missing/broken assets, failed storage, late promises after
pause, resume and rapid transitions. `python3 tools/browser-audio-qa.py` uses real
Chromium for controls, trusted unlock, persistence and lifecycle wiring; it is
not playback validation with the currently empty catalog.

`python3 tools/verify.py` checks JS and static references. The release candidate
and identity source gates verify the intended HTML and untouched existing asset
hashes. Native parity tests use fixture archives, not a new APK/AAB. The host has
Java runtime only, no javac or Android SDK; native checks/build remain pending.
No release, signing-key change, deployment, merge, physical phone audition or
Bluetooth/interruption/audio-focus test has occurred.

Local verification on 2026-11-18: 123 of 135 `tools/*checks.cjs` passed.
The remaining 12 invoke unavailable javac (including the snapshot guard, whose
message reports `javac: undefinedundefined`). All 12 native parity fixture tests
passed. Fresh baseline reconstruction plus overlay reproduced final HTML hash
`62448268f320032ddbe1f37409bb5c3d7633eecc89481207771dc640b3959117`.
Chromium audio UI, audio engine, JS/static-reference, release-candidate source
pins and identity checks passed. No new APK or AAB was built.


## Library handoff attempt and playback follow-up

The confirmed Library source bundle (17,620,154 bytes) was requested through the
current supported resolved-reference materialization helper. Initial download
and one approved retry both returned `library file transfer failed: download
failed`. No local archive exists; no bytes were extracted or validated. Network
requests to OpenGameArt were not retried. Media count and packaged media size
remain zero. The completed source bundle still needs an accessible supported
transfer; do not treat a remote workspace path as locally acquired bytes.

The engine now retains outgoing audio until the new play promise succeeds,
overlaps the final three seconds of long tracks with a second stream, and expires
effects whose playback has not started within 300 ms. Native media looping is
only a decoder-stall safety net. New mocked-media tests cover held outgoing
volume, overlap, bounded loop handoff and delayed-effect expiry. These changes
have not yet been exercised against the source bundle or a physical device.

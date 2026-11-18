# Last Lantern development addition

Scope: the first approved ruined-church lair, outside Briar Hollow. The four living towns are unchanged; their proposed active churches remain paused. Two further dead-town/lair concepts require separate narrative approval and are **not implemented** here. This branch is not a release, and does not change Android version, package, signing, or deployment settings.

Base: `5f236f23deeb8aeadf8049ff84f367a07a7ee403` (main fetched November 18, 2026).

## Closed story gate — reveal decision still pending

**Ordinary play cannot currently discover or enter Last Lantern.** Eligibility requires the character-local boolean `townQuestState._lastLanternAccess.revealed === true`. This is an isolated technical seam, not an invented reveal chapter. There is no production setter, developer-menu override, NPC unlock or automatic migration that grants it. Level, camp completion, Briar Hollow completion, elapsed time, visiting a map and accepting Night Visitor do not authorize access.

When closed: no Briar entrance object/label/exit, no atlas position/selector entry, no Last Lantern journal/history entry, no new NPC or bestiary entry, and `setMap`, `travelTo`, direct atlas details and stale entrance callbacks cannot expose or enter it. The room definition remains registered for lossless save handling, but is unreachable. Opening the gate later restores the authored experience without rewriting its content.

Tests explicitly seed this proposed milestone **only in isolated QA characters/storage** to exercise later-story gameplay. There is no shipped QA override and no write to ordinary player saves. Committed gameplay screenshots therefore depict QA-authorized later-story content, not a newly available early quest.

Previously acquired Last Lantern discoveries, enemy defeats and rewards are retained. A development save physically inside the lair without the explicit flag resumes on Briar Hollow's road while keeping those records. No unrelated released quest is migrated. How to recognize legitimate advanced released characters, which approved event reveals vampires, and how that event grants this eligibility remain **unapproved integration decisions**; no level/quest heuristic substitutes for them.

## Playable route after approved reveal integration

Once the explicit per-character eligibility exists, in Briar Hollow, interact with the Last Lantern sign at `(650,315)`, east of the remembrance stone. Choose **Enter the ruined church**. The separate `last_lantern` map has a churchyard, a nave with displaced benches and boarded windows, and an undercroft reached through a stair threshold. Both 100-pixel doorways remain open. The southwest return marker works during combat and after clearance.

This is a level-13 region using normal hero-relative scaling. Two Bloodbound Scouts use Blood Lunge; a Veil Stalker uses Veil Strike. Captain Veyr is a local raider captain using the existing Crimson Sweep pattern and boss minimum of hero level +2. The Crimson Elder's original encounter and definition are unchanged. There are no friendly civilians in the occupied lair.

The optional **A Light Beneath the Ruins** quest records the refuge register, severed warning rope and wagon inventory. Clear all four raiders, secure all three discoveries, and relight the road lantern for **65 crowns and 70 XP once**, in addition to standard combat rewards. No new weapon is awarded. Coded destinations remain unresolved. Repeated interaction permits rereading the evidence and completion text without rewards.

Briar Hollow's existing clues, Ada rescue, remembrance stone and 35-crown/40-XP reward remain independent. The new evidence neither resolves the missing residents nor identifies the black-cloaked rescuer. Veilhaven's neutral residents, charter and ferry remain unchanged. Hollowmere's unintegrated JSON design is not treated as playable content.

## Source and persistence

`app/src/main/assets/last-lantern.js` owns the authored content. `tools/apply-last-lantern.py` inserts it before `freshCharacterState`, after the immutable 1.0.69 restoration. This placement is essential: initial saved-map restoration and new-character snapshots must already know the new map. Do **not** append a second script tag for the module.

The one geometry hook reads `solidAreas` through the existing `fixedSceneryAreas` function. Normal bounds, collision, pathfinding, camera, enemy combat and dialogue-pausing functions stay in control. The local-map renderer uses those same rectangles; explored fog still applies. No shared outdoor dimensions are changed.

`townQuestState.last_lantern` contains only per-character booleans: acceptance, three discoveries, four defeated raider IDs, clearance and reward claim. Enemy positions/health use the existing indexed `mapStates.last_lantern` snapshots. Defeat flags are set before the normal combat save. Applying any character first resets this map's runtime enemies, then restores that character's snapshot and defeat flags. Old saves with no new map entry receive fresh encounters without inheriting another slot's clearance. Cloud validation recognizes the map and rejects malformed quest booleans.

Closed-default, alternate-route and no-heuristic-unlock assertions accompany the gameplay checks. The historical hash gates still verify the original pinned 1.0.69 baseline after removing the **exact** current overlay; missing or edited generated content fails verification. The canonical module remains ordinary reviewable source, rather than replacing historical binary chunks. The generated HTML and restored atlas PNG are not committed.

From a fresh checkout:

```sh
python3 tools/restore-game-source.py
python3 tools/restore-1.0.69.py
python3 tools/verify.py
python3 tools/verify-release-candidate-169.py
node tools/last-lantern-checks.cjs
python3 tools/browser-last-lantern-qa.py
```

Restoration intentionally refuses to overwrite differing generated HTML. Preserve any local changes before recreating that output when iterating on the module.

## Integration with parallel PR #315

This branch starts from main, not PR #315. It does not alter Elderwood geometry, `soft-fog.js`, global world dimensions, or collision/path algorithms.

Review these shared seams when combining:

- `tools/restore-1.0.69.py`: both additions must run **after** baseline authentication. Keep each overlay's distinct markers, and initialize authored maps before the first character snapshot.
- `tools/verify-release-candidate-169.py` and `tools/release-identity-checks.cjs`: compose exact overlay removals in reverse application order before checking the historical baseline. Do not substitute the old hash for combined generated content.
- `app/src/main/assets/cloud-save-core.js`: retain both PRs' map-coordinate/activity guards and this map ID/boolean validation.
- `app/src/main/assets/playtest-update.js`: retain PR #315's region-aware local-map transforms and this small `solidAreas` drawing loop.
- `.github/workflows/thornhaven-android-build.yml`: retain both browser suites and their artifact paths. Last Lantern's source overlay runs automatically through the restore script; it does not require another workflow restoration command.

Reusable technical seams for later authored lairs: data-driven `solidAreas`, named bidirectional `mapConnections`, initialization before the fresh snapshot, and map-scoped save validators. Each future adventure must have a distinct layout, history, discoveries, encounters and story, as well as its own map IDs, quest namespace, enemy IDs and single reward transition. Shared low-level engine utilities do not authorize cloned narrative experiences. The central hero retains selectable class and gender; this addition imposes no canonical name, identity, belief or companion change. Do not copy Last Lantern's discoveries, captain, codes or reward flags into another town. No second or third plot is proposed by this module.

## Validation and limits

See `reports/last-lantern/aggregate.json` and `results.json` for execution evidence. Focused checks cover object/enemy/entrance reachability, collision at walls and doorways, retreat with surviving enemies, scaling/boss floor, partial/completed/legacy restores, character isolation, cloud validation, duplicate reward prevention, and unchanged living-town/sanctuary safety.

Browser QA uses real Chromium UI, frames, keyboard movement, dodge and held attack controls in landscape and portrait. QA relocation sets up encounters; it is not a complete unaided navigation/balance playthrough. In-memory storage transport supports fresh-document reload tests, not Android filesystem durability. Screenshots use the game's actual artwork via a local intercepted asset route.

Local aggregate: **123 of 135 Node suites passed**. The remaining **12 failed at the unavailable `javac` prerequisite** (native back-navigation/cloud-picker/Billing checks); their native assertions were not run. No gameplay regression failure remains. Source syntax/asset checks, baseline-plus-overlay verification, atlas geography/world-map checks and focused runtime tests passed.

Android build/emulator, physical Samsung touch/performance, Play-delivered updates and live Billing are unrun locally. No release, signing, merge or deployment was performed.

## Existing early spoilers found (reported, not rewritten)

These are pre-existing in the restored main game at the recorded base, outside this addition:

- `briarInteract`: Ada explicitly says “Vampires” after the three local clues; the remembrance completion states that the raiders were vampires. The camp chapter already points the player to Briar Hollow.
- `vampireMonsterDefs` and its placement loop: Bloodbound Scouts/Veil Stalkers are placed in accessible wilderness including Whisperwood, Redfen and Greenhollow without a later-story reveal gate.
- `vampireBestiaryText` / `openBestiary`: the bestiary lists “VAMPIRE RAIDERS”, named types and encounter regions without a reveal check.
- The `plainLabels` menu mapping calls Night Visitor “Vampire story” unconditionally. `startVampireStory` needs level 3/night/Ashvale and journal availability, not an approved later-story milestone. `openVampireStory` explicitly reveals Serin after three clue regions.
- Veilhaven's atlas hint, Worldsend ferry description, charter and resident dialogue explicitly discuss vampires. They remain neutral; none is made the king or conflated with Auren/Hollow Regent.

Coordinated pacing must decide those gates separately. This PR does not claim the whole game's early vampire exposure has been fixed, and does not invent the vampire king, a reveal chapter, or a new hero identity.

## The Weight of a Record — political quest slice (release held)

This increment adds an optional playable discussion at Veilhaven using its three existing neutral residents. It requires the same explicit `_lastLanternAccess.revealed === true` milestone plus Last Lantern completion and all three secured discoveries. There is still no production milestone setter. Ordinary new characters cannot reach either addition; QA explicitly seeds the milestone. No development override is shipped.

Review the actual secured evidence, hear all three residents, and return to Vaelis to endorse one document. Mirelle prioritizes unconditional refuge, Vaelis accountable testimony, and Orven prevention through cautious observation while retaining responsibility for his former work. Each acknowledges the cost of their own priority and disputes the others without becoming hostile. The player permanently selects a refuge note, witness ledger or road-watch brief. Confirmation explains that this is a recommendation, not authority over residents. Only that document is prepared.

The selected path then requires a different follow-up to finish the quest: Orven discusses intimidation at refuge arrivals; Mirelle demands witness safeguards; Vaelis demands corrections to uncertain sightings. This branch-specific knowledge is earned by returning to the relevant resident and remains in the journal and subsequent dialogue. Other proposals remain unadopted. This is a small dialogue-based political choice, not a simulated faction campaign, a deployed patrol, a rescue, or a change in sovereignty. It grants no currency, XP, equipment or allegiance. No essential main-story answer is exclusive to this optional quest. The codes, named missing residents, stranger and king remain unresolved.

State is `townQuestState.veil_counsel` with strict optional booleans `reviewed`, `mirelle`, `vaelis`, `orven`, `response` and enum `choice: refuge|testimony|watch`. Every mutating choice checks current character eligibility, current map, real NPC identity, proximity and unresolved state. Character switching and replay cannot duplicate rewards (none exist) or overwrite a choice. Other NPC conversation remains available. No class, gender, transformation, companion or faith condition is added.

### Production-access blocker

Existing `startVampireStory` allows level 3/Ashvale/night; `vampireInvestigate` names vampires during its Mosslight clue, and `openVampireStory` reveals Serin after three regional clues. That is not the requested late shared-hero investigation. The armory mystery instead has class-specific canonical histories. Briar completion is already an early camp-directed quest. No existing approved late evidence sequence or functioning-church recognition scene connects these to the shared reveal milestone. Automatically choosing one would change pacing or hero identity beyond this bounded slice. The gate therefore remains closed pending that coordinated progression decision. Broader early spoilers listed above remain a release blocker. This does not satisfy ordinary-player access yet.

### Incremental integration into PR317

Apply the incremental commit after `bef08159b4c6103c7e322776aaffb2182a75b6d5` on the integration owner's branch; do not replace its restore scripts, audio settings or payload checks. Changes remain inside the existing Last Lantern overlay, cloud quest validation, tests, this documentation and three Android-workflow lines. No new script ordering or engine hooks are introduced. Reconstruct from PR317's authenticated baseline/audio composition and inject the updated exact Last Lantern block; update only the composed-payload expectation if the integration pipeline pins it. Exact overlay removal must use the updated module. Keep all audio identity and save guards. Run both browser suites and the full aggregate on the combined source. PR317 was not modified by this task.

### Increment verification

All 136 Node `*checks.cjs` suites plus source syntax/asset verification, release baseline verification and both atlas/world scripts passed (140 commands). Native Java checks used the installed Java 21 compiler module through a temporary launcher, not an Android device. Two initial geography invocations pointed to `tools/` instead of `scripts/`; the corrected commands passed and both attempts are retained in the evidence JSON. Focused runtime tests cover all three recommendations and follow-ups, cloud round trips/rejection of invalid fields, old saves, missing evidence/gate, stale map/character callbacks, all four classes/two genders, ordinary conversations and unchanged Last Lantern rewards.

Chromium portrait/landscape covers physical UI interaction with the existing NPCs, evidence review, all three proposals, the testimony decision and its distinct Mirelle follow-up, partial/completed full-document reload, reentry and hiding new content when the gate is absent. The other two decision outcomes are runtime-tested, not separately browser-played. Existing Last Lantern portrait/landscape combat/navigation/save QA also passed. QA seeds late eligibility and relocates the hero; it does not establish a reachable production reveal. Browser storage uses the repository's in-memory test transport. See `reports/veil-counsel/` for results and screenshots. No combined PR317 build, new-head Android CI result, physical device, Play upgrade or audible-output claim is made here.

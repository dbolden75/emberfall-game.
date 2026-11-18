# Elderwood activity and save follow-up (draft)

This extends the same PR315 terrain prototype. Original central content and
coordinates remain intact. Movement speed, quest text, gates and economy rules
are unchanged. This is sparse playable exploration, not a content-complete
region or hidden-settlement implementation.

## Six optional pockets

All coordinates below are map units. The manifest order in
`app/src/main/assets/wilderness-activities.js` is append-only and forms saved
array indices. Original arrays retain their order and values before this tail. Do not reorder or remove rows in future versions.

| Pocket | Resources (exact coordinates) | Existing encounters (spawn coordinates) |
| --- | --- | --- |
| Western lake shore | River fish (−6120, −1600) | None; quiet route |
| Lower western lake shore | River fish (−5580, 1920) | None; quiet route |
| Northwest ridge | Copper (−2800, −2200), iron (−2650, −2250), silver (−2500, −2280) | Skeletons (−2600, −2020), (−2450, −2150) |
| Eastern woodland | Hardwood (4000, −1950), (4150, −1900), (4280, −1940) | Spiders (4270, −2170), (4450, −2180), (4480, −1990) |
| Southern wetland | Hardwood (−2600, 3470), (−2730, 3350); river fish (−2090, 3300) | Slimes (−2410, 3250), (−2510, 3430) |
| Northeast ridge | Copper (7000, −3450), iron (7150, −3390) | Skeleton (7270, −3440) |

Six short side trails and clearings connect these pockets to the two outer
loops. The main arms remain clear. Different resource/tool requirements and
quiet versus guarded detours provide choices without uniformly filling the
map with enemies. Existing terrain, tree, stone and fish vocabulary is reused.

There are eight appended enemies (four original remain) and thirteen appended
nodes (137 originals remain). Ordinary regional scaling, attacks, drops and
respawning are used. At combat level L, the existing ordinary reward is
14+4(L−1) XP and 3+floor((L−1)/2) coins, with the existing regional loot roll.
Respawn delay is 20 seconds, deferred while the hero is nearby. No guaranteed
new chest, premium reward, unique item or quest reward is added.

Gathering uses existing tools and requirements: copper/fish level 1,
iron/hardwood level 3, silver level 5. Existing rewards are one item, the normal
25% second-item chance at gathering skill 4+, 12 skill XP, and a 30-second
cooldown. Hardwood selection follows Elderwood's existing map level. These
assume existing repeatable gathering/respawn rates are acceptable; no economy
retuning or long-term farming balance claim is made.

## Persistence and synchronous save cost

The dominant saturated-save cost was repeated JSON parsing/stringification.
The durability guard now passes its already validated snapshot into the base
writer. The writer serializes slots once, writes synchronously, verifies exact
full-slot bytes, then publishes its in-memory cache and existing mirror/prefs.
The guard checks the same receipt and exact bytes. This removes a duplicate
snapshot and redundant readback parse/state serialization: four parses and six
stringifies become two and three. Existing damaged-slot and live-state checks
remain. No writes are deferred; important checkpoints and lifecycle hooks still
invoke the same synchronous save. Storage atomicity remains the existing single
localStorage key commit, with fail-closed readback and retry behavior.

The portable cloud schema stays version 1, with unchanged size/node limits and
recovery/validation. New content adds 958 bytes per character in these fixtures.
Old saves initialize only the new tail; saved new deaths/cooldowns restore on
cold startup and ordinary load. Switching to an old slot resets new tail state
without touching original progress. Older clients reject the enlarged entity
layout rather than silently dropping new progress; exporting back to an older
client is not supported. No actual user save was read or overwritten.

Comparable desktop Chromium154 / Node24 / Linux QA, seven samples per case,
using the same in-memory localStorage adapter (milliseconds, medians):

| Explored Elderwood cells | Slots | Before | After |
| ---: | ---: | ---: | ---: |
| 0 | 1 | 3.5 | 2.9 |
| 0 | 4 | 6.2 | 6.3 |
| 512 | 1 | 3.9 | 2.3 |
| 512 | 4 | 8.1 | 6.3 |
| 36,150 | 1 | 71.4 | 37.3 |
| 36,150 | 4 | 121.0 | 87.2 |

Fully explored single-slot maximum: 76.6 → 40.3 ms; four-slot maximum:
167.8 → 99.1 ms. Saturated one-slot parse/stringify components were
28.1/40.5 → 15.6/20.4 ms; four-slot 58.5/60.7 → 40.9/41.8 ms.
These are component medians and need not sum to total medians. The final after
fixture includes the new activities. Saturated bytes are 482,917 per one-slot
store and 1,931,665 for four slots. Full fog cold rebuild remains the separately
measured 55–85 ms from the terrain follow-up. Four-slot saves can still hitch;
this does not establish native Android performance or disk-write latency.

Raw samples: `verification/wilderness-save-before.json` and
`verification/wilderness-save-after.json`. Reproduce with
`python3 tools/browser-wilderness-save-performance.py /tmp/save-profile.json`.

## Navigation regression and validation

Combat-inclusive traversal exposed a real departure stall beside a hardwood
tree. The path was valid, but the old player update tested X movement before Y
and cancelled the tap during the intermediate tangent collision. Elderwood tap
movement now accepts a collision-free combined step, matching the existing
follower approach; manual movement, other regions and speed are unchanged.
`wilderness-player-navigation-checks.cjs` drives the production frame loop from
21 nearby departure positions and checks collision every frame. The earlier
source fails the same regression at angle 0.3; the corrected source passes.

`wilderness-activity-checks.cjs` covers original progress preservation, fresh
appended content for old saves, 63 reachability queries (21 approaches at three
radii), actual gather quantities/requirements/cooldowns, actual kill rewards,
immediate death/gather checkpoints, respawn proximity/far respawn, slot
isolation, cold startup, cloud encode/parse/import and recovery backup. It also
checks that an old client refuses the appended layout rather than losing it.
`wilderness-save-transaction-checks.cjs` covers a 36k-cell fixture with exactly
one snapshot, quota/drop faults, altered inactive-slot bytes, interrupted
readback, mirror failure, no unverified cache publication, retry and two slots.
Existing background-save, snapshot-failure, malformed-state and cloud integrity
gates remain applicable; no validation limit or authenticated hash was relaxed.

The live browser circuit uses actual RAF time at 190 units/sec, existing starter
sword/chainmail/tools, gathering skill levels sufficient for these resources,
one existing pet and cleric Corin. Only the original four central encounters
are suppressed to isolate this addition. New enemies retain their normal stats,
AI, scaling, respawns and rewards. The driver attacks nearby enemies, uses the
existing combat skill/healing/selling actions, and gathers all thirteen nodes.
This is assisted automated traversal, not an unaided human balance playtest.

Native Android testing remains blocked: this image has a Java runtime but no
javac, SDK or adb/emulator. The prior Gradle distribution download also failed.
No build was published; artifact-producing remote CI is deliberately skipped.
Audio PR312 and companion PR313 are untouched. Their original character and
quest coordinates still apply; added activities carry stable IDs but no voice
or dialogue content. Future integration must preserve authenticated baseline
restoration before all source overlays and append-only entity indices.

Final aggregate: 128/140 Node checks passed, including release identity run
separately before the overlay; the other twelve require missing javac (exact
names and outputs in `verification/wilderness-activities-checks.json`). All
11 Python workflow regressions passed. Syntax/assets, authenticated restoration,
release gate and overlay reproducibility passed. Workflow mutation tests still
reject premature overlays and baseline hashes checked after mutation.
The geometry test now covers 150 objective/resource approaches, 462 queries at
three radii, all four exits, all six exit pairs, reciprocal transitions,
authored roads/spurs, old spawn safety, cloud outer positions, central collision
preservation and camera/zoom transforms. Current generated tree count: 1,773.
Mocked-VM query median/p95/max was 41.5/237.3/520.1 ms in the aggregate run;
this broader workload includes long new activity routes and ran alongside
browser QA. It is neither a native frame-time measurement nor evidence that
arbitrary mobile path requests are hitch-free. Runtime grid/cache budgets remain
35,760 cells, two regional radius grids, eight total grids and 12k expansions
per query. Browser activity-path samples are retained separately in
`verification/wilderness-activities-browser-probe.json`.

Desktop Chromium activity-path median/p95/max across 63 probes per viewport:
landscape 11.7/25.5/69.7 ms; portrait 10.9/24.9/51.8 ms. Both runs had zero
uncaught browser errors. The existing interactive suite passed portrait and
landscape save/resume, fresh-page reload and atlas interaction on final source.

Final combat-inclusive circuit: **35/35 waypoints**, **8/8 distinct new enemies
killed**, **13/13 resource nodes gathered**, **52,379 units in 291.41 seconds**
using normal RAF and speed 190. Both followers remained active through 16,381
updates; zero sampled collisions, zero recovery snaps, maximum lag 146.1 units.
The hero took 12 damage, used no healing potion, sold four inventory units via
the existing selling action, and progressed level 1→3. This loadout and cleric
support make it a permissive traversal test; solo difficulty, farming balance,
long-session pacing and native touch/FPS still require playtesting. Raw evidence
is `verification/wilderness-activities-circuit.json`. Reproduce with
`python3 tools/browser-wilderness-activities-qa.py` (about five minutes).

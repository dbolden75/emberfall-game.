# Elderwood wilderness slice (draft; no release)

Base: main `5f236f23deeb8aeadf8049ff84f367a07a7ee403` (November 18, 2026).
The root index.html is an older prototype. This change targets the restored
Android/browser game under app/src/main/assets, through a small authenticated
source overlay and a separate wilderness-slice.js module.

## Scope and geometry

Elderwood is a generated non-town forest region, with four reciprocal compass
exits and no authored town/home/dungeon geometry. Its existing enemies, NPCs,
world objects, fishing spot, gathering nodes, text, rewards and gates are
unchanged. The original center remains at its old coordinates; existing local
exploration cells still mean the same places. New terrain is not saved as
entities and does not multiply the other 80 world slots.

| Geometry | Original | Slice |
| --- | ---: | ---: |
| Render dimensions | 3,840 × 2,400 | 15,360 × 9,600 |
| Playable dimensions | 3,796 × 2,320 | 15,316 × 9,520 |
| Playable area | 8,806,720 | 145,808,320 (16.56×) |
| X bounds | −1,418 … 2,378 | −7,178 … 8,138 |
| Y bounds | −855 … 1,465 | −4,455 … 5,065 |
| Navigation grid | 15,423 cells at 24 units | 35,760 lazy cells at 64 units |

Four main arms connect to the original roads. Two unequal outer loops branch
around western lakes, northern stone shoulders, eastern woodland belts and
southern wetland islands. Twelve authored terrain footprints and 1,851
seeded, clustered trees provide obstacles and recognizable route choices.
Open meadow bands and route shoulders separate clusters; the module does not
repeat the original map template across the enlarged area. Road cuts, terrain
footprints and tree trunks govern collision; the local map uses that terrain
geometry under existing discovery fog. No new plot, named settlement, loot,
quest or enemy reward is introduced. Existing activity remains concentrated in
the old center: this is a traversal/terrain slice, not a completed encounter
or reward-density pass for the outer loops.

At the existing 180–235 units/sec, an unobstructed full width takes about
65–85 seconds rather than 16–21; full height takes 41–53 rather than 10–13.
These are distance/speed estimates, not measured exploration duration.
From the central arrival to north/east/south/west entries, tested paths were
4,712 / 7,757 / 4,861 / 7,600 units. Terrain loops add optional distance.
No hours-of-content claim is made.

## Runtime bounds and compatibility

Regional dimensions feed worldBounds, camera, screen/map transforms, ground
painting and edge markers. Destination bounds use the destination's ID.
Other regions retain their old sizes and paths. Scenery collision uses 256-unit
spatial buckets; new tree drawing visits only camera-intersecting buckets.
Legacy scenery is indexed without appending to its arrays. Terrain painting
culls whole features; existing repeating texture surfaces are reused rather
than allocating a region-sized bitmap.

Regional pathfinding uses lazy occupancy and A*, exact sampled segment
collision, and at most 12,000 expanded nodes per request. At most two regional
radius grids and eight total map/radius grids are retained. Regional occupancy
arrays total 71,520 bytes; one query's predecessor/cost arrays total 286,080
bytes. Heap insertions are bounded by four edges per expansion (48,000), with
engine-dependent JS object overhead of several MB in the worst case. There
is no whole-region 24-unit BFS allocation (~255k cells at the new size).
The existing fog canvas remains capped to a 1,024-pixel longest side (about
2.55 MB RGBA here). Exhaustive exploration can still grow the existing saved
64-unit fog dictionary to roughly 36k cells; serialization/fog rebuild time at
that extreme has not been measured. Saved enemy/gather counts do not grow.

The 64-unit graph can miss an unusually narrow route, and budget exhaustion
can reject a difficult tap destination. Production movement still checks the
same collision geometry. Tested existing objectives and routes are reachable;
this is not an exhaustive proof of every arbitrary point. The actor-radius
cache assumes scenery stays immutable; a future runtime terrain editor must
invalidate/rebuild the spatial and navigation indexes together.

Legacy central collision was compared at 3,600 sample points. Entity data was
compared immediately before/after module loading. Old central spawns remain
safe; outer positions round-trip through the existing portable cloud format
without changing its schema or 10,000-unit coordinate safety limit. Importing
an outer-position save into an older, smaller released build is not a tested
rollback workflow. Compass visited-only eligibility is unchanged. No hidden
settlement system is claimed: the atlas dropdown still exposes uncharted
names, and painted fog alone does not solve discovery.

## Reproduction and validation

From a clean checkout (generated index.html must not already contain an overlay):

```sh
python3 tools/restore-game-source.py
python3 tools/restore-1.0.69.py
python3 tools/verify-release-candidate-169.py
node tools/release-identity-checks.cjs
python3 tools/apply-wilderness-slice.py
python3 tools/verify.py
node tools/wilderness-slice-checks.cjs
python3 tools/browser-wilderness-qa.py
```

The overlay requires the exact authenticated 1.0.69 baseline, fails closed on
an unexpected source, and reproduced identical generated HTML on a clean
restore. Release hash gates are deliberately run before the overlay; their
expected hashes are not weakened. Android QA and emulator workflows apply the
slice. The standalone release workflow is unchanged; this draft is not a
release candidate and needs separate version/release integration approval.

Measured locally on Linux x86_64, Node 24.19 and desktop Chromium:

- 121/134 existing Node aggregate checks passed on expanded source. Twelve
  Java-backed checks could not run because javac is unavailable. The remaining
  release-identity check deliberately rejects changed HTML; it passed on the
  restored baseline before applying the overlay, as did the Python release gate.
- All 11 existing Python workflow regression gates passed. Syntax/assets,
  atlas geography, render, regional and full runtime integration checks passed.
- Focused test: all four exits and 137 existing objective/resource approaches
  at radii 12, 14, 20 (423 queries); all six exit pairs; reciprocal transitions;
  every authored road segment; production follower steering along both loops;
  safe old spawns; expanded cloud position; entity/collision preservation;
  camera transform/bounds/render at three zooms in three viewport sizes.
- Mocked VM path queries: median 32.8 ms, p95 59.8 ms, max 114.9 ms. These are
  broad objective probes with mocked graphics, not render frame timings.
- Real Chromium, 20 repeated identical core obstacle queries: original cold
  392.3 ms / median 251 ms; slice cold 11–12 ms / median 2.4–2.9 ms. The original
  used its actual smaller bounds and old algorithm; both use the same core
  start/target. This is a narrow desktop comparison, not an Android speedup claim.
- Real Chromium western-lake detour: cold 18.4–18.9 ms, median 5.4–5.6 ms,
  maximum 20.2 ms across portrait/landscape runs. Separate short real-time
  movement covered 577 units in 3.04–3.16 seconds with configured speed 190.
- Existing interactive browser suite passed portrait and landscape, including
  save/resume and atlas interaction. Focused browser probe produced screenshots
  and no uncaught errors. No complete normal-speed route playthrough, combat
  balance session, FPS benchmark or full companion-party traversal was performed.
- Android lint/compile was attempted with a writable temporary Gradle home,
  but the distribution download failed with UnknownHostException for
  services.gradle.org. No local Android SDK, adb/emulator or javac is available.
  Native WebView, Samsung A14 memory/frame timing, Play upgrade and device
  touch validation remain unmeasured. No APK/AAB was produced or published.

Machine-readable results are in verification/wilderness-*.json. Browser
screenshots are generated under /tmp/thornhaven-wilderness-browser. The draft
commit uses [skip ci] to avoid the repository's automatic APK/AAB artifact
publication under the explicit no-published-build instruction; remote Android
CI has not been run for this draft.

## Integration points and remaining review

Audio PR312 and companion-advice work are untouched. Geometry consumers should
use regionalGeometry(id)/worldBounds(id), not OPEN_WORLD constants. Existing
NPC/object coordinates and their IDs remain valid for voices and quest advice.
Any added actor should use safeMapPosition; terrain-aware advice can refer to
existing route data without inventing story. wilderness-slice.js loads after
the existing follower/terrain scripts; it wraps shared collision/path functions
and exposes drawWildernessLocalTerrain plus read-only-by-convention debug
metadata. Merge work must deliberately reconcile source-overlay ordering with
other HTML overlays. The baseline hash assertion will make incompatible source
changes explicit rather than silently dropping another branch's work.

Before readiness: native Android profiling, full route and party playtesting,
terrain-edge visual review, and a decision about meaningful encounters or
existing activity redistribution in the outer area. No release or merge was
requested or performed.

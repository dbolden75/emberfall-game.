# Later investigation, Last Lantern and Veilhaven

Release remains held. This branch changes no Android version, package, signing or deployment setting. Main baseline: `5f236f23deeb8aeadf8049ff84f367a07a7ee403`. Prior political-slice head: `104eddb59c40c85125fb699a37bdf85d0a24d630`. Only one ruined-church lair is implemented. No second dead town, vampire king identity, compulsory transformation or replacement hero identity is introduced. The four proposed living-town churches remain outside scope; this investigation uses existing Sister Elowen at Stonewatch's aid stall.

## Normal-play progression

**The Uncounted Passengers** is a main-journal investigation, inserted after **Beneath Ashvale**. New characters must finish both Briar Hollow's rescue/remembrance and the Ashvault expedition. The latter follows the four town companion arcs, Fourfold Keystone and three shrine floors. There is no level, timer, visit or Night Visitor acceptance shortcut. This is deliberately later than the opening hunt or Briar rescue.

The journal and MENU → Road investigation explain prerequisites and point to Sister Elowen at Stonewatch's existing aid stall. Usual dialogue and supplies remain available. Start the investigation in person; inspect the road freight record on Stonewatch Road and harbor arrivals in Sunharbor. The records disagree about onward passenger counts. Return to Elowen and choose a permanent method:

- **Paper:** obtain the carrier's counterfoil on Stonewatch Road. It documents an alteration from passenger care to livestock handling, without depending on a witness's identity.
- **Witness:** read a protected account in Sunharbor. It records observations while withholding the survivor's name and hiding place.

Only the selected corroboration can be recorded. Both paths return to Elowen, where an explicit **Compare the clinical archive** action supplies the common essential revelation. The archive's independent older observations identify vampirism; the evidence supports action against specific raiders, not guilt assigned to every vampire. The paper route receives the clinical observations here too, so essential knowledge never depends on picking the witness route or doing an optional lair. The separate histories, rescued Ada, named missing people and black-cloaked rescuer remain unresolved as before.

The comparison sets `townQuestState._lastLanternAccess.revealed = true` in production. It unlocks Last Lantern's entrance/journal, Veilhaven's free Worldsend ferry and Night Visitor. Findings and the different corroboration remain in the main journal. No currency, equipment, allegiance, faith commitment or transformation is awarded or demanded. This is a compact authored branching investigation, not a complete political campaign or a resolution of the overarching story.

## Pre-reveal spoilers and routes

New characters see an inquiry, not vampire claims. Ada's early dialogue describes abductions without naming vampires; her rescue, plans, names and 35-crown/40-XP reward are unchanged. Later characters retain the original explicit testimony. Existing clue observations remain ambiguous until corroborated.

The vampire bestiary section, Night Visitor quest row/actions/HUD/time announcements, class-mystery dialogue and neutral vampire NPC conversations are gated. MENU uses “Road investigation” rather than “Vampire story.” Atlas/ferry guidance before the reveal is neutral; direct travel/map entry cannot bypass the Veilhaven gate. Last Lantern's existing map, journal, entrance and stale-callback guards remain. No undisclosed vampire attack, target name or corpse is shown before revelation, including the catalog Vampire Hunter in Elderwood. The planned bestiary metadata in `playtest-update.js` is unrendered design data, not player-facing content.

Enemy arrays are **not filtered, reordered or removed**. Lightweight `alive` and `deathAnim` accessors hide dormant encounters from simulation, targeting and rendering. The update loop skips them. Snapshot serialization reads canonical life/death values, preserving original indices, health and kills; opening the gate does not resurrect a dead enemy or fabricate a defeat/reward. Replacement Last Lantern arrays receive gates after load/map changes. This needs combined save tests and device performance measurement before release.

## Existing saves

`townQuestState.road_inquiry.version = 1` is written into new snapshots, including the fresh-character template. Versioned saves never gain access merely from existing quest/visit flags.

For **unversioned historical saves only**, explicit prior exposure retains eligibility: Night Visitor's Mosslight clue, hunt/ally choice, completion, turning or cure; an accepted Last Lantern expedition, discovered register or clearance; being in/previously visiting Veilhaven; or Briar Hollow's recorded Ada plan/remembrance (the old dialogue explicitly named vampires). Migration marks `road_inquiry.legacy`, not fabricated records or completion of the new inquiry. Existing choices, transformation/cure and discoveries remain intact. High level, an accepted Night Visitor with only early clues, camp completion or an arbitrary unknown save does not qualify. A versioned save in Veilhaven without eligibility returns to Worldsend; existing quest data remains.

The new state validates optional booleans `accepted`, `road`, `harbor`, `corroborated`, `revealed`, `legacy`; enum `method: paper|witness`; and version `1`. Every inquiry mutation checks earned prerequisites, current map/proximity, pause status and captured character-state identity. Stale confirmations cannot reveal a different character. No duplicate rewards exist because the inquiry grants none.

## Last Lantern after revelation

In Briar Hollow, interact with the sign at `(650,315)`, east of the remembrance stone. Enter the separate `last_lantern` churchyard/nave/undercroft map. Its two 100-pixel doorways remain open; the southwest return marker works during combat and after clearance. Solid rectangles drive both rendered walls/benches and normal collision/local-map geometry. Global outdoor dimensions are unchanged.

This level-13 region uses normal scaling: two Bloodbound Scouts, a Veil Stalker and local Captain Veyr, using Crimson Sweep with boss minimum hero level +2. The original Crimson Elder encounter remains distinct. No civilian stands in the active lair.

Secure the register, cut warning rope and wagon inventory, defeat all four raiders, and relight the road lantern for 65 crowns/70 XP once, plus ordinary combat rewards. No powerful weapon is awarded. R-7 and the Third Mooring remain unexplained. Church discoveries do not identify Briar's perpetrators, missing residents' fates, the rescuer or the king. `last_lantern` booleans and indexed `mapStates` preserve discoveries, deaths and reward state across reload/reentry/character switching.

## Veilhaven political follow-up

**The Weight of a Record** requires revealed eligibility and all three secured Last Lantern discoveries plus completion. Review evidence, hear Mirelle's refuge priority, Vaelis's accountability priority and Orven's prevention priority, then permanently endorse one limited document. This does not give the hero authority over residents.

The chosen document leads to a different follow-up and knowledge: Orven addresses former guards intimidating refuge arrivals; Mirelle adds witness safeguards to the ledger; Vaelis adds correction rules for uncertain sightings to the watch brief. Only the chosen document is prepared and annotated. Persistent NPC replies/journal reflect the result; the others remain unadopted. No patrol, rescue, allegiance, reward or change in sovereignty is simulated. Ordinary dialogue, sanctuary consent rules and free return travel remain.

`veil_counsel` stores strict booleans and a `refuge|testimony|watch` choice. Callbacks recheck the same character state, map, NPC and prerequisites. The central reveal is already in the main journal and is not withheld behind this optional discussion.

## Source composition and integration handoff

`tools/apply-last-lantern.py` inserts **last-lantern.js followed by road-inquiry.js** in the existing marked overlay before `freshCharacterState`. Do not add either as an external script tag. The exact overlay also patches the existing geometry seam, two menu-label/action seams, the neutral atlas summary and one enemy-update skip. Removal reverses the exact patches, then the original pinned baseline hash is still verified. No immutable historical source chunks are edited.

The integration owner must apply this increment after the political slice, retain PR317's audio-first composition and speech OFF, and reconstruct its generated payload. Resolve workflow additions by keeping Last Lantern, counsel, inquiry and all audio/voice browser commands/artifacts. Do not replace the owner's version handling, restore pipeline, final payload identity or save guards. No integration branch is modified by this task. PR315 geometry remains excluded from this branch; any future combination still needs its independently authenticated composition and per-region bounds.

Fresh checkout:

```sh
python3 tools/restore-game-source.py
python3 tools/restore-1.0.69.py
python3 tools/verify.py
python3 tools/verify-release-candidate-169.py
node tools/road-inquiry-checks.cjs
node tools/last-lantern-checks.cjs
node tools/veil-counsel-checks.cjs
python3 tools/browser-road-inquiry-qa.py
python3 tools/browser-last-lantern-qa.py
python3 tools/browser-veil-counsel-qa.py
```

Restoration refuses to overwrite differing generated HTML: preserve changes first. Generated HTML and reconstructed atlas art are not committed. Each future dead-town adventure needs its own layout, history, discoveries, encounters and state; shared engine utilities are not permission to clone narrative content.

## Verification and limits

Current inquiry evidence is in `reports/road-inquiry/`; earlier lair and political-slice evidence remains in its own report directories and is historical for those heads. The original 123/135 result predates discovery of the installed Java 21 compiler module; the current aggregate uses that module through a temporary javac launcher.

Runtime checks cover both inquiry paths, every intermediate save, cloud validation, canonical enemy-state preservation, explicit legacy classification, missing prerequisites, stale callbacks, route gates and post-reveal access. Browser QA creates new characters, performs Briar's actual UI rescue/remembrance without an early reveal, then seeds already-completed campaign prerequisites to bound test duration. It does **not** replay all eight town quests, the shrine floors and Ashvault. No QA reveal flag is set: the new records, method choice and in-person archive comparison earn the actual production milestone. Landscape covers paper, portrait witness; partial/completed fresh-document reloads, church entry/retreat and the free ferry round trip are exercised. QA relocates heroes and clears pre-existing road/coast enemies through the engine before using the contextual interaction button. Those fights and the full earlier campaign are not browser-played here. In-memory storage transport is not Android filesystem durability.

Combined PR317 validation, final-head Android CI, physical Samsung touch/performance, Play-delivered save-preserving upgrade and live Billing remain separate gates. No release, signing, merge, deployment or Play upload is performed here.

## Counsel pause regression fix

Independent review found that hearing proposals, confirming a recommendation and recording its follow-up could mutate `veil_counsel` while paused. The callback's shared guard now checks pause state at invocation as well as character identity, prerequisites and proximity. Paused entry creates no quest state and shows resume guidance; ordinary conversation still works. Resuming through the existing journal restores progression. Regression tests reproduce the previous failure and exercise every mutating stage for all three recommendations, pending callbacks, paused save/load and successful resume. The browser suite also checks actual pending confirmation/follow-up clicks, the paused notice, ordinary conversation and completion after resuming. This does not change rewards, story, reveal eligibility or journal capacity rules.

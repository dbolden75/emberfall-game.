# Thornhaven — Living World development plan

Status: DEVELOPMENT ONLY. Do not publish, merge into release, or change Play Console until complete and tested.

## Release safety
- Preserve the current Play build and signing key.
- The GitHub main branch may not match Play version 1.0.54. Reconcile the actual Play build kit first.
- Keep experimental changes isolated on this branch.
- Require scripted checks, Android device smoke tests, save migration checks, and full quest-path playtesting before release.

## Player experience
A satisfying 20–30 minute session: discover a world change, select an adventure, explore/fight, earn meaningful progress, and uncover the next mystery. No forced daily attendance or paid power required.

## Systems, in dependency order
1. **Living world state**: versioned save schema; persistent town reputation, quest choices, NPC state, exploration and consequences. Ensure existing saves migrate safely.
2. **Living Darkness**: staged vampire influence per region, rumors/clues, missing travelers, village changes, faction consequences. Start with one carefully tested region, then expand.
3. **Class routes**: warrior defense, rogue infiltration, cleric cure, mage investigation; different approaches to shared plot, all completable.
4. **Repeatable adventures**: deterministic daily bounty rotation plus persistent multi-stage quests, optional boss events, varied rewards; offline-safe clock handling.
5. **Companions/pets**: one story companion at a time; loyalty and companion quests; pet growth/evolution, death/revival balance, pathfinding and combat QA.
6. **Settlements**: workers, building upgrades, resource loops, defense and story consequences; no irreversible softlocks.
7. **Monetization**: cosmetic/decoration-first, transparent pricing; Google Play Billing for digital items on Play; server-side purchase verification and restoration; no real-money gambling.

## Acceptance gates
- Fresh install and upgrade from the existing Play save both succeed.
- New and resumed games survive force-close and relaunch; inventory, levels, town states and quest flags persist.
- Each class can finish the opening chapter and vampire storyline without dead ends.
- Safe town/quest screens do not spawn hostile attacks; combat and death recovery work.
- Fog, transitions, touch/joystick controls, pet AI, economy, and inventory pass on two Android phones.
- Testers confirm the Play-distributed build and collect crash/ANR feedback.
- Only after all gates pass: prepare a signed release candidate and explicitly approve publication.

## First implementation milestone
Compare the 1.0.54 Play Build Kit with this repository and document the real source of truth. Then implement the versioned world-state foundation and a single Living Darkness quest chain behind a development-only feature flag.

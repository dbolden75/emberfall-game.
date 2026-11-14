# Thornhaven continuity baseline — 2026-10-29

Status: design baseline, not proof of implemented gameplay. Do not change runtime identifiers, quest flags, or save schema solely to match this document.

## Identity
- Player-facing title: Thornhaven. Emberfall and Vaelbrink are historical names.
- Preserve Android application ID `com.vaelbrink.ashvale.newjourney` and repository name `emberfall-game.` for compatibility.
- Ashvale is the northern principal town, not a second game title.

## Principal geography
- World target: 9×9 regional grid, with Ashvale (north), Sunmere (east), Brackenford (west), Stonewatch (south).
- Keep the central enemy-controlled town distinct from the distant vampire-associated town.
- Player settlement: separate map reached from a corner-region entrance; default name Hearthstead is provisional until confirmed against source.
- Starting camp must remain returnable; world map is revealed, local maps may use fog of war.
- Names needing source verification before any rename: Summere Port versus Sunmere, Ashvale Reach, Briar Hollow, Bellwether, Wayfarer's Camp, Crowfield Farms, Elderwood, Whitefang Pass.

## Original narrative — preserve
- Dalen / Ashvale / The Watchman's Oath; Eryn / Sunmere / The Broken Beacon; Sylvi / Brackenford / The Unsent Warning; Corin / Stonewatch / The Unheard Vigil.
- Preserve existing eight town quests, their IDs, rewards, town seals, Fourfold Keystone, Mosslight, Ashvault, three sanctums and Auren's Hollow Crown ending.
- The four town characters are NPCs, not mandatory player-party members. Their existing traumas were not secretly caused by vampires.
- Shrine climax is not a replacement for the original ending; later narrative content must not invalidate completed quests.

## Vampire expansion — proposed, not verified implemented
- Source concept: *The Town That Kept Its Lights* (2026-10-11).
- Bellwether's reeve is Oren Voss; daughter Anja; baker Hessa; creditor Master Veyr. Veyr's Red Concordance exploits blood-dosed relief tonic, activated civic stations, and an evening signal; mundane contracts alone do not enslave citizens.
- Oren is turned after a fever and accepts coercive control to keep supplies arriving. Bellwether's initial ordinary visit must occur before its transformation.
- Veyr seeks authority over the player's new settlement; preserve player choice and separate quest-state progression.
- Bellwether quests and later town-character chapters are additive. Do not auto-complete existing arcs or overwrite Auren's ending.

## Character and progression rules
- Four starting classes: Mage, Rogue, Warrior, Cleric. Appearance/gender selection does not change class.
- No level cap. `TheDanCode` is the intended developer trigger for maximum level only; no free equipment or quest completion. Verify actual code before retiring legacy `Dan` behavior.
- Pets and companions are separate; one active companion. Pet scaling and death/recovery behavior require source-level verification.
- Difficulty rises toward center, with level scaling; early resource access must include beginner copper/iron. Main towns normally have no hostile spawns, except explicit scripted events.
- Fast travel is quest/item unlocked, not freely available from the beginning.

## Change control
1. Inspect actual map IDs, NPC labels, quest IDs, save flags, and scene transitions before changing code.
2. Prefer display-name aliases over renaming persistent identifiers.
3. Never overwrite original story quests or endings with vampire expansion content.
4. Test existing saves and fresh saves, town entry, quest completion, camp return, local fog, mining, and Android validation.
5. Merge to main and publish an APK only after tests pass. No gameplay changes are claimed by this document.

## Open continuity questions
- Is Summere Port a district of Sunmere, a separate port, or an old spelling?
- Are Ashvale Reach and Ashvale distinct region/town labels?
- Is Hearthstead the current default settlement name?
- What are the exact implemented quest IDs and conditions for Auren's ending?
- Which vampire chapters, if any, are already in executable game code?

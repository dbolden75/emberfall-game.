# Thornhaven Alabama-inspired atlas — Phase 1 implementation specification

Status: design only; no runtime changes. Issue #301.

## Verified current runtime (index.html, 2026-11-15)
- worldGrid is a 9x9 array of 81 regions; worldPositions derives each marker from grid coordinates.
- mapConnections adds cardinal edge exits from worldGrid neighbors; quest/dungeon portals add other exits.
- drawThemedWorldMap draws biome patches, a schematic river and coastal water, roads between all cardinal neighbors, and bridges.
- renderTravel uses worldPositions for map markers. paintExplorationFog currently paints fog over the world atlas based on visited regions.
- Existing design direction in DESIGN-REFERENCE.txt requires an **open world atlas** and local exploration fog. The atlas fog implementation should be reconciled separately, not silently changed during the geography migration.
- Existing map IDs are referenced by maps, mapConnections, quests and saved exploration; do not rename IDs as part of a visual geography pass.

## Proposed geography (fantasy, not literal Alabama)
- Northwest: Brackenford / Old Forests, upland woodland and western tributaries.
- Northeast: Ashvale / highland foothills and ridge roads.
- East: Sunmere / river valleys, eastern lakes and arcane ruins.
- South: Stonewatch / southern wetlands, river delta and marsh approaches.
- Central interior: trade crossroads, contested passes and the enemy stronghold.
- Keep northern mountains, central river basins and southern wetlands inspired by Alabama. No Alabama city or county names in game.

## Safest implementation sequence
1. Add a **visual-only atlas geography layer** with normalized 0..1 terrain anchors, fictional river paths, ridges, forests and marshes; keep worldGrid and worldPositions unchanged initially.
2. Ensure atlas roads visually follow actual mapConnections exits, not a fabricated route graph. Retain existing markers and click destinations.
3. Add tests that assert all 81 map IDs, their positions, existing quest destinations and connection exits remain unchanged.
4. Check both portrait and landscape layout and low-end device drawing cost.
5. Only after gameplay testing, consider reshaping worldPositions and edge travel. That later step requires a coordinate/save migration plan and exhaustive regression tests.

## Hard constraints
- No changes to package ID, signing, purchases or save keys.
- Do not change town starting classes, town NPC positions, quest portals, dungeon gates or region identifiers.
- No third-party extracted artwork; original geometry only.
- Keep existing live build usable until atlas change is tested.

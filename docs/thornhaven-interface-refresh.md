# Thornhaven interface refresh — phase 1

Reference: user-provided Sorrow Mod v7.2 APK. Use it only for high-level usability inspiration; do not copy its artwork, code, text, maps, or proprietary assets.

## Navigation
- One clearly labeled Menu button, opening a single accessible panel.
- Tabs: Character, Inventory, Journal, Map, Skills, Settings.
- Always-visible Close button and Android back/Escape support.
- Keep game controls responsive after opening and closing the panel.

## Mobile layout
- Portrait: scrollable menu with large touch targets (minimum 44 CSS px).
- Landscape: menu fits short screens, with internal scrolling and safe-area padding.
- No overlapping dialog text, HUD, or action buttons.
- Retain optional joystick and directional controls.

## Gameplay constraints
- Preserve existing saves, Dan code, character quests, pet combat, and mining/chopping/fishing actions.
- Selling inventory remains per-item with Sell All and quantity slider.
- Do not change monster scaling or premium purchases in this UI-only phase.

## Acceptance tests before APK
1. New game and saved-game resume.
2. Open every menu tab, close with button and back key.
3. Portrait and landscape; rotate with menu open.
4. Dialogue readable at narrow width; choices tappable.
5. Joystick, attack, interact, pet attack, gathering, and inventory selling.
6. Browser smoke test, then Android APK test; verify no first-screen dead buttons.

Next implementation: update index.html UI incrementally on a separate branch, test before merge.
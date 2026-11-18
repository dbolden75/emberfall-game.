# 1.0.69 browser-approved Android candidate

User approved release after testing the compact HUD on November 17, 2026 (Eastern).

Source: Android main `9dee19a73d5dabb22c355871c51d2c43fbf3a13d`, browser Site v11 `2a517192aad4f6d336bf777b83e56201e0bc4ca5`.

Includes compact HP/Party controls, painted atlas, smoother directional motion, trailing companions, natural terrain edges, scene scale, and defeated-enemy HP clamping to preserve valid save snapshots. No new story, prices or products.

The native integration retains package identity, WebView origin, save identifiers and bridge. It excludes preview CSP, preview-guard.js and browser wrapper. All 32 non-index game asset files match the approved browser bytes; index differences remove browser-only guards and advance labels. Reproducible patch applies after authenticated historical source restoration.

Local source syntax, asset references, atlas topology and 134 Node regression/static suites pass. Python release regressions pass. Browser launch is blocked by host socket restrictions; compiled-device and browser regression checks remain required. VersionCode 171 is provisional until current Play Console maximum is checked.

This document is source preparation evidence, not proof of a signed build, publication, physical-device update or billing verification.

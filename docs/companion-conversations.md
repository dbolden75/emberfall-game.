# Offline companion conversations

First pass on `feat/companion-conversations`, based on main
`5f236f23deeb8aeadf8049ff84f367a07a7ee403`. Independent of
`feat/thornhaven-audio` / draft PR #312.

## Player behavior

Open Party → companion portrait → **Talk with active companion**. Choose a current
commitment, ask for the next step, review progress, or ask what to watch for.
Follow-ups re-read live state. A separate topic repeats the companion's existing
summons clue verbatim. Dalen's guard-like phrasing, Sylvi's route focus, Corin's
supportive phrasing and Eryn's evidence focus derive from their established roles;
no new history, arcs or quest dialogue replaces the original story.

The footer explicitly says **Offline authored conversation · responds to current
quests · no generative AI**. This is deterministic contextual dialogue, not an LLM,
free-text chat or an online AI service. There is no API key, inference fee, network
request, new save field or persistent conversation history.

Specific guidance is enabled for the camp caller/patrol, Briar Hollow, First Hunt,
recruitment, accepted town quests, accepted class-armory quests and accepted Slayer
contracts. It reuses their current staged `questGuide` output. Recruitment advice
switches from hunting to returning to camp once two kills are recorded. Advice
also checks missing town-quest delivery materials, the required active companion,
and the current companion's vitality. Other current quest types receive an honest
journal fallback. Puzzle solutions and unaudited future lore are not surfaced.
There are no reward, accept, track, teleport, inventory or progression actions.

Completed, paused and inactive/future rows are excluded. No companion (including
zero vitality) gives a management route; no current tasks gives a neutral journal
suggestion. Legacy saves without `_humanParty` need no migration.

## Architecture and integration

Human companions live in `townQuestState._humanParty`, unlike pet `companions`.
The core `humanStories`, `companionDefs`, `journalActiveRows`, `questGuide` and
objective counters remain authoritative. `snapshotGameState` and cloud-save
validation are unchanged. Conversation state is a transient closure.

`app/src/main/assets/companion-conversations.js` is loaded after existing scripts.
It wraps `openHumanRoster` to add a DOM-created entry button. It uses the existing
`openAdventureDialog` / `adventureScreen` modal, with plain-text DOM buttons and
answers, 44px minimum choice height, focus on each answer, scoped Tab containment,
Escape dismissal and focus return to a visible Party control. It wraps
`openAdventureDialog`, `closePanel`, and non-story `preparePanel` transitions to
invalidate old turns. Each turn captures and restores the previous footer text,
close-button aria-label and answer tabindex (including an absent attribute). Callbacks check the
turn identity, panel visibility, active save slot and active living companion.

Public entry: `window.ThornhavenCompanionConversation.open()` (no arguments).
Optional audio contract: after the final reply and choices are displayed, call
`window.ThornhavenVoice.speak({speakerId:'companion:<id>', profile:'merchant',
text:existingVisibleReply})`. The stable `merchant` profile is a technical default,
not character lore. On replacement, close, roster/story interruption, or another
panel opening, call `stop()`. Never speak no-companion notices, narrator story text,
choice controls or the technical footer. Missing methods, throwing methods/getters,
and rejected promises are isolated; text and navigation keep working.

No audio implementation is bundled or imported from PR #312. There is no
MutationObserver workaround for its lifecycle race. The branch stays independent;
audible output still depends on the optional voice module being present and working.

`restore-1.0.69.py` still authenticates the immutable 1.0.69 baseline, then adds
exactly one script tag. The source gates pin the feature script and resulting HTML
and verify that removing that tag reproduces the original baseline byte-for-byte.
All historical story text, Android identity/version/signing configuration and save
keys remain unchanged. Generated native `index.html` and painted artwork are not
checked into Git. The old root browser `index.html` is not the current native source.

## Verification (November 18, 2026)

- Aggregate: 150 commands (all `tools/*checks.cjs`, all `tools/test*.py`, both atlas
  scripts, source syntax/assets and candidate gate). Follow-up result: 150 passed. The 12
  previously blocked native Java checks passed using the installed Java 21
  `jdk.compiler` module through a temporary `javac` wrapper; no JDK download
  or permissions bypass was needed.
- Full-game mock regression: unchanged snapshot across conversation, cloud-save
  encode/parse roundtrip, absent companion, script load, no transport/storage calls,
  text-only rendering.
- Headless Chromium, 412×915 and 915×412: offline with all requests aborted;
  camp and Briar staged clues; recruitment and town objective completion; material
  counts; companion changes and vitality; all four existing summons clues;
  paused/completed/no tasks; unsupported puzzle fallback; repeated selections;
  replacement story / stale callbacks / character-switch interruption; injected
  HTML/script text; dialog semantics, focus, keyboard escape/trapping, touch sizing;
  unchanged snapshots, cloud export validation and fresh-page saved-slot Continue.
  Both orientations passed with zero page errors. Test fixture state changes are
  confined to QA; browser storage uses the established in-memory test transport.
- Optional voice stub regressions passed in both orientations: final visible reply
  and choices exist before speaking; stable speaker/profile; stop before the next
  reply and on close/story/roster/non-story interruption; no narrator/no-companion
  speech; missing/throwing/rejecting implementations preserve text with no unhandled
  promise rejection. Attribute/footer cleanup and restoration of a preexisting
  tabindex are covered. This is contract validation, not audible voice QA.
- Existing camp-story browser regression also passed in both orientations.
- Source parity: baseline restored and authenticated, single added feature tag,
  final HTML SHA-256
  `22d4d109078cbcedc7973c205dc8ea3064c4a02ebbf40ca495fbc87aa13e147c`,
  all 11 pinned candidate assets passed; package identity and save-origin checks
  passed. The new browser test runs against both source and compiled APK assets in
  the existing Android CI workflow.

Commands:

```sh
python3 tools/restore-game-source.py
python3 tools/restore-1.0.69.py
python3 tools/verify.py
python3 tools/verify-release-candidate-169.py
node tools/companion-conversation-checks.cjs
python3 tools/browser-companion-conversation-qa.py
```

Run restoration from a clean checkout: the existing restoration process refuses
to overwrite a different generated HTML. Local evidence lives under
`reports/companion-conversations/` and `reports/browser-companion-conversation-qa/`.

The initial 12 Java-check blockers are resolved. This environment has Java
21.0.12.1 with `jdk.compiler` despite lacking a `javac` executable. A temporary
executable on PATH delegates compiler arguments to:

```sh
/usr/bin/java --module jdk.compiler/com.sun.tools.javac.Main "$@"
```

All aggregate checks were rerun with that wrapper. It is test-environment setup,
not a repository/toolchain change. Android's required JDK 17/SDK/Gradle build was
not performed. Android lint/compilation, actual APK/AAB payload parity, signing,
emulator/physical-device tests, audible speech and Play-delivered save retention
remain unverified locally. No release was signed, published, deployed or
version-bumped.

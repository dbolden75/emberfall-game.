# Typed NPC questions (stacked first pass)

Branch `feat/typed-npc-questions` starts at companion commit
`8617bb560f4746e34b1be7199ec827d13d7a6260`. Its draft PR targets
`feat/companion-conversations`, not main. It depends on PR #313 and must be
reviewed/rebased accordingly. It does not include or depend on audio PR #312.

## Existing architecture and scope

The restored game already had a small `npcChatForm` in `renderNpcConversation`,
with submit delegated to `askNpc` → `npcReply`. That keyword dispatcher can select
worldwide quest topics and saves a three-turn history/trust state in `_npcTalk`.
NPC identity comes from `npcConversation` (NPC, map, stable agent key),
`npcAgentProfile`, and existing personality/dialogue definitions. Services and
story-choice buttons are separate, through `npcPerformService` and `askNpc`.

This change improves/replaces the existing typed box; it does not claim to invent
NPC typing from nothing. A separate, conservative resolver handles typed questions
without passing arbitrary input into the broad legacy keyword dispatcher. Existing
preset conversation/story/service buttons keep their established behavior and text.
Human-companion menu conversations from PR #313 remain available and unchanged;
this pass adds no typed field to their separate roster dialogue.

## Supported questions and knowledge

The interface explicitly says **Offline authored answers · supported topics, not
generative AI**. It is a finite phrase matcher with live game context, not
open-ended AI. Use the three suggested questions, supported aliases, or an exact
current task title when asked to disambiguate.

- Identity/past: `Who are you?`, `What is your name?`, `Tell me about yourself`,
  `Tell me about your past`, `What do you do?`, `Your past`, `About you`.
  Replies use the NPC's existing profile/past, including authored personalities,
  generic residents, workers and vampire profiles. No new lore is generated.
- Services: `What services do you offer?`, `What can I buy here?`,
  `Can you heal me?`, `What do you sell?`, `Your services`, `Services`.
  Replies point to that NPC's actual service button or admit no service. Typed
  questions never purchase, heal, recruit or accept a request.
- Current task: suggested `What is next for your current task?`, plus next-step,
  progress and advice phrases such as `What should I do next?`, `What is left?`,
  `What do I need?`, `How is my progress?`, `How much have I done?`, `Any advice?`,
  `I am stuck`, `How can I help?`, `Progress`, `Next`, `Advice`.
  Only that NPC's `questId` / `npcStoryId` may supply a current active, unpaused,
  unfinished quest. Audited town and frontier personal-story guides supply live
  counters and next steps. A huntmaster can discuss accepted active Slayer
  contracts; multiple contracts require an exact current title. An unrelated
  trader cannot disclose those tasks. Other guide families fall back to the
  journal; no unaccepted objectives, distant lore, rewards or puzzle answers are
  pulled from the full quest catalog.
- Unknown, multi-topic and unsupported questions receive the NPC's established
  unknown-response tone plus supported-topic suggestions. Input does not execute
  code or trigger legacy trust/insult/history mutations.

Typed turns are session-only: only the latest typed question/reply is retained in
the open panel, and reopening starts fresh. Existing authored/menu history and
normal NPC opening visits continue to use the original save behavior. No new save
schema or keys, story text, progression rules, item grants or quest outcomes change.

## UI and lifecycle integration

`typed-npc-questions.js` loads after `companion-conversations.js`. It wraps
`renderNpcConversation`, calls the original renderer, removes only `npcChatForm`,
and adds a labeled 180-character field, Ask button and suggested topics. The field
sits outside the scrolling transcript, so it remains reachable with a soft
keyboard. Controls have 44px minimum height, 16px input text, Enter submit,
composition-aware Enter suppression, validation feedback, live answer semantics,
Tab containment and Escape dismissal. The visual viewport height/offset constrains
the modal during keyboard resizing; small landscape hides the topic buttons but
retains field, submit, answer and existing action list.

Every submit checks turn identity, NPC conversation object/key, map, save slot and
panel visibility. Stale detached forms cannot answer for a new NPC or character.
`openAdventureDialog`, `closePanel`, and non-story `preparePanel` transitions remove
the typed controls, keyboard listener and viewport styling, restore the original
footer, and stop optional voice. Typed submit updates DOM text nodes in place; it
**does not call `askNpc`, `npcReply`, or rerender the NPC conversation**. This is the
integration boundary for the independent town-voice worker.

Optional speech: after the visible typed reply is final, call
`ThornhavenVoice.speak({speakerId:'npc:'+npcAgentKey(n),profile:'merchant',text:reply})`.
The existing stable agent key includes map/story identity. `merchant` is a technical
default, not invented lore. Stop before replacing a typed reply and on lifecycle
exit. Typed code does not narrate greetings, user questions, menu history, narrator
text, controls or technical footer. Missing/throwing/rejecting APIs are isolated.
There is no speech engine, audio asset, network API, secret or MutationObserver
workaround in this branch.

## Verification and limitations

Final local aggregate: **151/151 commands passed**. Typed-NPC, companion and
camp-story browser suites passed both orientations with zero page errors.

The focused full-game resolver test covers actual town, frontier-personal and
Slayer definitions, speaker ownership, multiple hunts/exact-title follow-up,
paused/completed exclusion, unknown/injection fallback and unchanged snapshots.

Offline Chromium QA at 412×915 and 915×412 covers existing NPC presets/shop flows,
identity, current and completed objective replies, unrelated speakers, empty/long/
unknown/ambiguous/injection input, Enter/IME, repeats, focus/Tab/Escape, 300px-high
viewport resize, scrolling, detached forms, replacement/close, map/slot mismatch,
absent/throwing/rejecting voice, snapshots/cloud export and fresh saved-slot Continue.
Companion and camp-story regressions run separately. This is simulated keyboard
viewport resizing and in-memory browser save transport, not a real Android IME or
physical touch/device persistence test.

Source parity authenticates the immutable baseline and adds exactly the companion
and typed-NPC script tags. Final HTML SHA-256:
`9897737243aa0f441262932b3bc64e7c9e408f54875302a0c95abac877026449`.
The companion-only hash in `companion-conversations.md` describes the stacked base.
The typed script has its own pinned digest in the candidate gate. Source and
compiled-APK browser tests are wired into the existing Android CI workflow.

Local commands:

```sh
node tools/typed-npc-checks.cjs
python3 tools/browser-typed-npc-qa.py
python3 tools/browser-companion-conversation-qa.py
python3 tools/verify.py
python3 tools/verify-release-candidate-169.py
```

The aggregate suite uses the installed Java 21 `jdk.compiler` module through the
previous temporary `javac` wrapper, with no download or permission bypass. Local
logs are under `reports/typed-npc/` and `reports/browser-typed-npc-qa/`.

Not verified locally: audible output with PR #312, Android JDK17/SDK/Gradle build,
actual APK/AAB parity, physical keyboard/touch behavior, emulator/Play upgrades,
and native save retention. Nothing is merged, released, signed, deployed or
version-bumped by this feature task.

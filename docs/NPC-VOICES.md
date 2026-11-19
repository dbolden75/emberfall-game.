Release candidate 1.0.70: Android device speech is OFF (muted) by default. Explicit saved user choice is retained. No illustrative audition voices are bundled or approved; physical-device synthesis and listening remain pending. Music/SFX/ambience are independent.

# NPC voices: first device-speech pass

This draft uses Android's native TextToSpeech service, explicitly labeled
“device speech” in the UI. It is not recorded voice acting or a Web Speech API
fallback. No speech generation connector, local speech engine or licensed voice
model was available in the implementation environment. No external model/API was
installed, purchased or called; no real person's voice was cloned.

## Coverage and character delivery

Only existing conversation greetings and newly requested conversation replies for:

| Character | Profile | Rate / pitch |
|---|---|---|
| Tilda (Ashvale merchant) | merchant | 0.98 / 1.00 |
| Edda the Carpenter | carpenter | 0.94 / 0.94 |
| Sera (courier) | courier | 1.02 / 1.04 |

The native bridge selects installed English voices reported as not requiring a
network, excluding voices tagged notInstalled. Voices sort by quality then name;
profiles choose indices 0/1/2, wrapping if fewer voices exist. A device with one
voice uses that voice with the delivery variations above. Gender, timbre and the
number of genuinely distinct voices depend on the engine. No voice quality or
human listening claim has been made.

Dialogue text, names, relationship memory, choices, lore and subtitles remain
unchanged. History is not read aloud in bulk. Other NPCs, quest-service screens,
combat barks and companion conversations are unvoiced in this pass. No companion
stories or dialogue were added. Music, SFX and ambience controls remain separate.

Settings → Sound adds persisted NPC voice volume and mute controls. Selected
conversations add Replay voice, Stop voice and an availability note. Volume zero
or mute stops current speech immediately; changing volume stops the current line,
and Replay uses the new level. Foreground resume never replays an old line.
Rapid replies/reopen, scene changes, closing the panel, background/blur and native
audio-focus loss stop speech. The latest native request supersedes queued work;
stale callbacks cannot cancel a newer utterance.

## Reusable API for companion work

`window.ThornhavenVoice` is installed after the game scripts:

```js
ThornhavenVoice.speak({
  speakerId: 'companion:stable-id', // required stable identity, 1–120 characters
  profile: 'courier',             // merchant | carpenter | courier; default merchant
  text: existingVisibleReply     // required plain text, 1–3500 characters
});
ThornhavenVoice.stop();           // interrupts; no queued follow-up
```

`speak` first interrupts previous speech and returns whether a request was
submitted to the ready bridge, NOT confirmation of audible playback. Unsupported
profiles use merchant delivery. Blank/oversized lines are left text-only rather
than truncated or queued. Call after the final dialogue text is shown, and call
`stop()` when replacing/closing the owning conversation. An existing generic
`openAdventureDialog`, `closePanel('adventureScreen')` or `setMap` call already
cancels NPC speech; call `speak` after opening a new dialog, never before.

`set({volume:0..1, muted:boolean})`, `preferences()`, `status()`, `suspend()` and
`resume()` are also available. `generation()` exposes an opaque monotonically
increasing request token: every speak/stop invalidates earlier ownership. The
NPC observer only cancels a class-change utterance if it still owns that token;
a newer companion request survives pending NPC DOM mutations. Hiding/closing the
shared dialog still stops every owner. Preferences live only in `thornhaven_voice_v1`,
not character saves or music/SFX settings. `resume()` enables future explicit
requests and never speaks by itself. Status is `loading`, `ready`,
`no-offline-english` or `unavailable`. Initialization does not queue the opening
line; Replay becomes useful once the engine is ready. A failed engine leaves the
text and choices usable; reinstalling/changing voices may require restarting the
app. Browser previews without the native bridge stay text-only.

## Android integration, licensing and offline limits

`NpcSpeech.java` runs TTS operations on the main thread, uses QUEUE_FLUSH and
request generations, sets per-utterance volume, handles focus, and shuts down on
Activity destruction. MainActivity exposes the bridge only in the existing
navigation-restricted local game WebView. The manifest adds only the TTS service
visibility query required for modern Android; no new permission, dependency,
package identity or version-code change. It does not assume speechSynthesis is
available in Android WebView.

No voice clips or speech models are bundled or redistributed, so there is no new
speech-asset license or third-party attribution to grant. Engine voices remain
installed and licensed by the user's chosen Android speech engine. Existing CC0
music/SFX provenance and hashes are retained. Android API references:

- https://developer.android.com/reference/android/speech/tts/TextToSpeech
- https://developer.android.com/reference/android/speech/tts/Voice

Offline playback requires an already installed offline English voice. The app
requests no voice download and makes no external speech API call. Without a
suitable engine/voice, subtitles and gameplay remain fully available. Real engine
pronunciation, offline behavior, character differentiation, audio focus,
Bluetooth and background behavior still require physical Android QA.

## Checks and limits

- `node tools/voice-checks.cjs`: reusable API, unchanged text, explicit identity,
  stop/replacement, mute/zero persistence, background, no stale resume, missing
  engine and storage failures.
- `node tools/native-voice-checks.cjs`: compiles and executes production Java
  against Android API stubs; offline filtering, three profiles, latest-only work,
  focus, pause, stale callback, failure and shutdown behavior. Not real synthesis.
- `python3 tools/browser-voice-qa.py`: actual game DOM with a recording native
  bridge; all three NPC greetings/replies match visible text, rapid replacement,
  Replay/Stop, close/map/background, missing bridge and persistent separate controls.
- Existing source/parity, gameplay/billing/save and real-media audio checks remain
  applicable. The pre-voice game HTML is unchanged after removing the two added
  voice script references.

No playable sample file was generated: doing so would require a real synthesis
engine or model not available here. A fake recording or placeholder was not
substituted. No new APK/AAB, Android synthesis or human audition was performed.
No merge, release or deployment is authorized by this pass.

Final local verification: 139/139 regression scripts passed; 12/12 native-parity
fixture tests passed. Browser voice integration and the existing real-media audio
playback suite passed. Deterministic reconstruction and all intended source pins
passed. Voice synthesis itself is mocked in these tests, not auditioned.

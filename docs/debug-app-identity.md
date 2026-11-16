# Debug distribution and update compatibility

Future debug builds use `com.vaelbrink.ashvale.newjourney.debug` and the launcher/settings label **Thornhaven QA (Debug)**. They can coexist with the production app and have separate Android app-private storage. They are QA artifacts, not updates for a player's installed game. Their versionCode/versionName continue to derive from the same source configuration; a version bump is not a remedy for a certificate mismatch.

Production remains `com.vaelbrink.ashvale.newjourney`, labelled **Thornhaven: New Journey**. Release signing configuration, maintained keys, version codes, WebView origin and save keys are unchanged. Debug builds continue using the existing debug signing mechanism; this change neither creates nor replaces release credentials. Debug purchases are not evidence of production Play Billing behavior.

The compiled APK gate (`tools/check-apk-variant-identity.py`) requires the expected package, version, label and debug flag, and refuses test-only artifacts. Android CI runs it before uploading debug APKs or offering unsigned release payloads. The maintained-key release workflow also checks it before signing. The existing compiled Billing manifest gate additionally rejects production-package debuggable/test-only releases. Cryptographic release certificate checks remain mandatory and separate from this manifest check.

Emulator smoke, control and synthetic-save tests now address the isolated debug package. The historical 1.0.57 debug fixture receives the same suffix and label on the disposable runner; its audited gameplay bytes and release variant identity remain unchanged. The release-upgrade phase leaves the debug package installed and verifies its data sentinel survives release installation and upgrade. It still uses disposable QA signing, not the maintained key or a physical phone.

## Historical installations are not migrated by this change

The archived `Thornhaven-1.0.64-debug-test.apk` used production's package with the Android Debug certificate SHA-256 `4ed067fbeae71d8c2ff23cd3760499b2825bf725ea018a3e7fa73293e1e7729f`. The maintained release certificate is `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`. These public fingerprints differ; a filename in Downloads does not establish the phone's installed signer.

Do not uninstall, clear data or substitute signing keys to bypass an incompatible update. First inspect the installed APK using the read-only upgrade preflight and compare Play's delivered app-signing identity where relevant. An already installed historical debug app is unaffected by the new suffix and keeps its existing data; no automatic migration or repaired phone update is claimed.

The user's verified Play closed-testing Alpha 1.0.68/code170 availability is independent of this prevention branch. This branch is based on current main and intentionally does not alter its release version or publish a new release.

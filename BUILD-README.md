# Thornhaven 1.0.29 dual-platform build

The canonical input for this branch is the latest shared game source under `build-input/part-*`, not the historical root `index.html`. Join parts in filename order and extract the resulting gzip tar archive. Its SHA-256 is `7134802fc64dc95f5160ff8351d83c82008757ae853961c97572592fc5fe5cce`.

The source is from the premium-catalog update (Library source version 57), with Android versionName 1.0.29 and versionCode 131. It includes vampires, scaling, uncapped progression, current controls and the premium catalog. Paid purchases remain disabled pending payment integration.

The workflow runs current regression suites, a WebKit mobile smoke check, then Android and iOS builds. Historical tests requiring unavailable old baselines are recorded as excluded. Browser automation is not physical-device testing.

Android keeps application ID `com.vaelbrink.ashvale.newjourney`. The cloud output is aligned but unsigned. Sign privately with the original maintained signing key; never commit that key or its passwords. The expected signing certificate SHA-256 is `38dc061e50f36b8eaeab5a582f8519d93a2ec9b5c256409219744351097cdd22`.

iOS uses Capacitor with native orientation and browser plugins. `prepare-ios.py` adds only the platform bridge script to the shared game page and sets full-screen iPad behavior for orientation control. Outputs are an unsigned device IPA and a simulator app. Apple signing, provisioning, App Store Connect setup and device testing remain necessary before TestFlight installation.

No production website deployment or App Store submission is performed by this workflow.

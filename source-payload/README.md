# Audited Android game source

The three ordered HTML parts reproduce the exact 1.0.56-dev audited game.
They are split only because the authorized upload connection limits each request
to 16 MiB. No game code or artwork was removed or redesigned.

Run `python3 tools/restore-game-source.py` before source tests or Android builds.
The script verifies SHA-256 before creating `app/src/main/assets/index.html`.
The GitHub APK workflow runs this automatically. The parts stay outside Android
assets so they are not duplicated inside the APK.

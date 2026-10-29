// Prevent the retired alternate-package APK workflow from reappearing.
// The original Play appId and its saved characters must remain upgradeable.
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const legacy = read('.github/workflows/android-apk.yml');
const maintained = read('.github/workflows/thornhaven-android-build.yml');
const gradle = read('app/build.gradle');

assert.match(legacy, /^\s*workflow_dispatch:\s*$/m,
  'Legacy workflow must remain manually available as a compatibility entry point');
assert.match(legacy, /^\s*uses: \.\/\.github\/workflows\/thornhaven-android-build\.yml\s*$/m,
  'Legacy workflow must delegate to the maintained CI');
assert.doesNotMatch(legacy, /npx\s+cap\b|capacitor\.config|npm\s+install|gradlew\s+assemble/i,
  'Legacy workflow must not reintroduce a standalone, alternate-package build');
assert.match(maintained, /^\s*workflow_call:\s*$/m,
  'Maintained CI must support a reusable workflow call');
assert.match(maintained, /python3\s+tools\/restore-game-source\.py/,
  'Maintained CI must restore audited game assets');
assert.match(maintained, /:app:assembleDebug\s+:app:assembleRelease\s+:app:bundleRelease/,
  'Maintained CI must build APK and AAB from the real Android project');
assert.match(maintained, /com\.vaelbrink\.ashvale\.newjourney.*versionCode='166'.*versionName='1\.0\.64'/,
  'Maintained CI must assert the release package and version');
assert.match(gradle, /applicationId\s+['"]com\.vaelbrink\.ashvale\.newjourney['"]/,
  'The appId must preserve existing Play app and local saves');
assert.match(gradle, /versionCode\s+166\b/,
  'The current release candidate versionCode must be consistent with CI');

console.log('PASS: every Android APK entry point uses the maintained package and checked Gradle build');

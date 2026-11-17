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
assert.match(maintained, /com\.vaelbrink\.ashvale\.newjourney.*versionCode='170'.*versionName='1\.0\.68'/,
  'Maintained CI must assert the release package and version');
// An Android Gradle build can succeed yet package stale or incomplete game
// files. Keep the compiled-APK browser gate in the maintained workflow.
assert.match(maintained, /unzip -qq "\\$apk" 'assets\\/\\*' -d "\\$compiled_dir"/,
  'CI must extract the actual compiled release APK for browser QA');
assert.match(maintained, /python3 tools\\/browser-interactive-qa\\.py --assets "\\$compiled_dir\\/assets"/,
  'CI must interactively test the compiled release APK assets');
assert.match(gradle, /applicationId\s+['"]com\.vaelbrink\.ashvale\.newjourney['"]/,
  'The appId must preserve existing Play app and local saves');
assert.match(gradle, /versionCode\s+170\b/,
  'The current release candidate versionCode must be consistent with CI');

console.log('PASS: every Android APK entry point uses the maintained package and checked Gradle build');

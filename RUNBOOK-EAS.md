# EAS runbook - from this repo to a phone

Everything below the auth wall is DONE (profiles in `eas.json`, bundle ids in
`app.json`, preview env never leaks `EXPO_PUBLIC_COMP_LOGIN` - build profiles
pin only `EXPO_PUBLIC_API_BASE`). What remains needs accounts, in order:

## 1. One-time (any machine)
```sh
npx eas-cli login            # Expo account (create one at expo.dev if needed)
npx eas-cli init             # links the repo, writes extra.eas.projectId into app.json
```

## 2. First Android build - NO Apple account needed
```sh
npx eas-cli build -p android --profile device
```
EAS generates + stores the keystore automatically. The result is an installable
APK/AAB link - the first time CalmCarry runs on real hardware. This is the
fastest path to feeling the gestures/haptics/60fps work.

## 3. First iOS build - needs the Apple Developer account ($99/yr, Glowco)
```sh
npx eas-cli build -p ios --profile device
```
The CLI walks through signing (it can create certs/profiles on the Apple
account). For TestFlight: `--profile production`, then
```sh
npx eas-cli submit -p ios     # needs an App Store Connect API key
```

## 4. Push notifications
`eas init`'s projectId is also what makes `Notifications.getExpoPushTokenAsync`
work (src/lib/push.ts) - no extra step.

## Gotchas already handled in this repo
- Comp login / preview parent PIN require Platform.OS==='web' - they cannot
  activate in any native build even if the env leaks.
- `app.json` bundle ids: `co.theglowcompany.calmcarry` (both stores).
- The prod API is NOT live yet (empty DATABASE_URL etc.) - a device build will
  run in guest/local mode until the backend blockers are cleared. That's fine
  for the first feel-test.

## Running locally in Xcode (no EAS, no cloud build)
To open the native iOS project in Xcode and run on a simulator/your own device:
```sh
brew install cocoapods                 # once, if `pod` is missing
npx expo prebuild -p ios --clean       # generates ios/ (gitignored) + pod install
open ios/CalmCarry.xcworkspace         # then pick a target and hit Run
```
Prebuild flips the `ios`/`android` npm scripts to `expo run:*` - revert that
(`git checkout package.json`) since this repo stays managed/EAS.

**Required local-build override (or the build fails):** the `@sentry/react-native`
plugin adds a source-map upload phase that errors locally ("An organization ID or
slug is required") because there's no Sentry auth token on your machine. Create
`ios/.xcode.env.local` (gitignored, survives prebuild) with:
```sh
export SENTRY_DISABLE_AUTO_UPLOAD=true
```
EAS/CI builds set a real Sentry token, so they still upload symbols - this only
skips the upload for local builds. First device run also needs a Team under
Signing & Capabilities (a free Apple ID works; 7-day expiry) and trusting the
profile on-device (Settings → General → VPN & Device Management).

Verified: `xcodebuild … -sdk iphonesimulator` produces a real CalmCarry.app
(Mach-O arm64+x86_64) with this override in place.

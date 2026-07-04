# EAS runbook — from this repo to a phone

Everything below the auth wall is DONE (profiles in `eas.json`, bundle ids in
`app.json`, preview env never leaks `EXPO_PUBLIC_COMP_LOGIN` — build profiles
pin only `EXPO_PUBLIC_API_BASE`). What remains needs accounts, in order:

## 1. One-time (any machine)
```sh
npx eas-cli login            # Expo account (create one at expo.dev if needed)
npx eas-cli init             # links the repo, writes extra.eas.projectId into app.json
```

## 2. First Android build — NO Apple account needed
```sh
npx eas-cli build -p android --profile device
```
EAS generates + stores the keystore automatically. The result is an installable
APK/AAB link — the first time CalmCarry runs on real hardware. This is the
fastest path to feeling the gestures/haptics/60fps work.

## 3. First iOS build — needs the Apple Developer account ($99/yr, Glowco)
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
work (src/lib/push.ts) — no extra step.

## Gotchas already handled in this repo
- Comp login / preview parent PIN require Platform.OS==='web' — they cannot
  activate in any native build even if the env leaks.
- `app.json` bundle ids: `co.theglowcompany.calmcarry` (both stores).
- The prod API is NOT live yet (empty DATABASE_URL etc.) — a device build will
  run in guest/local mode until the backend blockers are cleared. That's fine
  for the first feel-test.

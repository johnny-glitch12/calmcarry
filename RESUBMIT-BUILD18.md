# Resubmit 1.0.0 to App Review (build 18) - the 5.1.1(v) fix

The rejection (2026-08-20, submission `ed2dcdc5-9e06-430c-b53d-a8bf489eb9e7`) is fixed
in commit `f8562ac`: guests can purchase and restore without an account (details in
`STORE_SUBMISSION.md` §9). What remains is producing build 18 and resubmitting.

## 1. Build + upload (laptop, ~5 min of typing + EAS wait)

```sh
git pull
npx eas-cli build -p ios --profile production   # autoIncrement bumps to build 18
npx eas-cli submit -p ios                       # uploads to App Store Connect
```

## 2. In App Store Connect (after the build finishes processing)

App Store Connect → CalmCarry → iOS App 1.0.0:

1. Remove the rejected build 17 from the version, add **build 18**.
2. Reply to Apple's 2026-08-20 message (paste below), then **Resubmit to App Review**.
   The three subscription items (Monthly, Annual, group) are still "Ready for Review"
   and ride along automatically.

### Paste-ready reply to Apple

> Hello,
>
> Thank you for the review. Guideline 5.1.1(v) is resolved in build 18.
>
> Registration is no longer required to purchase or restore the subscription. The
> paywall now completes the StoreKit purchase while fully signed out, and "Restore
> Purchases" works signed out from both the paywall and Settings. Account creation
> is optional everywhere: the screen shown after onboarding has an explicit
> "Continue without an account" button, and the paywall explains that creating a
> free account (available anytime in Settings) simply lets users access their
> subscription on their other devices, per your guidance.
>
> To verify: skip onboarding via "Continue without an account", tap any locked
> track or Profile → Subscription, and complete the purchase — no sign-in is
> requested at any point.
>
> Thank you!

## 3. Don't touch / already handled

- `ALLOW_SANDBOX_IAP=1` stays ON (Railway) until approval - see STORE_SUBMISSION.md.
- The guest purchase flow never calls the backend, so the reviewer's sandbox
  purchase works regardless of API state.
- After approval: turn the sandbox flag off, and set `APPLE_APP_APPLE_ID=6796861173`
  on Railway before real authed purchases (guests are unaffected).

Delete this file once the resubmission is in.

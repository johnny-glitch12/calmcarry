# Resubmit 1.0.0 to App Review (build 18) - the 5.1.1(v) fix

The rejection (2026-08-20, submission `ed2dcdc5-9e06-430c-b53d-a8bf489eb9e7`) is fixed
in commit `f8562ac`: guests can purchase and restore without an account (details in
`STORE_SUBMISSION.md` §9). What remains: restore the backend, produce build 18, resubmit.

## 0. FIRST - the backend is DOWN (found 2026-08-27, blocks resubmission)

`calmcarry-api-production.up.railway.app` returns Railway's edge "Application not
found" on every path - the service is unbound/deleted, NOT sleeping. Blast radius:
the ASC **Privacy Policy URL** and **Support URL** point there (dead-link metadata
rejection), the same URLs are baked into the binary, and sign-in/registration/account
deletion fail during review (2.1). Guest purchase itself is unaffected (never calls
the server).

Fix EITHER way, then verify `/health`, `/legal/privacy`, `/legal/support` return 200:

- **Railway** (preferred - env vars incl. `ALLOW_SANDBOX_IAP=1` lived there): open the
  Railway dashboard, restore/redeploy the `calmcarry-api` service from current `main`,
  re-bind the domain, and re-check the env vars survived.
- **Vercel fallback**: `calmcarry-api.vercel.app` is ALIVE with the Neon DB up, but
  runs OLD code (no `/legal/*` routes). `vercel login` + redeploy from `server/`, set
  `ALLOW_SANDBOX_IAP=1`, then repoint `EXPO_PUBLIC_API_BASE` (eas.json), `PRIVACY_URL`
  + `SUPPORT_URL` (src/content/store.ts), the ASC Privacy Policy URL + Support URL
  fields, and the Privacy Policy line at the end of the ASC description.

Also note: the old ASC demo account (applereview@ - see ASC history) died with the
backend; none is needed anymore ("Sign-in required" is now unchecked in ASC).

## 1. Build + upload (laptop, ~5 min of typing + EAS wait)

```sh
git pull
npx eas-cli build -p ios --profile production   # autoIncrement bumps to build 18
npx eas-cli submit -p ios                       # uploads to App Store Connect
```

## 2. In App Store Connect (after the build finishes processing)

Already done in ASC (2026-08-27): "Sign-in required" UNCHECKED, review notes replaced
with the 5.1.1(v)-resolution text (the old notes told Apple to "create an account
first" to test the purchase - likely a direct cause of the rejection). The description
already carries the standard-EULA Terms link, and the privacy label already declares
Purchases. Remaining clicks, App Store Connect → CalmCarry → iOS App 1.0.0:

1. Remove the rejected build 17 from the version, add **build 18**.
2. Reply to Apple's 2026-08-20 message (paste below), then **Resubmit to App Review**.
   The three subscription items (Monthly, Annual, group) are still "Ready for Review"
   and ride along automatically.
3. Optional: replace/remove the attached review-recording-attach.mp4 (it shows the
   OLD sign-in-first flow; the new notes already flag it as outdated).

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

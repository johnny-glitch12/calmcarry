# CalmCarry - Store submission checklist

The path to the **"live on stores"** invoice milestone. Most of the app config is done;
the rest needs the Glow Company's developer accounts + a few real URLs.

## 1. Accounts needed (Glow Company / Mason)
- [ ] **Apple Developer Program** - $99/yr (for App Store Connect + TestFlight)
- [ ] **Google Play Console** - $25 one-time
- [ ] **Expo account** (free) for EAS builds - `npx eas login`

## 2. Already configured in this repo
- [x] App name **CalmCarry**, slug `calmcarry`, version `1.0.0`
- [x] iOS `bundleIdentifier` + Android `package` = `co.theglowcompany.calmcarry` (`app.json`) - change if the Glow Company prefers another reverse-domain
- [x] App icon, adaptive icon, splash (night eucalyptus `#0E1817`) in `assets/images/`
- [x] `eas.json` with development / preview / production profiles
- [x] Wellness disclaimer in-app (About screen + Learn articles) - App Review wants this for wellness apps
- [x] IAP: the **premium subscription is in-app** (StoreKit / Play Billing) - SKUs `calmcarry.premium.monthly` / `calmcarry.premium.annual` with a 3-day intro trial, server-validated (App Store Server API + Play Developer API, fail-closed, SKU-allowlisted). The **physical Glow Orb** is bought on the web store (Apple 3.1.5a physical goods) - that stays external.

## 3. Fill in before submitting (placeholders today)
- [ ] Real store/product URL in `src/content/store.ts` → `DEVICE_CHECKOUT_URL` (currently `theglowcompany.co/products/calmcarry-glow-orb`)
- [ ] Real `PRIVACY_URL`, `TERMS_URL`, `SUPPORT_URL` (same file) - Apple/Google **require a working Privacy Policy URL**
- [ ] Confirm the store domain - Drive metadata showed `glowdermal.com.au`; app uses `theglowcompany.co`
- [ ] Replace the AI/placeholder cover art + audio with the Glow Company's licensed finals (see `AUDIO_CREDITS`)

## 4. Store listing assets
- [ ] Screenshots (6.7" iPhone + 5.5" + iPad; Android phone/tablet) - capture from the app
- [ ] App description, keywords, subtitle, support email
- [ ] Age rating questionnaire - note **Kids mode** exists → answer the kids/COPPA questions (we collect no ad IDs, minimal data; "Made for Kids" is optional - only if marketing to children)

## 5. App privacy / data safety answers
File these ACCURATELY (a stale/optimistic label is itself a 5.1.1(v) reject). All are
"App Functionality," none used for tracking, no cross-app/IDFA tracking, no ads:
- **Contact info** - account email + name (via Apple/Google/email sign-in).
- **Identifiers** - account/user id.
- **Usage data / product interaction** - first-party funnel events (our own backend
  via `api.trackEvents`, not a third-party ad SDK). Excluded entirely in Kids mode.
- **Diagnostics / crash + performance** - ONLY if Sentry is enabled (`EXPO_PUBLIC_SENTRY_DSN`
  / `SENTRY_DSN` set). Sentry is a third-party SDK; if you ship with it on, declare this.
  Also excluded in Kids mode. If you leave the DSN blank, do not declare Diagnostics.
- **Purchases (Purchase History)** - subscription tier/status/plan/renewal linked to the
  account (App Functionality; matches the `NSPrivacyCollectedDataTypePurchaseHistory`
  entry the binary's privacy manifest declares via `app.json`). ✅ Verified 2026-08-27:
  the ASC App Privacy label already includes this.
- No ads, no data sold, no tracking across apps/sites. Audio plays in silent mode.

## 6. Build & submit commands
```bash
npx eas login
npx eas build:configure          # creates the EAS project (writes extra.eas.projectId)
npx eas build -p ios --profile production
npx eas build -p android --profile production
npx eas submit -p ios            # needs App Store Connect app created + API key
npx eas submit -p android        # needs Play service-account JSON
```

## 7. Backend before production
- The NestJS server is real (IAP validation, store webhooks, push, auth, retention
  purge - all implemented, fail-closed) and is **LIVE on Vercel**: project
  `calmcarry-api` (TASK FORCE team, Hobby) with **Neon Postgres** (`DATABASE_URL`);
  local dev uses SQLite. `/health` returns `{ok:true,db:up}`. History: Fly.io →
  Railway → the Railway trial maxed out unpaid and the service was suspended
  (2026-08), so on 2026-08-27 current `main` was deployed to the Vercel project
  (which had kept a working env + DB) and everything was repointed there.
- The app points at `https://calmcarry-api.vercel.app` via the EAS
  `production` build env (`eas.json`), not a hardcoded `API_BASE`. A custom domain
  (e.g. `api.theglowcompany.co`) is an OPTIONAL later layer - not required to ship.
- Before the first real iOS purchase works, `APPLE_APP_APPLE_ID` (the numeric App
  Store app id) must be set on the API host - without it the Apple Production
  verifier throws on the FIRST real purchase (the user is charged and gets nothing)
  while the service still looks healthy. ✅ Set on Vercel 2026-08-27
  (`APPLE_APP_APPLE_ID=6796861173`, plus `ALLOW_SANDBOX_IAP=1` for App Review).
  Note: the guest sandbox purchase never touches this API, so neither var blocks
  the 5.1.1(v) resubmission - they matter for authed/real purchases.
- Audio ships bundled in the binary for v1; the signed-URL CDN is post-v1 (`STREAMING_ENABLED`).

## 8. App Review notes (paste into ASC "App Review Information" / Play "Review notes")
Since the 5.1.1(v) fix, **no demo account is needed and "Sign-in required" must stay
UNCHECKED** in ASC (registration is optional and purchase works signed out - telling
Apple sign-in is required contradicts the fix and invites the same rejection).
✅ Updated in ASC 2026-08-27: sign-in unchecked, review notes replaced with the
5.1.1(v)-resolution text. The notes below are kept for Play / reference:

>
> **The physical "Glow Orb" device is NOT required to review the app.** On the
> device-registration screen you can tap "Continue" / "Not now" to skip it and reach
> the full app; every screen is reviewable without hardware.
>
> **Subscription:** premium is an auto-renewable in-app subscription (StoreKit / Play
> Billing) with a 3-day free introductory trial on the annual plan. **No account or
> sign-in is required to purchase or restore it** (Guideline 5.1.1(v)): the paywall
> completes the purchase signed out, the entitlement is held on-device against the
> App Store / Play account, and creating a CalmCarry account later — optional, offered
> on the paywall and in Settings — extends the plan to the user's other devices.
> There is no external/alternative purchase path for the digital subscription. The
> physical Glow Orb device is sold separately on our web store (physical goods, per
> 3.1.5(a)).
>
> **Kids mode** is used by a child under the adult account holder, gated by a
> biometric parent gate. The account holder confirms they are 18+. We do not enroll
> in "Made for Kids" / "Designed for Families"; analytics and crash reporting are
> disabled entirely while a kid profile is active.

## 9. App Review history

- **2026-08-30 — APPROVED & LIVE** 🎉 version 1.0.0 (build 18) auto-released
  ~12:38 UTC: https://apps.apple.com/us/app/calmcarry/id6796861173
  Post-launch hygiene done same-hour: `ALLOW_SANDBOX_IAP=0` set + redeployed
  (sandbox receipts now refused in prod), Expo access token revoked. The
  keep-warm cron (`.github/workflows/keep-warm.yml`) is still running - keep it
  through launch week, then delete at will.

- **2026-08-20 — REJECTED, 5.1.1(v)** (submission `ed2dcdc5-9e06-430c-b53d-a8bf489eb9e7`,
  version 1.0.0 build 17, reviewed on iPhone 17 Pro Max): "app requires users to
  register with personal information to purchase In-App Purchase products that are
  not account based." Root cause: the paywall's Subscribe bounced signed-out users
  to `/auth` and the whole IAP layer required a backend JWT for receipt validation.
  **Fix (build 18):** guest purchase/restore — the store event validates on-device,
  the entitlement lives locally with the store's own expiry and is reconciled
  against `getAvailablePurchases()` on foreground; signing in later attaches the
  purchase to the account by re-validating the CURRENT store transaction
  server-side. Registration is optional everywhere ("Continue without an account"
  on the sign-in screen; optional-account note on the paywall). The server needed
  no changes (guest webhook events are harmless; refund-replay is denylisted;
  cross-account receipt reuse 409s). Known edge (accepted): if the same store
  transaction was already linked to a DIFFERENT CalmCarry account, the background
  link 409s silently - this device keeps its local premium, but the new account
  doesn't become premium on other devices until the user signs into the original
  account or contacts support.

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
- [x] App icon, adaptive icon, splash (mint `#D3EDEA`) in `assets/images/`
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
  purge - all implemented, fail-closed). Production runs it on **Fly.io** with
  **Postgres** (`DATABASE_URL`); local dev uses SQLite. See `server/DEPLOY.md`.
- Provision: Fly app + secrets, a Postgres (Neon/Fly), and DNS+TLS for the API host.
- The app points at `https://api.theglowcompany.co` via the EAS `production` build env
  (`eas.json`), not a hardcoded `API_BASE` - set that host live before the store build.
- Audio ships bundled in the binary for v1; the signed-URL CDN is post-v1 (`STREAMING_ENABLED`).

## 8. App Review notes (paste into ASC "App Review Information" / Play "Review notes")
The dev/web comp login does NOT work in a store build - you MUST create a real demo
account on the production backend first (sign up in the shipped build once the API is
live), then fill the credentials below.

> **Demo account:** `<email>` / `<password>` (created on api.theglowcompany.co)
>
> **The physical "Glow Orb" device is NOT required to review the app.** On the
> device-registration screen you can tap "Continue" / "Not now" to skip it and reach
> the full app; every screen is reviewable without hardware.
>
> **Subscription:** premium is an auto-renewable in-app subscription (StoreKit / Play
> Billing) with a 3-day free introductory trial on the annual plan. There is no
> external/alternative purchase path for the digital subscription. The physical Glow
> Orb device is sold separately on our web store (physical goods, per 3.1.5(a)).
>
> **Kids mode** is used by a child under the adult account holder, gated by a
> biometric parent gate. The account holder confirms they are 18+. We do not enroll
> in "Made for Kids" / "Designed for Families"; analytics and crash reporting are
> disabled entirely while a kid profile is active.

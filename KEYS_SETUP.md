# CalmCarry — API keys & secrets setup

Everything in this app runs in **dev with zero keys** (safe local fallbacks). You only
need real values to ship to production. Fill them into `server/.env` and the app's `.env`
(both are gitignored — never commit real secrets).

> **Never paste a secret into a chat, ticket, screenshot, or log.** Treat any secret that
> leaks into one as compromised and regenerate it. Generate secrets locally and store them
> in your host's secret manager (Fly secrets, etc.).

---

## How payment actually works here (read this first)

CalmCarry's **Calm Plan subscription is digital content**, so Apple & Google **require** it to
go through their own billing (StoreKit / Play Billing). That means:

- ❌ **No Stripe / PayPal / payment processor, no merchant account, no card handling, no PCI.**
- ✅ Apple/Google collect the money and pay you out (minus ~15–30%).
- ✅ You still need a few keys — **not to charge money, but to (a) verify a purchase is real
  and (b) hear about cancels/refunds/renewals that happen outside the app.**

The **physical Glow Orb** is sold on the **Shopify** web store (physical goods are *not* IAP).
Shopify keys are only used to match a hardware buyer's email to their account ("Verified
owner" badge) — premium works fine without Shopify.

---

## Priority: what to get, and when

### 🔴 Must-have to launch the subscription
| Key | Why |
|---|---|
| `JWT_SECRET`, `CMS_ADMIN_KEY` | Auth + prod boot (server refuses the `change-me` defaults in prod) |
| `DATABASE_URL` | Real Postgres for prod |
| `CORS_ORIGINS` | Lock API to your web origins |
| IAP products in App Store Connect + Play Console | The subscriptions + their prices (`calmcarry.premium.monthly` / `.annual`) |
| `APPLE_IAP_SHARED_SECRET` / `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Server-side **receipt validation** (anti-fraud) |
| App Store Server Notifications + Play RTDN webhooks | Remove premium on **cancel / refund / lapse** *(also needs verification code — see end)* |
| `CDN_BASE_URL` + `CDN_SIGNING_KEY` | Serve premium audio via signed URLs |

### 🟡 Nice-to-have / can cut for v1
| Key | Note |
|---|---|
| `APPLE_SIGNIN_CLIENT_ID` / `GOOGLE_SIGNIN_CLIENT_ID` + `EXPO_PUBLIC_GOOGLE_*` | Social sign-in. Can launch **email-only** and skip these *(also needs JWKS code)* |
| `FCM_*` / `APNS_*` | Bedtime **push**. The app ships a local reminder already *(also needs push-registration code)* |
| `SHOPIFY_*` | Device-ownership badge only — optional for the subscription |
| `EXPO_PUBLIC_SENTRY_DSN` | Crash/error monitoring (off if blank) |

### ⚪ Not needed
Any third-party payment processor / Stripe / merchant-bank key.

---

## 0. Prerequisite accounts
- **Apple Developer Program** — $99/year (Sign in with Apple, IAP, push, App Store).
- **Google Play Console** — $25 one-time, plus a free **Google Cloud** project.
- **Postgres host** — Neon or Supabase (free tier).
- **Sentry** — free tier. **Shopify** — the existing Glow Company store admin.

## 1. Self-generated — `JWT_SECRET`, `CMS_ADMIN_KEY`
- Run locally (once per secret): `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- Paste each into `server/.env`. Keep them private; do not reuse the `change-me` defaults.

## 2. App wiring — `EXPO_PUBLIC_API_BASE`, `CORS_ORIGINS`
- `EXPO_PUBLIC_API_BASE` = the deployed API URL (e.g. `https://calmcarry-api.fly.dev`).
- `CORS_ORIGINS` = comma-separated web origins allowed to call the API.

## 3. Database — `DATABASE_URL` (Neon = easiest)
- neon.tech → **Create project** → copy the **connection string** (`postgresql://…?sslmode=require`).
- Paste into `DATABASE_URL`; leave `DATABASE_SSL=true`.
- ⚠️ Add TypeORM migrations before prod (currently `synchronize` — can alter/drop columns).

## 4. Apple (developer.apple.com + App Store Connect)
- **`APPLE_BUNDLE_ID`** (`co.theglowcompany.calmcarry`): Identifiers → **+** → App ID → enable
  **Sign in with Apple** + **Push Notifications**.
- **`APPLE_SIGNIN_CLIENT_ID`**: for a native iOS app this is just the **bundle ID** (the token's `aud`).
- **`APPLE_IAP_SHARED_SECRET`**: App Store Connect → your app → **App Information →
  App-Specific Shared Secret** → Manage/Generate → copy. *(Verifies receipts.)*
- **IAP products**: App Store Connect → **Monetization → Subscriptions** → create a group →
  add auto-renewing subs `calmcarry.premium.monthly` + `calmcarry.premium.annual`
  (must match `PREMIUM_PRODUCT_IDS` + `iap.native.ts`).
- **App Store Server Notifications**: App Information → **App Store Server Notifications** →
  **V2**, URL = `https://<your-api>/webhooks/apple`. *(Tells you about renew/cancel/refund.)*
- **Push** — `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_KEY_P8`: Keys → **+** → enable **APNs** →
  download `AuthKey_XXXX.p8` (one-time). Key ID = `APNS_KEY_ID`; Team ID (top-right) =
  `APNS_TEAM_ID`; the `.p8` file contents = `APNS_KEY_P8`.

## 5. Google (Cloud Console + Play Console + Firebase)
- **`GOOGLE_PLAY_PACKAGE`** = `co.theglowcompany.calmcarry`.
- **Sign-in client IDs**: console.cloud.google.com → **OAuth consent screen** → then
  **Credentials → OAuth client ID** ×3 (**Web**, **iOS**, **Android**).
  - `GOOGLE_SIGNIN_CLIENT_ID` (server `aud`) = the **Web** client ID.
  - `EXPO_PUBLIC_GOOGLE_WEB/IOS/ANDROID_CLIENT_ID` = the matching three.
- **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`**: Cloud Console → **Service Accounts** → create →
  **JSON key**. Enable **Google Play Android Developer API**. In Play Console → **API access**
  → link the project + grant the service account financial/order access. *(Verifies receipts.)*
- **Play subscriptions**: Play Console → **Monetize → Subscriptions** → `calmcarry.premium.monthly` + `.annual`.
- **Push** — `FCM_SERVER_KEY`: firebase.google.com → add project (link the GCP project) → add
  Android app → **Project settings → Cloud Messaging**. *(New projects use FCM HTTP v1 / a
  service account instead of a legacy key — may need a small code change.)*
- **Play RTDN**: GCP **Pub/Sub** → topic + push subscription to `https://<your-api>/webhooks/google`;
  paste the topic in Play Console → **Monetization setup**.

## 6. Shopify (device only — optional) — `SHOPIFY_*`
- `SHOPIFY_SHOP` = `theglowcompany.myshopify.com`.
- Admin → **Settings → Apps → Develop apps → Create app** → Admin API scope **`read_orders`** →
  Install → copy the **Admin API access token** → `SHOPIFY_ADMIN_TOKEN`.
- The app's **API secret key** = `SHOPIFY_WEBHOOK_SECRET`.
- `SHOPIFY_BUNDLE_PRODUCT_IDS` = product/variant IDs of the device bundle that grants premium.

## 7. Content CDN — `CDN_BASE_URL`, `CDN_SIGNING_KEY`
- Easiest: **Bunny.net** → Pull/Storage Zone → enable **Token Authentication** → copy the key.
- `CDN_BASE_URL` = zone URL; `CDN_SIGNING_KEY` = that token key.
- ⚠️ The signing scheme in `cdn.service.ts` must match the CDN you choose.

## 8. Sentry — `EXPO_PUBLIC_SENTRY_DSN`
- sentry.io → **Create project** (React Native) → copy the **DSN**. Blank = monitoring off.

---

## Keys alone aren't enough — these also need code
Even with the right keys, a few flows stay disabled until implemented (kept fail-closed for safety):
- **Social sign-in** — real JWKS signature verification (`jose` / `google-auth-library`).
- **Subscription webhooks** — Apple JWS / Google Pub/Sub OIDC verification before they process.
- **Google receipt validation** — the Play Developer API client must be wired.
- **Push** — the app must register a device token on sign-in.
- **Migrations** — replace `synchronize` before pointing at prod Postgres.

Each of items 1–2 has a "cut for v1" path (email-only auth; rely on client re-validation) that
removes the dependency entirely.

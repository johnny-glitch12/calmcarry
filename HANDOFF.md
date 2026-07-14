# CalmCarry - project hand-off

The companion app for The Glow Company's CalmCarry device, built to the
**Definitive Build Plan** (`~/Downloads/CalmCarry_App_Build_Plan.pdf`).
This is the index - see also `server/BACKEND.md` and `STORE_SUBMISSION.md`.

> **Status:** full-stack app + backend, runs end-to-end **with zero API keys**.
> Nothing is blocked on credentials. Not committed to git yet (by request).

## Run it (all local, no setup)
```bash
# API  (NestJS, port 4000)
cd ~/calmcarry/server && npm install && npm run build && node dist/main.js

# App  (Expo web preview, port 8081)
cd ~/calmcarry && npm install && npx expo start --web

# or the static export the demo uses:
cd ~/calmcarry && npx expo export --platform web && npx serve dist -l 3000
```
Demo login: **sarah@theglowcompany.co / glow1234** (premium household + a device).

## What's built & working now
- **App (Expo / React Native, expo-router):** 5-tab IA (Home · Library · Listen · Community · Profile), the breathing **guided Player** (hero), the **sound machine**, sleep tales, gentle **programs**, anonymous **community** wall, **Watch & learn**, a genuine **kids mode** (Bramble the bear, kid-safe tabs, **parent-gate PIN**, route guard), **multi-profile household** + switcher, freemium **paywall** with real pricing, onboarding, dark/light, Poppins+Montserrat type, the real `calm CARRY` wordmark, device hub + in-app **Glow Orb store** (external checkout).
- **Backend (NestJS + SQLite→Postgres):** auth (email + Apple/Google social), **billing/IAP receipt validation → entitlement**, **household profiles**, **community** (+ light moderation), **notifications** (push tokens), **ownership** (Shopify match + order webhook), **content/CMS** (catalog, signed CDN URLs, publish endpoint), devices/warranty, logs. 26 routes, seeded, curl-verified.
- **App ↔ backend:** auth/me/devices/logs + community + billing are wired (every call has an **offline fallback**, so the app works with the server down).

## What ONLY you / Mason can do (the "leave it last" list)
1. **Developer accounts:** Apple Developer ($99/yr), Google Play ($25), an Expo account (free).
2. **Drop in keys** - every secret is a placeholder in `server/.env.example` (copy to `.env`). Until then each integration auto-runs in dev-fallback:
   - Apple/Google **IAP** secrets · Apple/Google **Sign-in** client ids
   - **Shopify** shop + admin token + bundle product ids + webhook secret
   - **CDN** base url + signing key · **APNs/FCM** push keys · `CMS_ADMIN_KEY` · `JWT_SECRET` · `DATABASE_URL` (Postgres)
3. **Real content & assets:** licensed audio (sound machine + sleep tales), recorded narration (scripts drafted in `docs/`), final cover art, real store/product/privacy/terms URLs (set in `src/content/store.ts` - currently `theglowcompany.co` placeholders; your Drive metadata showed `glowdermal.com.au`, so confirm the domain).
4. **Confirm the store domain + device price** (we deliberately don't hard-code price; checkout shows it).

## Go-live steps (when ready)
1. Fill `server/.env`, set Postgres `DATABASE_URL`, turn off `synchronize` in `app.module.ts` + generate TypeORM migrations.
2. Deploy the API; point the app at it (`src/lib/api.ts` `API_BASE`).
3. Wire the two guarded integration stubs: JWKS verification for social sign-in; the Google Play subscription lookup.
4. `eas build` (config in `eas.json`, bundle id `co.theglowcompany.calmcarry`) → TestFlight / internal testing → store submission (checklist in `STORE_SUBMISSION.md`). Budget for one rejection + resubmit (per the plan).

## Compliance baked in (don't undo)
Wellness-not-medical everywhere (no "anxiety/insomnia/ADHD"; "not a medical device" sits in the store listing's first paragraph). Device language is sensation-honest ("a gentle pulsing in your palm") - never "paired/connected/buzz/vibration" (the device has no Bluetooth). Sleep tracking is intentionally **cut**. Kids mode is parent-gated with zero social/billing surface. Physical device sells via external web checkout (Apple/Play forbid IAP for hardware); the digital subscription uses IAP.

## Repo map
`src/app` routes · `src/features/*` screens · `src/components` primitives · `src/content` library/store · `src/lib` api/store/sessions · `src/theme` tokens · `assets/brand` logos · `server/` the API · `docs/` launch-pack (store copy, privacy, narration scripts, positioning).

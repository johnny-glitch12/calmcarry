# CalmCarry - run the MVP

A working full-stack MVP: Expo (React Native) app + NestJS API, real audio, auth, and bundle entitlement.

## Fastest way to open it

If the dev servers are still running from the build session, just open **http://localhost:8081** in a browser. Otherwise:

```bash
cd ~/calmcarry
./start-all.sh        # starts the API (:4000) + Expo, prints a QR code
```

Then either:
- **On your phone:** install **Expo Go**, scan the QR code in the terminal. (Audio plays immediately; best experience.)
- **In a browser:** press **w** in the Expo terminal (or open http://localhost:8081). On web, tap a play button once - browsers block audio autoplay until you interact.

## Demo login

The sign-in screen is pre-filled with the seeded Glow-bundle owner:

- **Email:** `sarah@theglowcompany.co`
- **Password:** `glow1234`

This account has an **active Calm Plan entitlement**, so the whole library is unlocked. (Any other email/password also works - if the API is down the app signs you in locally so it's always usable.)

## What works in the MVP

- **Onboarding → sign-in → app.** Session + theme persist (AsyncStorage).
- **Auth + entitlement** against the NestJS API (real JWT). Premium unlocks the library; free tier sees the Calm Plan paywall (no in-app price - points to the web store, per the build plan).
- **Real audio** - 5 bundled royalty-free / public-domain soundscapes. The Player and the 20-minute wind-down actually play, loop, and pause.
- **Device hub** - authenticity check (animated), warranty registration (persists to the API), replacement claim.
- **Sleep tracking** - score gauge + sleep-phases hypnogram (sample data); "Last night" card on Tonight.
- **Library + Programs + Sleep tales**, search, Learn (PC8 explainers + wellness disclaimer), Family/kids mode.
- **"Were you settled?" check-in** after wind-down → logged.
- **Light / Dark / System** theming throughout, with calm motion graphics.

## The backend (server/)

NestJS + SQLite (TypeORM), JWT auth. Auto-seeds on first boot.

```bash
cd ~/calmcarry/server
npm run start         # http://localhost:4000  (npm install already done)
```

Endpoints: `POST /auth/login`, `POST /auth/register`, `GET /me`, `GET /content`,
`GET /devices`, `POST /devices`, `POST /devices/:id/claims`, `POST /logs`, `GET /health`.

## Notes / what's still simulated

- **Audio:** royalty-free placeholders (CC0 / public-domain; the piano is CC BY - credited in Account). Production swaps in Glowco's licensed library via the CMS/CDN.
- **Shopify entitlement** is stubbed locally (the seeded `calm_plan`); the real integration is the Shopify Customer-Account-API + order webhooks (Glowco provides the store/keys).
- **Sleep tracking** is the UI on sample data; real sensor-based detection is a later phase.
- No data is committed to git yet (as requested).

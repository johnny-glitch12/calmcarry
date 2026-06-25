# CalmCarry — Store submission checklist

The path to the **"live on stores"** invoice milestone. Most of the app config is done;
the rest needs the Glow Company's developer accounts + a few real URLs.

## 1. Accounts needed (Glow Company / Mason)
- [ ] **Apple Developer Program** — $99/yr (for App Store Connect + TestFlight)
- [ ] **Google Play Console** — $25 one-time
- [ ] **Expo account** (free) for EAS builds — `npx eas login`

## 2. Already configured in this repo
- [x] App name **CalmCarry**, slug `calmcarry`, version `1.0.0`
- [x] iOS `bundleIdentifier` + Android `package` = `co.theglowcompany.calmcarry` (`app.json`) — change if the Glow Company prefers another reverse-domain
- [x] App icon, adaptive icon, splash (mint `#D3EDEA`) in `assets/images/`
- [x] `eas.json` with development / preview / production profiles
- [x] Wellness disclaimer in-app (About screen + Learn articles) — App Review wants this for wellness apps
- [x] No IAP: physical Glow Orb + digital bundle both via external web (compliant — Apple 3.1.5a physical, entitlement-on-sign-in for digital)

## 3. Fill in before submitting (placeholders today)
- [ ] Real store/product URL in `src/content/store.ts` → `DEVICE_CHECKOUT_URL` (currently `theglowcompany.co/products/calmcarry-glow-orb`)
- [ ] Real `PRIVACY_URL`, `TERMS_URL`, `SUPPORT_URL` (same file) — Apple/Google **require a working Privacy Policy URL**
- [ ] Confirm the store domain — Drive metadata showed `glowdermal.com.au`; app uses `theglowcompany.co`
- [ ] Replace the AI/placeholder cover art + audio with the Glow Company's licensed finals (see `AUDIO_CREDITS`)

## 4. Store listing assets
- [ ] Screenshots (6.7" iPhone + 5.5" + iPad; Android phone/tablet) — capture from the app
- [ ] App description, keywords, subtitle, support email
- [ ] Age rating questionnaire — note **Kids mode** exists → answer the kids/COPPA questions (we collect no ad IDs, minimal data; "Made for Kids" is optional — only if marketing to children)

## 5. App privacy / data safety answers
- Data collected: **account email/name** only (via Glow sign-in); listen logs tied to account.
- **No tracking**, no ads, no third-party analytics SDKs currently.
- Audio plays in silent mode (already configured).

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
- The local NestJS+SQLite server is a stand-in. Production needs the Shopify
  Customer-Account-API login + order-webhook → entitlement service, a hosted DB,
  and a signed-URL audio CDN (Phase 1–2 backend per the build plan).
- Point `src/lib/api.ts` `API_BASE` at the deployed backend URL.

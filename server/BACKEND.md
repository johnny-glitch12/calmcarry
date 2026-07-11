# CalmCarry API — backend

NestJS + TypeORM. Boots and runs the **whole app end-to-end with zero credentials**
(SQLite + dev-fallback for every integration). Drop real keys into `.env`
(see `.env.example`) for production — nothing else changes.

```bash
npm install
npm run build && node dist/main.js     # or: npm run start:dev
# API on http://localhost:4000  ·  register a throwaway account via POST /auth/register
```

## Modules
| Area | Routes |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/register`, `POST /auth/social` (Apple/Google), `GET /me` |
| Billing (IAP) | `POST /billing/validate` {store, receipt, productId}, `GET /billing/status` |
| Profiles (household) | `GET/POST /profiles`, `PATCH/DELETE /profiles/:id` |
| Content / CMS | `GET /content`, `GET /content/:id/signed-url`, `POST /checkin/recommend`, `POST /admin/content` (x-cms-key) |
| Ownership | `POST /ownership/match` {email}, `POST /webhooks/shopify/orders` (HMAC) |
| Community | `GET /community/posts`, `POST /community/posts` |
| Notifications | `POST /notifications/register`, `POST /notifications/test` |
| Devices | `GET/POST /devices`, `/devices/:id/claims` |
| Logs | `POST /logs` |
| Health | `GET /health` |

## Data model (build plan §9)
Owner (household) · Profile (adult|kids) · Entitlement (tier/plan/source/expiresAt) ·
Device + WarrantyClaim · ContentItem (locked, newThisMonth, audioKey) · Program ·
SavedMix · CommunityPost (moderation) · PushToken · SessionLog.

## Integrations — all behind placeholders (`.env.example`)
Each runs in **DEV-FALLBACK** until its keys are set; the startup log prints which are live.

| Integration | Keys to set | Dev-fallback behaviour |
|---|---|---|
| Apple IAP receipt | `APPLE_IAP_SHARED_SECRET` | grants a dev subscription so the purchase flow works |
| Google Play billing | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | guarded — wire the Play Developer API client |
| Apple/Google Sign-in | `APPLE_SIGNIN_CLIENT_ID` / `GOOGLE_SIGNIN_CLIENT_ID` | verifies the identity token against the provider JWKS (RS256 sig + issuer + audience); fails closed if unset |
| Shopify ownership | `SHOPIFY_SHOP`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_BUNDLE_PRODUCT_IDS`, `SHOPIFY_WEBHOOK_SECRET` | recognizes theglowcompany.co emails as owners |
| Content CDN signing | `CDN_BASE_URL`, `CDN_SIGNING_KEY` | returns the bundled asset path unsigned |
| Push (APNs/FCM) | `FCM_SERVER_KEY` / `APNS_*` | logs instead of sending |
| CMS publish | `CMS_ADMIN_KEY` | `dev-cms-key` |

## Before production
- **Database**: set `DATABASE_URL` (Postgres) and turn OFF `synchronize` in `app.module.ts` — generate TypeORM migrations instead.
- **Secrets**: real `JWT_SECRET` + the keys above. Never commit `.env`.
- **Sign-in**: DONE — identity tokens are verified against the Apple/Google JWKS (`jose`: RS256 signature + issuer + audience, fail-closed in `social-auth.service.ts`). Only the real client ids (table above) still need to be set.
- **Google IAP**: implement the Android Publisher subscription lookup in `receipt-validation.service.ts`.
- **App wiring (client side, not done here)**: point `src/lib/api.ts` at the deployed URL and call `POST /billing/validate` after a StoreKit/Play purchase, `GET/POST /profiles` for the household, and `GET /community/posts`. The app currently works on local state + these endpoints are ready.

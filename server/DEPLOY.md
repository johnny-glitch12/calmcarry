# Deploying the CalmCarry API

The server runs on **SQLite locally** and **Postgres in production** (set `DATABASE_URL`).
Production refuses to boot until the critical secrets are set (see `src/main.ts`).

## 1. Provision a Postgres database
Any hosted Postgres works (Fly Postgres, Neon, Supabase, RDS). Grab its connection URL.

## 2. Set secrets (example: Fly.io)
```sh
fly launch --no-deploy            # creates the app from fly.toml
# DB: create a Neon project (free tier is fine at launch) and copy its URL -
# use sslmode=require&channel_binding=require; TLS is VERIFIED by the app.
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CMS_ADMIN_KEY="$(openssl rand -hex 24)" \
  DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/calmcarry?sslmode=require&channel_binding=require" \
  CORS_ORIGINS="https://app.theglowcompany.co" \
  CRON_SECRET="$(openssl rand -hex 32)" \
  APPLE_ROOT_CERTS_DIR="/app/certs/apple"
# No DB bootstrap step: a fresh Postgres is migrated automatically on first boot
# (migrationsRun applies the committed migrations). CDN keys are NOT needed for
# v1 (bundled-only audio) - set them only with STREAMING_ENABLED=true later.
```

## 3. Deploy
```sh
fly deploy
```

## 4. Remaining integration keys (optional - each degrades gracefully without them)
Set when ready (see `.env.example` for the full list):
`APPLE_ROOT_CERTS_DIR`, `APPLE_APP_APPLE_ID`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`,
`APPLE_SIGNIN_CLIENT_ID`, `GOOGLE_SIGNIN_CLIENT_ID`, `SHOPIFY_SHOP`, `SHOPIFY_ADMIN_TOKEN`,
`SHOPIFY_WEBHOOK_SECRET`, and push: APNs (`APNS_KEY_P8` / `APNS_KEY_ID` / `APNS_TEAM_ID`)
+ FCM v1 (`FIREBASE_SERVICE_ACCOUNT_JSON`). (Legacy `FCM_SERVER_KEY` is gone - FCM v1 only.)

## 5. Point the app at it
The Expo build profiles already pin `EXPO_PUBLIC_API_BASE=https://api.theglowcompany.co`
(eas.json) - create the DNS CNAME `api.theglowcompany.co → calmcarry-api.fly.dev`, then
`fly certs add api.theglowcompany.co`. The binary never encodes the host choice again.

## Notes
- `synchronize` is NEVER on against Postgres. A fresh DB is built by the committed
  migrations on first boot; ongoing schema changes = generate a new migration.
- The daily retention purge runs in-process on the always-on machine, PLUS the
  GitHub Actions belt-and-braces cron (`.github/workflows/retention-purge.yml`,
  needs the `CRON_SECRET` repo secret).
- Apple Root CA certs for StoreKit 2 receipt verification are committed at
  `server/certs/apple/` and baked into the image; `APPLE_ROOT_CERTS_DIR=/app/certs/apple`.
- The seed (content catalogue + programs) runs on first boot when the DB is empty;
  the demo user is **dev-only** and never seeded in production.

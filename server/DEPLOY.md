# Deploying the CalmCarry API

The server runs on **SQLite locally** and **Postgres in production** (set `DATABASE_URL`).
Production refuses to boot until the critical secrets are set (see `src/main.ts`).

## 1. Provision a Postgres database
Any hosted Postgres works (Fly Postgres, Neon, Supabase, RDS). Grab its connection URL.

## 2. Set secrets (example: Fly.io)
```sh
fly launch --no-deploy            # creates the app from fly.toml
fly postgres create               # or use Neon/Supabase, then attach the URL
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CMS_ADMIN_KEY="$(openssl rand -hex 24)" \
  DATABASE_URL="postgres://user:pass@host:5432/calmcarry" \
  CORS_ORIGINS="https://app.theglowcompany.co" \
  CDN_BASE_URL="https://cdn.theglowcompany.co" \
  CDN_SIGNING_KEY="$(openssl rand -hex 32)" \
  DB_SYNC="true"                  # one-time: bootstrap the schema on the fresh DB
```
After the first successful boot, unset the bootstrap sync:
```sh
fly secrets unset DB_SYNC
```

## 3. Deploy
```sh
fly deploy
```

## 4. Remaining integration keys (optional — each degrades gracefully without them)
Set when ready (see `.env.example` for the full list):
`APPLE_IAP_SHARED_SECRET`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `APPLE_SIGNIN_CLIENT_ID`,
`GOOGLE_SIGNIN_CLIENT_ID`, `SHOPIFY_SHOP`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`,
`FCM_SERVER_KEY` / APNs keys.

## 5. Point the app at it
In the Expo app set `EXPO_PUBLIC_API_BASE=https://calmcarry-api.fly.dev` (build-time env).

## Notes
- `synchronize` is OFF in production except when `DB_SYNC=true` (the one-time bootstrap).
  For ongoing schema changes, generate TypeORM migrations rather than leaving sync on.
- The seed (content catalogue + programs) runs on first boot when the DB is empty;
  the demo user is **dev-only** and never seeded in production.

# CalmCarry mobile app — environment (build-time, PUBLIC vars only)
# The app has no runtime .env: EXPO_PUBLIC_* values are baked into the binary
# at build time by the EAS profile (eas.json). Secrets never live here — they
# are server-side only (Vercel project env: DATABASE_URL, JWT_SECRET, Apple
# verification keys, CRON_SECRET, CMS_ADMIN_KEY, CORS_ORIGINS…).

## What the LIVE App Store build (1.0.0 build 18, "production" profile) ships:
EXPO_PUBLIC_API_BASE=https://calmcarry-api.vercel.app
EXPO_PUBLIC_IOS_SUBSCRIPTION_GROUP=22297018
SENTRY_DISABLE_AUTO_UPLOAD=true          # build-time only (no source-map upload)

## Unset in the live build (feature stays off by design):
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=        # empty → "Continue with Google" hidden
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_SENTRY_DSN=                  # empty → crash reporting fully off
EXPO_PUBLIC_COMP_EMAIL=                  # demo login: web/dev only, dead in store builds
EXPO_PUBLIC_COMP_PASSWORD=

## Other profiles (eas.json):
# device  : same API base + Sentry-off, real hardware, internal distribution
# preview : iOS simulator build, no API base pinned (localhost default)
# dev     : development client
# IAP product ids (must match ASC/Play): calmcarry.premium.monthly / calmcarry.premium.annual

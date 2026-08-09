#!/usr/bin/env bash
# Bring up the live CalmCarry API on Railway (Fly path blocked on account
# verification; same Dockerfile, same env contract - see DEPLOY.md).
# DATABASE_URL is read from the CLIPBOARD (Neon -> Connect -> Copy snippet) so
# the value never appears in a terminal, a log, or this file.
set -euo pipefail
cd "$(dirname "$0")"

DB_URL="$(pbpaste)"
case "$DB_URL" in
  postgresql://*) : ;;
  *) echo "Clipboard does not hold a postgresql:// URL. In Neon: Connect -> Copy snippet, then rerun." >&2; exit 1 ;;
esac

railway init -n calmcarry-api

# One service, created with the full boot-guard env in a single shot.
# JWT/CMS/CRON secrets are minted fresh here - nobody ever needs to know them.
# APPLE_APP_APPLE_ID and APPLE_SIGNIN_CLIENT_ID are PUBLIC (the numeric App Store
# id + the app's bundle id), not secrets. APPLE_APP_APPLE_ID is REQUIRED for iOS
# payments: without it the production receipt verifier fails CLOSED, so a real
# buyer is charged by Apple and unlocks nothing. APPLE_SIGNIN_CLIENT_ID is a
# boot gate (a sign-in provider must be set or the server refuses to start).
railway add -s calmcarry-api \
  -v "NODE_ENV=production" \
  -v "APPLE_ROOT_CERTS_DIR=/app/certs/apple" \
  -v "APPLE_APP_APPLE_ID=6796861173" \
  -v "APPLE_SIGNIN_CLIENT_ID=co.theglowcompany.calmcarry" \
  -v "CORS_ORIGINS=https://app.theglowcompany.co" \
  -v "JWT_SECRET=$(openssl rand -hex 32)" \
  -v "CMS_ADMIN_KEY=$(openssl rand -hex 24)" \
  -v "CRON_SECRET=$(openssl rand -hex 32)" \
  -v "DATABASE_URL=$DB_URL"

# upload this directory (Dockerfile build) and detach; logs polled separately
railway up -s calmcarry-api --detach

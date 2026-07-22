#!/usr/bin/env bash
# One-shot bring-up for the live CalmCarry API (see DEPLOY.md).
# Stage 1 (free): create the Fly app + stage all boot-guard secrets.
#   DATABASE_URL is read from the CLIPBOARD (copy it from Neon first) so the
#   value never appears in a terminal, a log, or this file.
# Stage 2 (~$3/mo always-on machine): `fly deploy` - run with --deploy.
set -euo pipefail
cd "$(dirname "$0")"

DB_URL="$(pbpaste)"
case "$DB_URL" in
  postgresql://*) : ;;
  *) echo "Clipboard does not hold a postgresql:// URL. In Neon: Connect -> Copy snippet, then rerun." >&2; exit 1 ;;
esac

# idempotent: app may already exist from a previous run
fly apps create calmcarry-api 2>/dev/null || echo "app calmcarry-api already exists (ok)"

# --stage: store secrets without triggering a release (no machines yet anyway).
# JWT/CMS/CRON secrets are minted fresh here - nobody ever needs to know them.
fly secrets set --app calmcarry-api --stage \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CMS_ADMIN_KEY="$(openssl rand -hex 24)" \
  CRON_SECRET="$(openssl rand -hex 32)" \
  DATABASE_URL="$DB_URL" \
  CORS_ORIGINS="https://app.theglowcompany.co"

echo "Secrets staged."
if [ "${1:-}" = "--deploy" ]; then
  fly deploy --app calmcarry-api
fi

#!/usr/bin/env bash
# CalmCarry - start the API + Expo app together.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "→ Starting CalmCarry API (NestJS, http://localhost:4000)…"
( cd "$ROOT/server" && npm run start > /tmp/calmcarry-server.log 2>&1 & )

# wait for the API to answer
for i in $(seq 1 20); do
  if curl -s -m 2 -o /dev/null http://localhost:4000/health 2>/dev/null; then
    echo "  API up."; break
  fi
  sleep 1
done

echo "→ Starting Expo (press 'w' for web, or scan the QR with Expo Go)…"
cd "$ROOT"
exec npx expo start

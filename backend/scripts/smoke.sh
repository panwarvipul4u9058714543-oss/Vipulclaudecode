#!/usr/bin/env bash
# End-to-end smoke test hitting a live backend. Usage:
#   BASE_URL=http://localhost:3000 ./scripts/smoke.sh
#   BASE_URL=https://your-app.up.railway.app ./scripts/smoke.sh
#
# NOTE: this script assumes a debug endpoint or Firebase-emulator seeded
# tokens. Fill in the AUTH_TOKEN vars from your test Firebase project.

set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "→ /healthz"
curl -sfS "$BASE_URL/healthz" | jq .

echo "→ / (root)"
curl -sfS "$BASE_URL/" | jq .

echo "OK"

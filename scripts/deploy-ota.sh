#!/usr/bin/env bash
# =============================================================================
# deploy-ota.sh – FloraLog Web-Bundle OTA Deploy Script
#
# Usage:
#   ./scripts/deploy-ota.sh [VERSION]
#
# If VERSION is omitted, a UTC timestamp (YYYYMMDDHHmmss) is used.
#
# Prerequisites:
#   - Node.js + npm
#   - wrangler CLI  (npm i -g wrangler)
#   - jq            (brew install jq / apt install jq)
#   - Logged into Cloudflare: wrangler login
#
# Environment variables (can also be placed in .env.deploy):
#   OTA_WORKER_NAME   – name of the deployed OTA Worker (default: floralog-ota)
#   OTA_DEPLOY_SECRET – value of the DEPLOY_SECRET Worker secret
#
# First-time setup (run once):
#   cd workers/ota
#   npx wrangler kv namespace create OTA_KV
#   npx wrangler r2 bucket create floralog-ota
#   npx wrangler secret put DEPLOY_SECRET
#   npx wrangler deploy
#   # → copy the Worker URL and set VITE_OTA_VERSION_URL in .env.local
# =============================================================================

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
VERSION="${1:-$(date -u +"%Y%m%d%H%M%S")}"
DIST_DIR="dist"
BUNDLE_FILE="ota-bundle-${VERSION}.zip"
OTA_WORKER_DIR="workers/ota"
OTA_WORKER_NAME="${OTA_WORKER_NAME:-floralog-ota}"

# Load optional deploy env vars
if [[ -f ".env.deploy" ]]; then
  # shellcheck source=/dev/null
  source ".env.deploy"
fi

# ── Helpers ────────────────────────────────────────────────────────────────────
info()    { echo -e "\033[32m→\033[0m $*"; }
success() { echo -e "\033[32m✓\033[0m $*"; }
die()     { echo -e "\033[31m✗\033[0m $*" >&2; exit 1; }

## jq wird nicht mehr benötigt, stattdessen node
# wrangler wird jetzt als devDependency über npx verwendet

echo ""
echo "🌿 FloraLog OTA Deploy"
echo "   Version : $VERSION"
echo "   Worker  : $OTA_WORKER_NAME"
echo ""

# ── 1. Build web app ───────────────────────────────────────────────────────────
info "Building web app..."
VITE_BUILD_VERSION="$VERSION" npm run build
success "Build complete"

# ── 2. Inject version manifest into build ─────────────────────────────────────
BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat > "$DIST_DIR/bundle-version.json" <<EOF
{ "version": "$VERSION", "buildTime": "$BUILD_TIME" }
EOF
info "Wrote bundle-version.json (version=$VERSION)"

# ── 3. Create ZIP bundle ───────────────────────────────────────────────────────
info "Creating ZIP bundle: $BUNDLE_FILE"
(cd "$DIST_DIR" && npx bestzip "../$BUNDLE_FILE" "*")
success "Bundle created ($(du -sh "$BUNDLE_FILE" | cut -f1))"

# ── 4. Compute SHA-256 ─────────────────────────────────────────────────────────
if command -v sha256sum &>/dev/null; then
  SHA256="$(sha256sum "$BUNDLE_FILE" | cut -d' ' -f1)"
else
  SHA256="$(shasum -a 256 "$BUNDLE_FILE" | cut -d' ' -f1)"
fi
info "SHA-256: $SHA256"

# ── 5. Upload bundle to R2 ─────────────────────────────────────────────────────
info "Uploading bundle to R2..."
(cd "$OTA_WORKER_DIR" && npx wrangler r2 object put \
  "floralog-ota/$BUNDLE_FILE" \
  --file="../../$BUNDLE_FILE" \
  --content-type="application/zip" \
  --remote)
success "Bundle uploaded to R2"

# ── 6. Derive bundle URL ───────────────────────────────────────────────────────


# Feste Worker-URL, damit der Deploy in CI/CD immer funktioniert
WORKER_URL="https://floralog-ota.green-term-27d0.workers.dev"

BUNDLE_URL="${WORKER_URL}/bundle/${BUNDLE_FILE}"
info "Bundle URL: $BUNDLE_URL"

# ── 7. Update version manifest via Worker PUT endpoint ────────────────────────
info "Publishing version manifest..."

if [[ -z "${OTA_DEPLOY_SECRET:-}" ]]; then
  die "OTA_DEPLOY_SECRET is not set. Export it or add it to .env.deploy"
fi

# Manifest-JSON direkt als Here-String erzeugen (kein node nötig)
MANIFEST=$(cat <<EOF
{"version":"${VERSION}","bundleUrl":"${BUNDLE_URL}","sha256":"${SHA256}","url":"${BUNDLE_URL}","hash":"${SHA256}","buildTime":"${BUILD_TIME}"}
EOF
)

info "Manifest: $MANIFEST"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${WORKER_URL}/version.json" \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Secret: ${OTA_DEPLOY_SECRET}" \
  -d "$MANIFEST")

if [[ "$HTTP_STATUS" != "200" ]]; then
  die "Worker returned HTTP $HTTP_STATUS when updating version manifest"
fi
success "Version manifest published"


# ── 8. Cleanup ─────────────────────────────────────────────────────────────────
rm -f "$BUNDLE_FILE"
success "Temp bundle removed"

echo ""
echo "✅ OTA deploy complete!"
echo "   Version $VERSION is now live at $WORKER_URL/version.json"
echo ""
echo "   Devices running an older version will see the update banner"
echo "   on next app launch."

# ── 9. Write OTA URLs to .env.ota.local ──────────────────────────────────────
OTA_ENV_FILE=".env.ota.local"
echo "VITE_OTA_VERSION_URL=${WORKER_URL}/version.json" > "$OTA_ENV_FILE"
echo "VITE_OTA_BUNDLE_URL=$BUNDLE_URL" >> "$OTA_ENV_FILE"
success ".env.ota.local written with OTA URLs"

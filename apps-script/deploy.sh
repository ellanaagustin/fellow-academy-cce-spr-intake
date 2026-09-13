#!/usr/bin/env bash
# Push apps-script/ to the linked Apps Script project and republish deployments.
#   ./apps-script/deploy.sh public     # candidate endpoint (execute as owner, anyone) — the LIVE form endpoint in index.html
#   ./apps-script/deploy.sh admin      # admin page (execute as user accessing, any signed-in Google account, ADMIN_EMAILS gates)
#   ./apps-script/deploy.sh all
# One script project, bound to the "SPR Intakes" sheet owned by jeraisy.swnco@gmail.com; it is production (decided 2026-09-13).
# clasp is logged in as that account. Apps Script keeps web-app settings inside the manifest of each version,
# so the manifest is rewritten before every deploy to match the target.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-all}"
[[ "$TARGET" == "dev" || "$TARGET" == "prod" ]] && TARGET="${2:-all}"   # tolerate the old "dev all" form

CLASP="clasp"
PUBLIC_ID="AKfycbxG6X95p5DFTCsd2so5dQj-8h-2jWtZikgklTsazisHQlcN7VzET9_woJI3sEqC3Lz3"
ADMIN_ID="AKfycbx9pxbXowdjzCqkfo-t1F-16cbxL6D3Kj-zOinIKgMybPdmeRcDg2OCvRC-CTjZ_Wn3"
ADMIN_ACCESS="ANYONE"   # MYSELF blocks every non-owner account before doGet; ADMIN_EMAILS is the gate

manifest() {
  cat > apps-script/appsscript.json <<EOF
{
  "timeZone": "Australia/Sydney",
  "dependencies": {},
  "webapp": { "executeAs": "$1", "access": "$2" },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.send"
  ],
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF
}

deploy() {  # executeAs access deploymentId description
  manifest "$1" "$2"
  $CLASP push -f
  if [[ -n "$3" ]]; then $CLASP deploy -i "$3" -d "$4"; else $CLASP deploy -d "$4"; fi
}

[[ "$TARGET" == "public" || "$TARGET" == "all" ]] && deploy USER_DEPLOYING ANYONE_ANONYMOUS "$PUBLIC_ID" "public $(date +%Y-%m-%d_%H%M)"
[[ "$TARGET" == "admin"  || "$TARGET" == "all" ]] && deploy USER_ACCESSING "$ADMIN_ACCESS" "$ADMIN_ID" "admin $(date +%Y-%m-%d_%H%M)"
echo "done: $TARGET"

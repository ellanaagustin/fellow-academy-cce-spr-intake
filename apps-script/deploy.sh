#!/usr/bin/env bash
# Push apps-script/ to the linked Apps Script project and republish deployments.
#   ./apps-script/deploy.sh dev public     # candidate endpoint (execute as owner, anyone)
#   ./apps-script/deploy.sh dev admin      # admin page (execute as user accessing, restricted)
#   ./apps-script/deploy.sh dev all
# Apps Script keeps web-app settings inside the manifest of each version, so the manifest
# is rewritten before every deploy to match the target.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV="${1:-dev}"; TARGET="${2:-all}"

case "$ENV" in
  dev)
    PUBLIC_ID="AKfycbxG6X95p5DFTCsd2so5dQj-8h-2jWtZikgklTsazisHQlcN7VzET9_woJI3sEqC3Lz3"
    ADMIN_ID="AKfycbx9pxbXowdjzCqkfo-t1F-16cbxL6D3Kj-zOinIKgMybPdmeRcDg2OCvRC-CTjZ_Wn3"
    ADMIN_ACCESS="MYSELF" ;;
  prod)
    PUBLIC_ID="${PROD_PUBLIC_ID:?set PROD_PUBLIC_ID}"
    ADMIN_ID="${PROD_ADMIN_ID:?set PROD_ADMIN_ID}"
    ADMIN_ACCESS="${PROD_ADMIN_ACCESS:-DOMAIN}" ;;
  *) echo "unknown env $ENV"; exit 1 ;;
esac

manifest() {
  cat > apps-script/appsscript.json <<EOF
{
  "timeZone": "Australia/Sydney",
  "dependencies": {},
  "webapp": { "executeAs": "$1", "access": "$2" },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF
}

deploy() {  # executeAs access deploymentId description
  manifest "$1" "$2"
  clasp push -f
  clasp deploy -i "$3" -d "$4"
}

[[ "$TARGET" == "public" || "$TARGET" == "all" ]] && deploy USER_DEPLOYING ANYONE_ANONYMOUS "$PUBLIC_ID" "public $(date +%Y-%m-%d_%H%M)"
[[ "$TARGET" == "admin"  || "$TARGET" == "all" ]] && deploy USER_ACCESSING "$ADMIN_ACCESS" "$ADMIN_ID" "admin $(date +%Y-%m-%d_%H%M)"
echo "done: $ENV $TARGET"

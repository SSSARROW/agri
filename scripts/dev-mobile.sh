#!/usr/bin/env bash
# Usage: scripts/dev-mobile.sh [local|prod] [extra flutter run args...]   (default: local)
# local = Android emulator hitting the host machine via 10.0.2.2.
# For a physical phone, use your LAN IP instead: LOCAL_HOST=192.168.1.42 scripts/dev-mobile.sh local
set -euo pipefail
mode="${1:-local}"; shift || true
host="${LOCAL_HOST:-10.0.2.2}"
case "$mode" in
  local)
    defines=(--dart-define=API_BASE_URL="http://$host:8000" --dart-define=AUTH_BASE_URL="http://$host:8001") ;;
  prod)
    defines=(--dart-define=API_BASE_URL=https://agri-api-6ymr.onrender.com --dart-define=AUTH_BASE_URL=https://agri-web-backend.onrender.com) ;;
  *) echo "usage: $0 [local|prod] [flutter args]" >&2; exit 1 ;;
esac
echo "mobile -> $mode"
cd "$(dirname "$0")/../mobile"
exec flutter run "${defines[@]}" "$@"

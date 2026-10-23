#!/usr/bin/env bash
# Usage: scripts/dev-web.sh [local|prod]   (default: local)
# Runs the Next.js dev server against local or deployed web-backend. A shell
# env var beats .env.local, so nothing on disk needs editing to switch.
set -euo pipefail
mode="${1:-local}"
case "$mode" in
  local) url="http://localhost:8001"; field="http://localhost:8000" ;;
  prod)  url="https://agri-web-backend.onrender.com"; field="https://agri-api-6ymr.onrender.com" ;;
  *) echo "usage: $0 [local|prod]" >&2; exit 1 ;;
esac
echo "web frontend -> $mode ($url)"
cd "$(dirname "$0")/../web/frontend"
NEXT_PUBLIC_API_URL="$url" NEXT_PUBLIC_FIELD_API_URL="$field" exec npm run dev

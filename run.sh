#!/usr/bin/env bash
# Usage: ./run.sh [local|prod|phone|emu]
#   local  start both backends and the website on this machine  -> http://localhost:3000
#   prod   start only the website, using the deployed backends on Render
#   phone  run the Android app on the connected emulator/phone against the deployed backends
#   emu    start both backends locally and run the Android app on the emulator against them
cd "$(dirname "$0")"
mode="${1:-local}"
case "$mode" in
  local)
    trap 'kill 0' EXIT
    (cd api && .venv/bin/uvicorn app.main:app --port 8000) &
    (cd web/backend && .venv/bin/uvicorn main:app --port 8001) &
    sleep 4
    scripts/dev-web.sh local ;;
  prod)  scripts/dev-web.sh prod ;;
  emu)
    trap 'kill 0' EXIT
    (cd api && .venv/bin/uvicorn app.main:app --port 8000) &
    (cd web/backend && .venv/bin/uvicorn main:app --port 8001) &
    sleep 4
    cd mobile && flutter run \
      --dart-define=API_BASE_URL=http://10.0.2.2:8000 \
      --dart-define=AUTH_BASE_URL=http://10.0.2.2:8001 ;;
  phone) cd mobile && flutter run \
           --dart-define=API_BASE_URL=https://agri-api-6ymr.onrender.com \
           --dart-define=AUTH_BASE_URL=https://agri-web-backend.onrender.com ;;
  *) echo "usage: $0 [local|prod|phone|emu]"; exit 1 ;;
esac

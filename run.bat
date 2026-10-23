@echo off
REM Usage: run.bat [local|prod|phone]
REM   local  start both backends and the website on this machine  -> http://localhost:3000
REM   prod   start only the website, using the deployed backends on Render
REM   phone  run the Android app on the connected emulator/phone against the deployed backends
cd /d "%~dp0"
set MODE=%1
if "%MODE%"=="" set MODE=local

if "%MODE%"=="local" (
  start "field-api" cmd /k "cd api && .venv\Scripts\uvicorn app.main:app --port 8000"
  start "account-service" cmd /k "cd web\backend && .venv\Scripts\uvicorn main:app --port 8001"
  cd web\frontend
  set NEXT_PUBLIC_API_URL=http://localhost:8001
  set NEXT_PUBLIC_FIELD_API_URL=http://localhost:8000
  call npm run dev
  goto :eof
)
if "%MODE%"=="prod" (
  cd web\frontend
  set NEXT_PUBLIC_API_URL=https://agri-web-backend.onrender.com
  set NEXT_PUBLIC_FIELD_API_URL=https://agri-api-6ymr.onrender.com
  call npm run dev
  goto :eof
)
if "%MODE%"=="phone" (
  cd mobile
  flutter run --dart-define=API_BASE_URL=https://agri-api-6ymr.onrender.com --dart-define=AUTH_BASE_URL=https://agri-web-backend.onrender.com
  goto :eof
)
echo usage: run.bat [local^|prod^|phone]

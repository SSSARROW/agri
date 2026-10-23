@echo off
REM Usage: run.bat [local|prod|phone|emu]
REM   local  start both backends and the website on this machine  -> http://localhost:3000
REM   prod   start only the website, using the deployed backends on Render
REM   phone  run the Android app on the connected emulator/phone against the deployed backends
REM   emu    start both backends locally and run the Android app on the emulator against them
REM One-time setup: python -m venv .venv inside api\ and web\backend\, then pip install -r requirements.txt;
REM npm install inside web\frontend; Flutter + Android SDK for phone/emu.
cd /d "%~dp0"
set MODE=%1
if "%MODE%"=="" set MODE=local

set UV_API=python -m uvicorn
if exist api\.venv\Scripts\python.exe set UV_API=.venv\Scripts\python -m uvicorn
set UV_WEB=python -m uvicorn
if exist web\backend\.venv\Scripts\python.exe set UV_WEB=.venv\Scripts\python -m uvicorn

if "%MODE%"=="local" (
  start "field-api" cmd /k "cd api && %UV_API% app.main:app --port 8000"
  start "account-service" cmd /k "cd web\backend && %UV_WEB% main:app --port 8001"
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
if "%MODE%"=="emu" (
  start "field-api" cmd /k "cd api && %UV_API% app.main:app --port 8000"
  start "account-service" cmd /k "cd web\backend && %UV_WEB% main:app --port 8001"
  timeout /t 5 >nul
  cd mobile
  flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000 --dart-define=AUTH_BASE_URL=http://10.0.2.2:8001
  goto :eof
)
echo usage: run.bat [local^|prod^|phone^|emu]

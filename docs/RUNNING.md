# Running Agri: local vs deployed

Three services plus the mobile app. Each can point at local servers or the
deployed Render ones.

| Service | Local port | Deployed URL |
|---|---|---|
| `api` | 8000 | https://agri-api-6ymr.onrender.com |
| `web/backend` | 8001 | https://agri-web-backend.onrender.com |
| `web/frontend` | 3000 | https://agri-web-frontend.onrender.com |

Commands assume macOS and run from the repo root (`~/agri`). Use one terminal
tab per long-running command.

## 1. Local servers

Only needed for local mode. Deployed mode needs none of this.

```bash
# Database (local Postgres on 5433; only needed for DB-backed API routes)
docker compose -f infra/docker-compose.yml up -d

# API (8000)
cd api && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Web backend (8001)
cd web/backend && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

`--host 0.0.0.0` matters: it lets the emulator and a phone reach the servers.
`127.0.0.1` would only work for the Mac itself.

Quick check:

```bash
curl http://localhost:8000/health   # {"status":"ok"}
curl http://localhost:8001/         # {"status":"ok"}
```

## 2. Web frontend

```bash
scripts/dev-web.sh local   # talks to http://localhost:8001
scripts/dev-web.sh prod    # talks to the deployed web backend
```

The script sets `NEXT_PUBLIC_API_URL` in the shell, which overrides
`.env.local`. Restart the script to switch modes. Open http://localhost:3000.

## 3. Mobile app

### Emulator

Start the emulator (it is not on PATH, so use the full path):

```bash
~/Android/Sdk/emulator/emulator -avd agri_pixel
export PATH=$PATH:~/Android/Sdk/platform-tools
adb devices            # wait for: emulator-5554   device
```

Run the app:

```bash
scripts/dev-mobile.sh local -d emulator-5554   # local servers (via 10.0.2.2)
scripts/dev-mobile.sh prod  -d emulator-5554   # deployed servers
```

`10.0.2.2` is the emulator's alias for the host Mac. It does not work on a
real phone.

### Physical phone

1. Enable **Developer options** and **USB debugging** on the phone, connect it
   by USB, and accept the "Allow USB debugging" prompt.
2. Confirm it is detected:
   ```bash
   adb devices          # the phone should show as "device"
   flutter devices
   ```
3. **Deployed mode** works from anywhere with internet:
   ```bash
   scripts/dev-mobile.sh prod -d <device-id>
   ```
4. **Local mode** needs the phone and the Mac on the **same Wi-Fi**. Find the
   Mac's LAN IP and pass it:
   ```bash
   ipconfig getifaddr en0     # e.g. 192.168.1.126
   LOCAL_HOST=192.168.1.126 scripts/dev-mobile.sh local -d <device-id>
   ```
   Sanity check from the phone's browser: `http://<mac-ip>:8000/health`
   should show `{"status":"ok"}`. If it times out, allow incoming
   connections for Python in macOS System Settings > Network > Firewall, or
   confirm the servers were started with `--host 0.0.0.0`.

Debug builds allow local plain-HTTP traffic. Remove that policy and use HTTPS
before shipping a production build.

A plain `flutter run` with no flags defaults to the **deployed** servers.

## 4. Switching quickly

| I want | Run |
|---|---|
| Everything local | start section 1, then `dev-web.sh local` and `dev-mobile.sh local` |
| Everything deployed | `dev-web.sh prod` and `dev-mobile.sh prod` (no local servers) |
| Web local, mobile deployed (or reverse) | mix the two scripts freely |

Local and deployed use different databases, so data created in one will not
appear in the other.

## 5. Deployed notes

- Render's free tier spins services down after about 15 minutes idle; the
  first request then takes 30-50s. `.github/workflows/keep-alive.yml` pings
  all three every 10 minutes, and an external uptime monitor can add a second
  line of defence.
- Free services share a 750 instance-hours monthly budget, so keeping all
  three awake around the clock all month exceeds it.
- Pushing to `main` redeploys all three services, with a short blip.

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `address already in use` on 8000/8001/3000 | `lsof -ti :8000 \| xargs kill` (change the port) |
| `emulator: command not found` | use `~/Android/Sdk/emulator/emulator` |
| Emulator can't reach local API | use `10.0.2.2`, not `localhost`, and start uvicorn with `--host 0.0.0.0` |
| Phone can't reach local API | same Wi-Fi, correct LAN IP, firewall allows Python |
| DB-backed API routes fail locally | start Postgres: `docker compose -f infra/docker-compose.yml up -d` |
| First deployed request is very slow | Render cold start, wait about 30-50s |

## Quick start (new frontends)

`./run.sh local` (or `run.bat local` on Windows) starts the field API, the account service and the website at
http://localhost:3000. `./run.sh prod` runs only the website against the deployed Render backends, and
`./run.sh phone` runs the Android app against the deployed backends, and `./run.sh emu` runs it on the emulator against local backends.

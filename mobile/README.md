# Agri Field (mobile)

The farmer/collector-facing Flutter app.

## Default: talks to the deployed servers

`flutter run` or `flutter build apk --release` with **no flags at all**
already points at the live deployed backend
(`https://agri-api-6ymr.onrender.com`, `https://agri-web-backend.onrender.com`
— see [`lib/core/api_client.dart`](lib/core/api_client.dart)). This is what
you want for a demo, an exhibition QR, or just trying the app — any batch QR
it generates will work when scanned from any phone, anywhere, with no
backend running on your machine.

**Only use the `--dart-define` overrides below if you're actively changing
backend code and want the app to hit your own local server instead.** A
build made with these flags bakes your computer's local/LAN address into
every QR it generates — that QR stops working the moment you're off that
network, your IP changes, or your local server isn't running. Before
building anything meant to be scanned by someone else (a poster, a
teammate's phone, a real demo), rebuild with no `--dart-define` flags so it
falls back to the deployed default.

## Running against your own local backend instead

This guide covers running it on a real Android phone against a backend
running on your own machine — the main difference from using the emulator is
how the phone reaches that backend, since it can't use the emulator's
`10.0.2.2` localhost alias.

## Prerequisites

- Flutter SDK installed, `flutter doctor` shows no blocking issues for Android.
- An Android phone with a USB cable, or on the same Wi-Fi network as your
  computer for wireless debugging.
- Both backend servers runnable from source: [`api/`](../api) and
  [`web/backend/`](../web/backend) (see their own setup — `.env` from
  `.env.example`, a Python venv, `pip install -r requirements.txt`).

## 1. Enable developer options and USB debugging on the phone

Settings → About phone → tap "Build number" 7 times → Developer options
appears in Settings → enable **USB debugging**.

## 2. Connect the phone

**USB (simplest):** plug it in, accept the "Allow USB debugging?" prompt on
the phone, then confirm it's visible:

```bash
adb devices
```

**Wireless (no cable):** with the phone on the same Wi-Fi as your computer,
follow Android's "Wireless debugging" pairing flow (Settings → Developer
options → Wireless debugging → Pair device with pairing code), then
`adb connect <phone-ip>:<port>` as it instructs.

## 3. Find your computer's LAN IP address

The phone needs your computer's actual network address, not `localhost` or
`10.0.2.2` (that alias only exists inside the Android emulator).

```powershell
ipconfig
# look for "IPv4 Address" under your active adapter, e.g. 192.168.1.42
```

## 4. Start both backend servers, reachable from the network

Bind to `0.0.0.0` (not `127.0.0.1`) so they accept connections from other
devices on the network:

```bash
# from api/
.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# from web/backend/
.venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## 5. Allow the ports through Windows Firewall

The first time, Windows will usually prompt you to allow the connection —
accept it for both private and public networks. If it doesn't, or you get
timeouts from the phone, add the rules manually:

```powershell
New-NetFirewallRule -DisplayName "Agri API" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Agri Auth" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

## 6. Run the app pointed at your computer's IP

From `mobile/`, substituting your actual IP from step 3:

```bash
flutter run -d <device-id> \
  --dart-define=API_BASE_URL=http://192.168.1.42:8000 \
  --dart-define=AUTH_BASE_URL=http://192.168.1.42:8001
```

`flutter devices` lists the `<device-id>` once the phone is connected. Both
`--dart-define`s are required for this local-backend flow — without them the
app falls back to the deployed servers, not the emulator alias, by design
(see above). The Android debug network policy allows this local HTTP
traffic; use HTTPS endpoints and remove that policy before shipping a
production build.

## 7. Grant permissions on first run

The app will prompt for **camera** (scanning batch QR codes) and **location**
(registering a plot, recording a planting) the first time each is used —
allow both. Unlike the emulator's simulated GPS, a real phone's location
should resolve normally outdoors or near a window.

## Installing without staying plugged into a computer

Build a standalone APK and copy it to the phone (via USB file transfer,
email, or a cloud drive) once you don't need to keep iterating from source:

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=http://192.168.1.42:8000 \
  --dart-define=AUTH_BASE_URL=http://192.168.1.42:8001
```

The APK lands at `build/app/outputs/flutter-apk/app-release.apk`. The phone
will need "Install unknown apps" allowed for whichever app you use to open
it. Note this bakes in the IP addresses at build time — if your computer's
LAN IP changes later (common with DHCP), you'll need to rebuild. **Any QR
code this build's app generates will only work on your own network** — don't
hand this APK to someone else, or print one of its QR codes, without
rebuilding without the `--dart-define` flags first.

## Troubleshooting

- **Login/signup hangs or fails immediately**: almost always a
  connectivity issue, not the app — confirm the phone and computer are on
  the same Wi-Fi network (not one on mobile data), and that step 5's
  firewall rules are in place. Test from the phone's browser first:
  `http://<your-ip>:8000/health` should return `{"status":"ok"}`.
- **"Could not get a GPS fix"**: move somewhere with a clearer view of the
  sky and try again — this is expected indoors on a real device, unlike the
  emulator where it's a known simulator limitation.
- **A stored PIN doesn't survive a full app restart**: a known open issue,
  unrelated to running on a real phone specifically — log in with email
  again if it happens.
- Your computer's LAN IP can change when it reconnects to Wi-Fi. If the app
  that worked yesterday can't connect today, redo step 3 and re-run with the
  new `--dart-define` values.

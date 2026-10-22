# Running the mobile app on a real Android phone

The app is Android-only. For servers, ports and the switch scripts see
[RUNNING.md](RUNNING.md); this guide covers only the phone side.
Commands assume macOS, run from the repo root (`~/agri`).

## 1. One-time phone setup

1. **Settings > About phone**: tap **Build number** 7 times to unlock Developer options.
2. **Settings > System > Developer options**: turn on **USB debugging**.
3. Plug the phone into the Mac with a data-capable USB cable.
4. Unlock the phone and accept **Allow USB debugging?** (tick "Always allow").

## 2. Check the phone is detected

```bash
export PATH=$PATH:~/Android/Sdk/platform-tools
adb devices        # your phone should show as "device"
flutter devices    # note the device id in the middle column
```

| `adb devices` shows | Fix |
|---|---|
| nothing | try another cable or port, set USB mode to "File transfer" |
| `unauthorized` | unlock the phone and accept the debugging prompt |
| `offline` | `adb kill-server && adb start-server`, then replug |

## 3. Run against the deployed servers (works anywhere)

Needs only internet on the phone, no local servers:

```bash
scripts/dev-mobile.sh prod -d <device-id>
```

The first request can take 30-50s if Render has spun a service down.

## 4. Run against your local servers

The phone cannot use `localhost` or `10.0.2.2` (that alias is emulator-only).
It needs your Mac's LAN address, and both must be on the **same Wi-Fi**.

1. Start the local servers (see RUNNING.md, section 1). They must bind
   `--host 0.0.0.0`.
2. Find the Mac's IP:
   ```bash
   ipconfig getifaddr en0      # e.g. 192.168.1.126
   ```
3. Sanity check from the **phone's browser**: open
   `http://<mac-ip>:8000/health`. You should see `{"status":"ok"}`.
   If it times out, allow incoming connections for Python in
   System Settings > Network > Firewall, and make sure the router does not
   isolate Wi-Fi clients (guest networks often do).
4. Run the app:
   ```bash
   LOCAL_HOST=<mac-ip> scripts/dev-mobile.sh local -d <device-id>
   ```

Debug builds allow plain-HTTP traffic to the Mac. Local login also needs real
Supabase values in `api/.env` and `web/backend/.env`, otherwise login fails
with a DNS error.

## 5. Without a cable (Wireless debugging)

Android 11+, phone and Mac on the same Wi-Fi:

1. Developer options > **Wireless debugging** > on.
2. Tap **Pair device with pairing code**, then on the Mac:
   ```bash
   adb pair <ip>:<pairing-port>      # enter the 6-digit code
   adb connect <ip>:<connect-port>   # port shown on the main Wireless debugging screen
   adb devices
   ```
3. Use the device id from `flutter devices` as in sections 3 and 4.

## 6. Install a standalone APK (no computer needed afterwards)

```bash
cd mobile
flutter build apk --release        # deployed servers, the default
# or point at local servers:
flutter build apk --release \
  --dart-define=API_BASE_URL=http://<mac-ip>:8000 \
  --dart-define=AUTH_BASE_URL=http://<mac-ip>:8001
```

The APK is at `mobile/build/app/outputs/flutter-apk/app-release.apk`. Copy it
to the phone (USB, cloud drive, or `adb install -r <file>`), allow installs
from unknown sources if asked, and open it.

Release builds use the debug signing key for now, and plain-HTTP local
servers only work if the app's network policy allows them. Use HTTPS
endpoints before shipping anything for real.

## 7. First launch

- Allow **Camera** (scanning batch QR codes) and **Location** (plots and
  planting records) when asked.
- A phone that has logged in before opens on a **PIN screen**. Use
  "Forgot PIN? Log in with email instead" to sign in again.
- After switching between local and deployed, **log out and log in again**:
  tokens from one environment are rejected by the other
  ("Your session needs refreshing").

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| App says it cannot reach the server | wrong IP, different Wi-Fi, or Mac firewall; repeat the browser check in section 4 |
| `flutter run` says no device | section 2, then `flutter devices` again |
| Build fails with a Gradle lock or timeout | `cd mobile/android && ./gradlew --stop`, then retry |
| QR scan screen is black | grant the Camera permission in the phone's app settings |
| Location never resolves indoors | go near a window or outdoors |

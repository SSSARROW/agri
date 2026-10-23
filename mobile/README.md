# Origo Field (v2)

A ground-up redesign of the Android field app, built **only from `docs/spec/PRODUCT_SPEC_MOBILE.md`** (and the backend's response schemas). It shares no UI code with `mobile/`.

Flutter · same plugin set (Hive, secure storage, geolocator, image_picker, mobile_scanner, qr_flutter, flutter_map, connectivity_plus).

## Run

```bash
cd mobile
flutter pub get
# Emulator talking to servers on your Mac:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000 --dart-define=AUTH_BASE_URL=http://10.0.2.2:8001
# Real phone on the same Wi-Fi:
flutter run --dart-define=API_BASE_URL=http://<mac-ip>:8000 --dart-define=AUTH_BASE_URL=http://<mac-ip>:8001
```

QR labels encode `<API_BASE_URL>/p/<code>`. The app warns on any build that points at a private address, because buyers' phones can't open those labels.

## Structure

```
lib/
  core/    config, theme, formatting, geometry, GPS/camera helpers
  data/    api client (two back-ends), session + PIN, offline queue + sync, repository, models
  ui/
    widgets/   shared components
    screens/   auth · farmer · market · collector · settings
```

**Farmer:** Farm · Batches · Market · Me. **Collector:** one Collection-round screen plus Me.

## Where the design differs from the spec's "current build"

From the spec's gap list (§9):

- Wrong-role accounts (exporter/admin) get an explanation instead of a broken farmer app (gap 1).
- An expired token shows a persistent "Sign in again to sync" banner and a re-auth screen that keeps the queue (gap 2).
- The queue is per-account (no cross-attribution), prunes old synced rows, and server-refused events become **Refused** with a Discard action instead of retrying forever (gap 3).
- PIN entry slows down after five wrong tries (gap 4).
- No Nuwara Eliya defaults: district comes from a picker, and plot registration prefills from the person's own profile (gap 5).
- A batch photo is kept on failure so it never has to be retaken; upload failures are reported (gap 6).
- Weights and counts validate with a visible message instead of failing silently (gap 7).
- The collector's basket is saved on the device; total weight is written to the combined batch; mixed crops ask before combining (gap 11).
- Stage-proof copy tells the farmer that proof photos also appear in the plot's photo history (gap 9).

## Needs backend work (not changed here)

Push notifications, decline reasons reaching farmers, profile editing, an app-side report-ad action.

import 'package:geolocator/geolocator.dart';

class LocationResult {
  final Position? position;
  final String? error;
  LocationResult.ok(this.position) : error = null;
  LocationResult.fail(this.error) : position = null;
}

/// Shared by farm_page.dart (registering a plot at a single pin, recording a
/// planting) and the boundary-walk flow (dropping a pin per corner) — one
/// place for the geolocator workarounds below, rather than duplicating them
/// per call site.
class LocationService {
  /// geolocator_android's plugin calls can hang indefinitely with zero
  /// Android-level symptoms (no ANR — the platform thread itself isn't
  /// blocked, the native async call to Play Services location just never
  /// completes). Every call here gets its own timeout so a bad location
  /// fix, a cold/rebooted device, or the plugin's known NmeaClient.stop()
  /// ANR (baseflow/flutter-geolocator#...) can never leave a caller silently
  /// stuck with no feedback.
  static Future<LocationResult> getCurrentPosition() async {
    LocationPermission permission;
    try {
      permission = await Geolocator.checkPermission().timeout(
        const Duration(seconds: 5),
      );
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission().timeout(
          const Duration(seconds: 30),
        );
      }
    } catch (_) {
      return LocationResult.fail(
        'Could not check location permission. Try again.',
      );
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return LocationResult.fail('Location permission is required.');
    }

    try {
      if (!await Geolocator.isLocationServiceEnabled().timeout(
        const Duration(seconds: 5),
      )) {
        return LocationResult.fail('Turn on location services and try again.');
      }
    } catch (_) {
      return LocationResult.fail(
        'Could not check location services. Try again.',
      );
    }

    // Prefer the cached last-known fix: geolocator_android's getCurrentPosition
    // starts a live GNSS listener and then tears it down, and that teardown
    // (NmeaClient.stop -> LocationManager.removeNmeaListener) is a known
    // upstream ANR — a synchronous Binder call on the main thread that can
    // hang for several seconds. getLastKnownPosition never touches that path.
    //
    // But the cache is only ever refreshed by some other live fix request —
    // it isn't invalidated by the phone moving. Trusting it unconditionally
    // means every call after the first replays the same old fix regardless
    // of where the phone actually is now, which is fatal for a boundary walk
    // (every corner would land on the same coordinates) and for centering the
    // satellite map (it can jump to wherever the phone last got a fix, e.g. a
    // previous session at a different place). Only trust it when it's fresh
    // enough that the OS effectively already has a live fix warmed up.
    try {
      final lastKnown = await Geolocator.getLastKnownPosition(
        forceAndroidLocationManager: true,
      ).timeout(const Duration(seconds: 5));
      if (lastKnown != null &&
          DateTime.now().toUtc().difference(lastKnown.timestamp).abs() <=
              const Duration(seconds: 15)) {
        return LocationResult.ok(lastKnown);
      }
    } catch (_) {
      // Fall through to a live fix below.
    }

    // No cached fix to fall back on — ask for a live one, but never hang the
    // UI indefinitely: no fix at all (weak signal, indoors, this emulator's
    // GPS simulator) must fail loudly rather than leave the caller waiting
    // forever with no feedback.
    //
    // forceLocationManager routes this through the legacy Android
    // LocationManager (raw GPS/network providers) instead of Play Services'
    // FusedLocationProviderClient. Confirmed necessary, not just a testing
    // nicety: on an AVD without certified Play Store services, fused location
    // fails its own backend auth silently (GlsClientGrpc "Application
    // credential header not valid" in logcat) and getCurrentPosition never
    // resolves, timeout or not — the emulator's injected mock location
    // (`adb emu geo fix`) never reaches the caller because fused never gets
    // that far. The legacy provider reads GPS directly and isn't affected.
    // The same failure mode can hit a real device with broken or absent
    // Play Services, which this app — field use in areas that may not have
    // a Google-certified ROM — can't assume won't happen.
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: AndroidSettings(
          forceLocationManager: true,
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      ).timeout(const Duration(seconds: 12));
      return LocationResult.ok(position);
    } catch (_) {
      return LocationResult.fail(
        'Could not get a GPS fix. Move somewhere with a clearer view of the sky and try again.',
      );
    }
  }
}

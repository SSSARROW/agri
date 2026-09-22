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
    try {
      final lastKnown = await Geolocator.getLastKnownPosition().timeout(
        const Duration(seconds: 5),
      );
      if (lastKnown != null) return LocationResult.ok(lastKnown);
    } catch (_) {
      // Fall through to a live fix below.
    }

    // No cached fix to fall back on — ask for a live one, but never hang the
    // UI indefinitely: no fix at all (weak signal, indoors, this emulator's
    // GPS simulator) must fail loudly rather than leave the caller waiting
    // forever with no feedback.
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
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

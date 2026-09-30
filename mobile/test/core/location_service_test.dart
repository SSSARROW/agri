import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geolocator_platform_interface/geolocator_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'package:field/core/location_service.dart';

/// A fake GeolocatorPlatform that reproduces the real-world scenario a
/// farmer hits while walking a plot boundary: the OS has one cached
/// last-known fix that never changes on its own, while each *live* fix
/// (what actually happens when the farmer physically moves and a fresh
/// GPS read is requested) reflects wherever they're standing right now.
class _FakeGeolocatorPlatform extends GeolocatorPlatform
    with MockPlatformInterfaceMixin {
  Position? cachedLastKnown;
  List<Position> liveFixesToReturn = const [];
  int liveFixCalls = 0;

  @override
  Future<LocationPermission> checkPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<LocationPermission> requestPermission() async =>
      LocationPermission.whileInUse;

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<Position?> getLastKnownPosition({
    bool forceLocationManager = false,
  }) async => cachedLastKnown;

  @override
  Future<Position> getCurrentPosition({
    LocationSettings? locationSettings,
  }) async {
    final fix = liveFixesToReturn[liveFixCalls];
    liveFixCalls++;
    return fix;
  }
}

Position _positionAt({
  required double lat,
  required double lon,
  required DateTime timestamp,
}) {
  return Position(
    latitude: lat,
    longitude: lon,
    timestamp: timestamp,
    accuracy: 5,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

void main() {
  late _FakeGeolocatorPlatform fake;

  setUp(() {
    fake = _FakeGeolocatorPlatform();
    GeolocatorPlatform.instance = fake;
  });

  test(
    'boundary walk: a stale cached fix no longer makes every corner '
    'collapse onto the same coordinates',
    () async {
      // The OS has one cached fix from 10 minutes ago at "corner 1" — this
      // never updates on its own, exactly like on a real device where
      // nothing else in the app is requesting live locations in the
      // background.
      fake.cachedLastKnown = _positionAt(
        lat: 6.9500,
        lon: 80.7800,
        timestamp: DateTime.now().toUtc().subtract(const Duration(minutes: 10)),
      );
      // The farmer actually walks to two different corners; each live fix
      // reflects where they are standing when they drop the pin.
      fake.liveFixesToReturn = [
        _positionAt(lat: 6.9501, lon: 80.7801, timestamp: DateTime.now().toUtc()),
        _positionAt(lat: 6.9550, lon: 80.7850, timestamp: DateTime.now().toUtc()),
      ];

      final corner1 = await LocationService.getCurrentPosition();
      final corner2 = await LocationService.getCurrentPosition();

      expect(corner1.position, isNotNull);
      expect(corner2.position, isNotNull);

      // The two corners must be genuinely different readings, not the same
      // stale cached position replayed twice.
      expect(
        corner1.position!.latitude != corner2.position!.latitude ||
            corner1.position!.longitude != corner2.position!.longitude,
        isTrue,
        reason: 'Corner pins collapsed onto identical coordinates — the '
            'stale-cache bug is back.',
      );
      // And neither corner should be the 10-minute-old cached fix.
      expect(corner1.position!.latitude, isNot(6.9500));
      expect(corner2.position!.latitude, isNot(6.9500));
      // Both live fixes were actually requested (no shortcutting via cache).
      expect(fake.liveFixCalls, 2);
    },
  );

  test(
    'a genuinely fresh cached fix (OS already has a live fix warmed up) '
    'is still used instead of triggering another live request',
    () async {
      fake.cachedLastKnown = _positionAt(
        lat: 6.9612,
        lon: 80.7912,
        timestamp: DateTime.now().toUtc().subtract(const Duration(seconds: 3)),
      );
      fake.liveFixesToReturn = [
        _positionAt(lat: 0, lon: 0, timestamp: DateTime.now().toUtc()),
      ];

      final result = await LocationService.getCurrentPosition();

      expect(result.position!.latitude, 6.9612);
      expect(result.position!.longitude, 80.7912);
      expect(fake.liveFixCalls, 0,
          reason: 'A fresh cached fix should short-circuit the ANR-prone '
              'live-fix path, same as before this fix.');
    },
  );

  test('no cached fix at all still falls through to a live fix', () async {
    fake.cachedLastKnown = null;
    fake.liveFixesToReturn = [
      _positionAt(lat: 6.97, lon: 80.79, timestamp: DateTime.now().toUtc()),
    ];

    final result = await LocationService.getCurrentPosition();

    expect(result.position!.latitude, 6.97);
    expect(fake.liveFixCalls, 1);
  });
}

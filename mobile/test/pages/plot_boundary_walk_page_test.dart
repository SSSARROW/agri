import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geolocator_platform_interface/geolocator_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'package:field/pages/plot_boundary_walk_page.dart';

/// Drives the real boundary-walk screen the way a farmer does: tap "Drop
/// pin", walk (a new live GPS fix), tap again. Reproduces the field report
/// that every corner came back with the same coordinates.
class _FakeGeolocatorPlatform extends GeolocatorPlatform
    with MockPlatformInterfaceMixin {
  Position? cachedLastKnown;
  List<Position> liveFixesToReturn = const [];
  int liveFixCalls = 0;

  @override
  Future<LocationPermission> checkPermission() async =>
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

Future<void> _tapDropPin(WidgetTester tester, int cornerNumber) async {
  await tester.tap(find.widgetWithText(ElevatedButton, 'Drop pin (corner $cornerNumber)'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'walking three corners drops three genuinely different pins, not the '
    'same stale coordinates three times',
    (tester) async {
      final fake = _FakeGeolocatorPlatform();
      GeolocatorPlatform.instance = fake;

      // The OS's cached fix is 10 minutes old, from well before the walk
      // started — exactly the state a phone is in after sitting in a
      // farmer's pocket.
      fake.cachedLastKnown = _positionAt(
        lat: 0,
        lon: 0,
        timestamp: DateTime.now().toUtc().subtract(const Duration(minutes: 10)),
      );
      // Three corners of a real ~0.6ha triangle, each a fresh live fix.
      fake.liveFixesToReturn = [
        _positionAt(lat: 6.9500, lon: 80.7800, timestamp: DateTime.now().toUtc()),
        _positionAt(lat: 6.9510, lon: 80.7800, timestamp: DateTime.now().toUtc()),
        _positionAt(lat: 6.9500, lon: 80.7810, timestamp: DateTime.now().toUtc()),
      ];

      await tester.pumpWidget(
        const MaterialApp(
          home: PlotBoundaryWalkPage(district: 'Test District'),
        ),
      );
      expect(find.text('No corners dropped yet.'), findsOneWidget);

      await _tapDropPin(tester, 1);
      await _tapDropPin(tester, 2);
      await _tapDropPin(tester, 3);

      // All three of these must appear — three distinct coordinates, one
      // per corner actually walked.
      expect(find.text('6.95000, 80.78000 (±5m)'), findsOneWidget);
      expect(find.text('6.95100, 80.78000 (±5m)'), findsOneWidget);
      expect(find.text('6.95000, 80.78100 (±5m)'), findsOneWidget);

      // None of them is the stale cached (0, 0) fix.
      expect(find.textContaining('0.00000, 0.00000'), findsNothing);

      // A real ~0.6ha triangle reads as a sane area, not the
      // corners-on-top-of-each-other warning a repeated coordinate would
      // trigger.
      expect(find.textContaining('Estimated area:'), findsOneWidget);
      expect(find.textContaining('almost on top of each other'), findsNothing);

      expect(fake.liveFixCalls, 3);
    },
  );
}

import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'geo.dart';

class Fix {
  final double lat, lon;
  final double accuracyM;
  const Fix(this.lat, this.lon, this.accuracyM);
  LatLon get point => LatLon(lat, lon);
  bool get weak => accuracyM > 50;
}

enum LocationBlock { none, serviceOff, denied, deniedForever }

/// Camera and GPS helpers shared by every evidence-taking screen.
class Device {
  static final _picker = ImagePicker();

  /// Camera only, never the gallery, so photos are evidence taken on the spot.
  static Future<String?> takePhoto() async {
    final f = await _picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 85);
    return f?.path;
  }

  static Future<LocationBlock> locationStatus() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationBlock.serviceOff;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.deniedForever) return LocationBlock.deniedForever;
    if (p == LocationPermission.denied) return LocationBlock.denied;
    return LocationBlock.none;
  }

  static Future<bool> requestPermission() async {
    final p = await Geolocator.requestPermission();
    return p == LocationPermission.always || p == LocationPermission.whileInUse;
  }

  static Future<void> openLocationSettings() => Geolocator.openLocationSettings();
  static Future<void> openAppSettings() => Geolocator.openAppSettings();

  /// A fresh fix or null. Never blocks the caller for more than ~12 seconds.
  static Future<Fix?> tryFix() async {
    try {
      if (await locationStatus() != LocationBlock.none) return null;
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best),
      ).timeout(const Duration(seconds: 12));
      return Fix(p.latitude, p.longitude, p.accuracy);
    } on TimeoutException {
      return null;
    } catch (_) {
      return null;
    }
  }
}

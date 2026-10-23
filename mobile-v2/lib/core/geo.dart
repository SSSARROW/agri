import 'dart:math' as math;

class LatLon {
  final double lat;
  final double lon;
  const LatLon(this.lat, this.lon);
  Map<String, double> toJson() => {'lat': lat, 'lon': lon};
}

/// Plot area in hectares from boundary corners. Uses a local equirectangular
/// projection, which is accurate to well under 1% at plot scale. The server
/// recomputes the canonical value.
double polygonAreaHa(List<LatLon> pts) {
  if (pts.length < 3) return 0;
  final lat0 = pts.map((p) => p.lat).reduce((a, b) => a + b) / pts.length;
  const r = 6371008.8;
  final kx = r * math.cos(lat0 * math.pi / 180) * math.pi / 180;
  const ky = r * math.pi / 180;
  final xy = pts.map((p) => [p.lon * kx, p.lat * ky]).toList();
  var sum = 0.0;
  for (var i = 0; i < xy.length; i++) {
    final a = xy[i];
    final b = xy[(i + 1) % xy.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum.abs() / 2 / 10000;
}

double distanceM(LatLon a, LatLon b) {
  const r = 6371008.8;
  final dLat = (b.lat - a.lat) * math.pi / 180;
  final dLon = (b.lon - a.lon) * math.pi / 180;
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(a.lat * math.pi / 180) * math.cos(b.lat * math.pi / 180) * math.pow(math.sin(dLon / 2), 2);
  return 2 * r * math.asin(math.sqrt(h));
}

/// Largest distance between any two pins, to detect "I never moved between corners".
double maxSpreadM(List<LatLon> pts) {
  var m = 0.0;
  for (var i = 0; i < pts.length; i++) {
    for (var j = i + 1; j < pts.length; j++) {
      m = math.max(m, distanceM(pts[i], pts[j]));
    }
  }
  return m;
}

const walkedMinHa = 0.005;
const tracedMinHa = 0.0005;

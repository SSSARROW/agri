import 'dart:math';

/// Shoelace formula on an equirectangular projection centred at the mean
/// latitude — the same calculation the server does (app/core/geo.py's
/// make_polygon_from_points), kept identical on purpose so a preview here
/// never disagrees with what gets stored. Accurate enough at plot scale.
double polygonAreaHa(List<(double lat, double lon)> points) {
  if (points.length < 3) return 0;
  final meanLat =
      points.map((p) => p.$1).reduce((a, b) => a + b) / points.length;
  const mPerDegLat = 111320.0;
  final mPerDegLon = 111320.0 * cos(meanLat * pi / 180).abs();
  final xy = points.map((p) => (p.$2 * mPerDegLon, p.$1 * mPerDegLat)).toList();
  double area = 0;
  for (var i = 0; i < xy.length; i++) {
    final (x1, y1) = xy[i];
    final (x2, y2) = xy[(i + 1) % xy.length];
    area += x1 * y2 - x2 * y1;
  }
  return area.abs() / 2 / 10000;
}

/// Areas under 0.01 ha (100 m²) read as "0.00 ha" — show those in square
/// metres so a small greenhouse or a rooftop bed still has a meaningful size.
String formatArea(double? ha) {
  if (ha == null) return '?';
  if (ha < 0.01) return '${(ha * 10000).round()} m²';
  return '${ha.toStringAsFixed(ha < 1 ? 3 : 2)} ha';
}

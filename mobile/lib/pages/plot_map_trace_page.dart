import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/location_service.dart';
import '../core/plot_area.dart';

/// Smallest area a traced boundary may have (5 m²) — matches the server's
/// minimum for "traced" plots (api plots.py).
const kMinTracedAreaHa = 0.0005;

/// Trace a plot's boundary by tapping its corners on satellite imagery.
/// Pops with the corners as a list of [LatLng], or null if cancelled.
///
/// For plots too small for GPS to resolve (a few metres across, where phone
/// GPS error is as big as the plot) or that can't be walked, this is the
/// precise option: corners are placed on the imagery itself, so there's no
/// GPS jitter — precision is limited only by the imagery's resolution.
class PlotMapTracePage extends StatefulWidget {
  const PlotMapTracePage({super.key});

  @override
  State<PlotMapTracePage> createState() => _PlotMapTracePageState();
}

class _PlotMapTracePageState extends State<PlotMapTracePage> {
  // Nuwara Eliya — used only until (and unless) a GPS fix arrives.
  static const _fallbackCenter = LatLng(6.9497, 80.7891);
  static const _tileUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  final MapController _map = MapController();
  final List<LatLng> _corners = [];
  LatLng? _me;
  bool _userMovedMap = false;

  @override
  void initState() {
    super.initState();
    _locate();
  }

  Future<void> _locate() async {
    final result = await LocationService.getCurrentPosition();
    if (!mounted || result.position == null) return;
    final here = LatLng(result.position!.latitude, result.position!.longitude);
    setState(() => _me = here);
    if (!_userMovedMap) _map.move(here, 18);
  }

  double get _areaHa =>
      polygonAreaHa(_corners.map((c) => (c.latitude, c.longitude)).toList());

  bool get _tooSmall => _corners.length >= 3 && _areaHa < kMinTracedAreaHa;
  bool get _canFinish => _corners.length >= 3 && !_tooSmall;

  String get _hint {
    if (_corners.isEmpty) {
      return 'Zoom in until you can see your plot, then tap each corner.';
    }
    if (_corners.length < 3) {
      return 'Tap ${3 - _corners.length} more corner${_corners.length == 2 ? '' : 's'}.';
    }
    if (_tooSmall) {
      return 'These corners are almost on top of each other. Zoom in and tap the real corners of the plot.';
    }
    return 'Estimated area: ${formatArea(_areaHa)}. Tap more corners for a more accurate shape.';
  }

  @override
  Widget build(BuildContext context) {
    final points = List<LatLng>.of(_corners);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trace on satellite map'),
        actions: [
          IconButton(
            icon: const Icon(Icons.undo),
            tooltip: 'Undo last corner',
            onPressed: _corners.isEmpty
                ? null
                : () => setState(() => _corners.removeLast()),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: _fallbackCenter,
                    initialZoom: 15,
                    maxZoom: 21,
                    onPositionChanged: (_, hasGesture) {
                      if (hasGesture) _userMovedMap = true;
                    },
                    onTap: (_, point) => setState(() => _corners.add(point)),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: _tileUrl,
                      userAgentPackageName: 'com.agri.field',
                      maxNativeZoom: 19,
                    ),
                    if (points.length >= 3)
                      PolygonLayer(
                        polygons: [
                          Polygon(
                            points: points,
                            color: const Color(0x4D1B5E20),
                            borderColor: const Color(0xFFFFEB3B),
                            borderStrokeWidth: 2.5,
                          ),
                        ],
                      )
                    else if (points.length == 2)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: points,
                            color: const Color(0xFFFFEB3B),
                            strokeWidth: 2.5,
                          ),
                        ],
                      ),
                    MarkerLayer(
                      markers: [
                        if (_me != null)
                          Marker(
                            point: _me!,
                            width: 18,
                            height: 18,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.blue,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                        for (var i = 0; i < points.length; i++)
                          Marker(
                            point: points[i],
                            width: 26,
                            height: 26,
                            child: Container(
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFF1B5E20),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2,
                                ),
                              ),
                              child: Text(
                                '${i + 1}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
                const Positioned(
                  left: 8,
                  bottom: 6,
                  child: Text(
                    'Imagery © Esri, Maxar, Earthstar Geographics',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      shadows: [Shadow(blurRadius: 3)],
                    ),
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _hint,
                    style: TextStyle(
                      color: _tooSmall
                          ? const Color(0xFF9A6B00)
                          : Colors.black87,
                      fontWeight: _tooSmall
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _canFinish
                        ? () => Navigator.of(context).pop(_corners)
                        : null,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 52),
                    ),
                    child: const Text(
                      'Use this boundary',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

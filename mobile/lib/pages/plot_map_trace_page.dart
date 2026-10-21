import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/location_service.dart';
import '../core/plot_area.dart';
import '../theme/app_colors.dart';
import '../widgets/location_required_gate.dart';

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
  bool _locating = true;

  // Satellite imagery over a mobile connection can take several seconds to
  // paint — shown as a blank gray box otherwise, which is exactly what made
  // this screen confusing to begin with. This flag drives a loading overlay
  // that's dismissed once tiles have had a reasonable chance to arrive, or
  // as soon as the farmer starts interacting with the map themselves.
  bool _tilesSettling = true;

  // Both of these start only once LocationRequiredGate lets this page
  // through, not in initState - that runs before the gate has shown its
  // explanation, so starting _locate() there would fire the system GPS
  // permission prompt before the farmer knows why. The tile-settling timer
  // moves with it so "loading imagery" counts from when the map is first
  // actually visible, not from a mount the farmer may not have seen yet.
  void _onGateReady() {
    _locate();
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _tilesSettling = false);
    });
  }

  // `force` skips the "don't fight a map the farmer already panned" guard —
  // used when they explicitly tap the recenter button, as opposed to the
  // one-time automatic fix on first opening this screen.
  Future<void> _locate({bool force = false}) async {
    setState(() => _locating = true);
    final result = await LocationService.getCurrentPosition();
    if (!mounted) return;
    setState(() => _locating = false);
    if (result.position == null) return;
    final here = LatLng(result.position!.latitude, result.position!.longitude);
    setState(() => _me = here);
    if (force || !_userMovedMap) _map.move(here, 17);
  }

  void _recenter() {
    _userMovedMap = false;
    if (_me != null) {
      _map.move(_me!, 17);
    } else {
      _locate(force: true);
    }
  }

  void _zoomBy(double delta) {
    _map.move(_map.camera.center, (_map.camera.zoom + delta).clamp(1, 21));
  }

  void _dismissLoadingOverlay() {
    if (_tilesSettling) setState(() => _tilesSettling = false);
  }

  void _showLegend() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'How to trace your plot',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
            const SizedBox(height: 14),
            _legendRow(
              child: Container(
                width: 16,
                height: 16,
                decoration: const BoxDecoration(
                  color: Colors.blue,
                  shape: BoxShape.circle,
                ),
              ),
              text: 'Your current location',
            ),
            _legendRow(
              child: Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Text(
                  '1',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              text: 'A corner you\'ve tapped, in order',
            ),
            _legendRow(
              child: Container(
                width: 22,
                height: 14,
                decoration: BoxDecoration(
                  border: Border.all(
                    color: const Color(0xFFFFEB3B),
                    width: 2.5,
                  ),
                ),
              ),
              text: 'The boundary traced so far',
            ),
            const SizedBox(height: 10),
            const Text(
              'Pinch to zoom, or use the + / − buttons. Zoom in close '
              'enough to make out your plot\'s edges before tapping its '
              'corners — the closer you are, the more accurate the '
              'boundary.',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendRow({required Widget child, required String text}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(width: 26, child: Center(child: child)),
          const SizedBox(width: 14),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }

  double get _areaHa =>
      polygonAreaHa(_corners.map((c) => (c.latitude, c.longitude)).toList());

  bool get _tooSmall => _corners.length >= 3 && _areaHa < kMinTracedAreaHa;
  bool get _canFinish => _corners.length >= 3 && !_tooSmall;

  String get _hint {
    if (_corners.isEmpty) {
      return 'Zoom in until you can see your plot, then tap each corner. '
          'Tap ⓘ above for help telling pins apart.';
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
    return LocationRequiredGate(
      onReady: _onGateReady,
      child: _buildScaffold(context),
    );
  }

  Widget _buildScaffold(BuildContext context) {
    final points = List<LatLng>.of(_corners);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trace on satellite map'),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline),
            tooltip: 'How this works',
            onPressed: _showLegend,
          ),
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
                    initialZoom: 16,
                    maxZoom: 21,
                    onPositionChanged: (_, hasGesture) {
                      if (hasGesture) {
                        _userMovedMap = true;
                        _dismissLoadingOverlay();
                      }
                    },
                    onTap: (_, point) {
                      _dismissLoadingOverlay();
                      setState(() => _corners.add(point));
                    },
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
                                color: AppColors.primary,
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
                // Zoom + recenter controls — pinch-to-zoom still works, but
                // these make both actions discoverable and precise without
                // hunting for a two-finger gesture on a small plot.
                Positioned(
                  right: 10,
                  bottom: 16,
                  child: Column(
                    children: [
                      _MapButton(
                        icon: Icons.add,
                        tooltip: 'Zoom in',
                        onPressed: () => _zoomBy(1),
                      ),
                      const SizedBox(height: 8),
                      _MapButton(
                        icon: Icons.remove,
                        tooltip: 'Zoom out',
                        onPressed: () => _zoomBy(-1),
                      ),
                      const SizedBox(height: 16),
                      _MapButton(
                        icon: Icons.my_location,
                        tooltip: 'Center on my location',
                        onPressed: _recenter,
                        busy: _locating,
                      ),
                    ],
                  ),
                ),
                // Blank-gray-box confusion was the actual complaint this
                // screen got — a visible "it's working, hang on" beats
                // silently waiting on third-party tiles to arrive.
                if (_tilesSettling)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.35),
                        child: const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(color: Colors.white),
                              SizedBox(height: 14),
                              Text(
                                'Loading satellite imagery…',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'This can take a few seconds on a slow connection.',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
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
                      color: _tooSmall ? AppColors.warning : Colors.black87,
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

/// A small circular button floating over the map — same purpose as Google
/// Maps' own zoom/recenter controls, styled to sit on satellite imagery of
/// any color underneath it.
class _MapButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final bool busy;

  const _MapButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: busy ? null : onPressed,
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 42,
            height: 42,
            child: busy
                ? const Padding(
                    padding: EdgeInsets.all(11),
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(icon, color: Colors.black87, size: 22),
          ),
        ),
      ),
    );
  }
}

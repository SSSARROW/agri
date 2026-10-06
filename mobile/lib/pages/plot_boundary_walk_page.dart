import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../core/farm_service.dart';
import '../core/location_service.dart';
import '../core/photo_capture.dart';
import '../core/plot_area.dart';
import '../theme/app_colors.dart';
import 'plot_map_trace_page.dart';

class _CornerPin {
  final double lat;
  final double lon;
  final double accuracy;
  _CornerPin(this.lat, this.lon, this.accuracy);
}

/// A real surveyed plot boundary: the farmer walks the edge of their
/// plot and drops a pin at each corner — or, when walking isn't practical
/// or the plot is too small for GPS to resolve, traces it on satellite
/// imagery instead (see PlotMapTracePage). There's deliberately no "type
/// an approximate size" option: an untouched default became the plot's
/// recorded area. Area shown here is a live client-side estimate for the
/// farmer's own sanity check — the server computes the canonical figure
/// with the same formula from the submitted points.
class PlotBoundaryWalkPage extends StatefulWidget {
  final String district;
  final String? dsd;
  final String? gnDivision;
  final String plotType;
  final String? name;
  const PlotBoundaryWalkPage({
    super.key,
    required this.district,
    this.dsd,
    this.gnDivision,
    this.plotType = 'open_field',
    this.name,
  });

  @override
  State<PlotBoundaryWalkPage> createState() => _PlotBoundaryWalkPageState();
}

class _PlotBoundaryWalkPageState extends State<PlotBoundaryWalkPage> {
  final List<_CornerPin> _pins = [];
  bool _dropping = false;
  bool _submitting = false;

  // 'walked' = GPS pins dropped in the field; 'traced' = corners tapped on
  // satellite imagery. Stored on the plot, since it's different evidence.
  String _source = 'walked';

  double get _areaHa =>
      polygonAreaHa(_pins.map((p) => (p.lat, p.lon)).toList());

  Future<void> _dropPin() async {
    if (_source == 'traced') {
      // Walking corners after tracing starts over rather than mixing the two.
      setState(() {
        _pins.clear();
        _source = 'walked';
      });
    }
    setState(() => _dropping = true);
    final result = await LocationService.getCurrentPosition();
    if (!mounted) return;
    setState(() => _dropping = false);
    if (result.position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Could not get a GPS fix.')),
      );
      return;
    }
    setState(() {
      _pins.add(
        _CornerPin(
          result.position!.latitude,
          result.position!.longitude,
          result.position!.accuracy,
        ),
      );
    });
  }

  void _undoLast() {
    if (_pins.isEmpty) return;
    setState(() => _pins.removeLast());
  }

  // A geotagged photo of the plot itself — the closest thing to independent
  // evidence a boundary walk or a square estimate has behind it. Mandatory:
  // the plot record is already saved by the time this runs, but the farmer
  // can't move on from this screen without a photo backing it up. Loops
  // rather than blocking forever on one failed attempt — a cancelled camera
  // or a dropped upload just means "try again," not "stuck."
  Future<void> _requirePlotPhoto(String plotId) async {
    while (mounted) {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('Photo required'),
          content: const Text(
            'A photo of the plot is required to finish registering it.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Take photo'),
            ),
          ],
        ),
      );
      if (!mounted) return;

      // Captured alongside the photo, not required for it — a missing GPS
      // fix (M-06) never blocks the mandatory photo itself.
      final positionFuture = LocationService.getCurrentPosition();
      final file = await PhotoCapture.takePhoto();
      if (!mounted) return;
      if (file == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('A photo is required — try again.')),
        );
        continue;
      }

      final position = (await positionFuture).position;
      final result = await FarmService.uploadPlotPhoto(
        plotId: plotId,
        eventType: 'plot_photo',
        imageFile: file,
        lat: position?.latitude,
        lon: position?.longitude,
      );
      if (!mounted) return;
      if (result.isOk) {
        final message = result.data!.locationFlagged
            ? 'Photo uploaded — but it was taken '
                  '${result.data!.distanceFromPlotM!.round()}m from this plot.'
            : 'Photo uploaded.';
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not upload photo: ${result.error} — try again.'),
        ),
      );
    }
  }

  // Matches the server's minimum (api plots.py) — below this the pins can't
  // really have been dropped at separate corners.
  double get _minAreaHa => _source == 'traced' ? kMinTracedAreaHa : 0.005;
  bool get _tooSmall => _pins.length >= 3 && _areaHa < _minAreaHa;

  Future<void> _finish() async {
    if (_pins.length < 3 || _tooSmall) return;
    setState(() => _submitting = true);
    final result = await FarmService.registerPlotWalked(
      boundaryPoints: _pins.map((p) => {'lat': p.lat, 'lon': p.lon}).toList(),
      district: widget.district,
      dsd: widget.dsd,
      gnDivision: widget.gnDivision,
      plotType: widget.plotType,
      name: widget.name,
      boundarySource: _source,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (!result.isOk) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not register plot: ${result.error}')),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Plot registered — ${formatArea(_areaHa)} from a ${_source == 'traced' ? 'traced' : 'walked'} boundary.',
        ),
      ),
    );
    await _requirePlotPhoto(result.data!.id);
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  Future<void> _traceOnMap() async {
    final corners = await Navigator.of(context).push<List<LatLng>>(
      MaterialPageRoute(builder: (_) => const PlotMapTracePage()),
    );
    if (corners == null || !mounted) return;
    setState(() {
      _pins
        ..clear()
        ..addAll(corners.map((c) => _CornerPin(c.latitude, c.longitude, 0)));
      _source = 'traced';
    });
    await _finish();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Walk the plot boundary')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Stand at each corner of the plot in turn and drop a pin there. '
                'At least 3 corners are needed; more corners means a more '
                'accurate shape.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(0, 48),
                      ),
                      onPressed: (_dropping || _submitting) ? null : _dropPin,
                      icon: _dropping
                          ? const SizedBox(
                              height: 16,
                              width: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.add_location_alt_outlined),
                      label: Text('Drop pin (corner ${_pins.length + 1})'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _pins.isEmpty ? null : _undoLast,
                    icon: const Icon(Icons.undo),
                    tooltip: 'Undo last pin',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_pins.length >= 3)
                Card(
                  color: _tooSmall ? AppColors.warningBg : AppColors.successBg,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text(
                      _tooSmall
                          ? 'These corners are almost on top of each other (${formatArea(_areaHa)}). Walk to each corner of the plot before dropping its pin.'
                          : 'Estimated area: ${formatArea(_areaHa)}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              Expanded(
                child: _pins.isEmpty
                    ? Center(
                        child: Text(
                          'No corners dropped yet.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      )
                    : ListView.separated(
                        itemCount: _pins.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final pin = _pins[i];
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Corner ${i + 1}'),
                                  Text(
                                    '${pin.lat.toStringAsFixed(5)}, ${pin.lon.toStringAsFixed(5)} (±${pin.accuracy.round()}m)',
                                    style: const TextStyle(
                                      color: Colors.black54,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: (_pins.length < 3 || _tooSmall || _submitting)
                    ? null
                    : _finish,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Finish and register plot',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
              ),
              const SizedBox(height: 8),
              Center(
                child: TextButton.icon(
                  onPressed: _submitting ? null : _traceOnMap,
                  icon: const Icon(Icons.satellite_alt_outlined, size: 18),
                  label: const Text('Trace it on a satellite map instead'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

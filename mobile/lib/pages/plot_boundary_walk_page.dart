import 'dart:math';

import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../core/location_service.dart';

class _CornerPin {
  final double lat;
  final double lon;
  final double accuracy;
  _CornerPin(this.lat, this.lon, this.accuracy);
}

/// A real surveyed plot boundary: the farmer walks the edge of their
/// plot and drops a pin at each corner, rather than us approximating a
/// square around one dropped pin (see the "quick estimate" fallback below,
/// for when walking genuinely isn't practical). Area shown here is a live
/// client-side estimate for the farmer's own sanity check — the server
/// computes the canonical figure with the same formula from the submitted
/// points.
class PlotBoundaryWalkPage extends StatefulWidget {
  final String district;
  final String? dsd;
  final String? gnDivision;
  const PlotBoundaryWalkPage({
    super.key,
    required this.district,
    this.dsd,
    this.gnDivision,
  });

  @override
  State<PlotBoundaryWalkPage> createState() => _PlotBoundaryWalkPageState();
}

class _PlotBoundaryWalkPageState extends State<PlotBoundaryWalkPage> {
  final List<_CornerPin> _pins = [];
  bool _dropping = false;
  bool _submitting = false;

  // Same shoelace-on-equirectangular-projection formula the server uses
  // (app/core/geo.py's make_polygon_from_points) — kept in sync deliberately
  // so this preview never disagrees with what gets stored.
  double get _areaHa {
    if (_pins.length < 3) return 0;
    final meanLat =
        _pins.map((p) => p.lat).reduce((a, b) => a + b) / _pins.length;
    const mPerDegLat = 111320.0;
    final mPerDegLon = 111320.0 * cos(meanLat * pi / 180).abs();
    final xy = _pins
        .map((p) => (p.lon * mPerDegLon, p.lat * mPerDegLat))
        .toList();
    double area = 0;
    for (var i = 0; i < xy.length; i++) {
      final (x1, y1) = xy[i];
      final (x2, y2) = xy[(i + 1) % xy.length];
      area += x1 * y2 - x2 * y1;
    }
    return area.abs() / 2 / 10000;
  }

  Future<void> _dropPin() async {
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

  Future<void> _finish() async {
    if (_pins.length < 3) return;
    setState(() => _submitting = true);
    final result = await FarmService.registerPlotWalked(
      boundaryPoints: _pins.map((p) => {'lat': p.lat, 'lon': p.lon}).toList(),
      district: widget.district,
      dsd: widget.dsd,
      gnDivision: widget.gnDivision,
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
          'Plot registered — ${_areaHa.toStringAsFixed(3)} ha from a walked boundary.',
        ),
      ),
    );
    Navigator.of(context).pop(true);
  }

  Future<void> _useQuickEstimateInstead() async {
    final result = await LocationService.getCurrentPosition();
    if (!mounted) return;
    if (result.position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Could not get a GPS fix.')),
      );
      return;
    }
    final position = result.position!;
    final sideController = TextEditingController(text: '50');
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Quick estimate',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            const Text(
              "This records a square around your current position instead of "
              "a real boundary — less precise, and marked as an estimate.",
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: sideController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Approximate plot size (side length, metres)',
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B5E20),
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 48),
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Register estimate'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    final result2 = await FarmService.registerPlot(
      centerLat: position.latitude,
      centerLon: position.longitude,
      sideM: double.tryParse(sideController.text) ?? 50,
      district: widget.district,
      dsd: widget.dsd,
      gnDivision: widget.gnDivision,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (!result2.isOk) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not register plot: ${result2.error}')),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Plot registered as an estimate.')),
    );
    Navigator.of(context).pop(true);
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
              const Text(
                'Stand at each corner of the plot in turn and drop a pin there. '
                'At least 3 corners are needed; more corners means a more '
                'accurate shape.',
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1B5E20),
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
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF7EE),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Estimated area: ${_areaHa.toStringAsFixed(3)} ha',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              const SizedBox(height: 12),
              Expanded(
                child: _pins.isEmpty
                    ? const Center(
                        child: Text(
                          'No corners dropped yet.',
                          style: TextStyle(color: Colors.black54),
                        ),
                      )
                    : ListView.separated(
                        itemCount: _pins.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final pin = _pins[i];
                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF5F5F5),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                          );
                        },
                      ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B5E20),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: (_pins.length < 3 || _submitting) ? null : _finish,
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
                child: TextButton(
                  onPressed: _submitting ? null : _useQuickEstimateInstead,
                  child: const Text(
                    "Can't walk the plot? Use a quick estimate",
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

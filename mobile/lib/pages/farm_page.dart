import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';

import '../core/auth_service.dart';
import '../core/event_queue.dart';
import '../core/farm_service.dart';
import '../core/sync_service.dart';
import '../models/plot.dart';

class FarmPage extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const FarmPage({super.key, required this.onLoggedOut});

  @override
  State<FarmPage> createState() => _FarmPageState();
}

class _FarmPageState extends State<FarmPage> {
  List<Plot>? _plots;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await FarmService.myPlots();
    if (!mounted) return;
    if (!result.isOk && (result.error ?? '').startsWith('HTTP 401')) {
      await AuthService.instance.logout();
      widget.onLoggedOut();
      return;
    }
    setState(() {
      if (result.isOk) {
        _plots = result.data;
        _error = null;
      } else {
        _plots = [];
        _error = result.error;
      }
    });
  }

  void _showSnack(BuildContext context, String message) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  /// geolocator_android's plugin calls can hang indefinitely with zero
  /// Android-level symptoms (no ANR — the platform thread itself isn't
  /// blocked, the native async call to Play Services location just never
  /// completes). Every call here gets its own timeout so a bad location
  /// fix, a cold/rebooted device, or the plugin's known NmeaClient.stop()
  /// ANR (baseflow/flutter-geolocator#...) can never leave this button
  /// silently stuck with no feedback.
  Future<Position?> _getCurrentPosition(BuildContext context) async {
    LocationPermission permission;
    try {
      permission = await Geolocator.checkPermission().timeout(const Duration(seconds: 5));
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission().timeout(const Duration(seconds: 30));
      }
    } catch (_) {
      _showSnack(context, 'Could not check location permission. Try again.');
      return null;
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      _showSnack(context, 'Location permission is required to register a plot.');
      return null;
    }

    try {
      if (!await Geolocator.isLocationServiceEnabled().timeout(const Duration(seconds: 5))) {
        _showSnack(context, 'Turn on location services to register a plot.');
        return null;
      }
    } catch (_) {
      _showSnack(context, 'Could not check location services. Try again.');
      return null;
    }

    // Prefer the cached last-known fix: geolocator_android's getCurrentPosition
    // starts a live GNSS listener and then tears it down, and that teardown
    // (NmeaClient.stop -> LocationManager.removeNmeaListener) is a known
    // upstream ANR — a synchronous Binder call on the main thread that can
    // hang for several seconds. getLastKnownPosition never touches that path.
    try {
      final lastKnown = await Geolocator.getLastKnownPosition().timeout(const Duration(seconds: 5));
      if (lastKnown != null) return lastKnown;
    } catch (_) {
      // Fall through to a live fix below.
    }

    // No cached fix to fall back on — ask for a live one, but never hang the
    // UI indefinitely: no fix at all (weak signal, indoors, this emulator's
    // GPS simulator) must fail loudly rather than leave the button spinning
    // forever with no feedback.
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 10)),
      ).timeout(const Duration(seconds: 12));
    } catch (_) {
      _showSnack(context, 'Could not get a GPS fix. Move somewhere with a clearer view of the sky and try again.');
      return null;
    }
  }

  Future<void> _registerPlot() async {
    final position = await _getCurrentPosition(context);
    if (!mounted || position == null) return;

    final sideController = TextEditingController(text: '50');
    final districtController = TextEditingController(text: 'Nuwara Eliya');
    final dsdController = TextEditingController(text: 'Nuwara Eliya DSD');
    final gnController = TextEditingController(text: 'Kandapola');

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
            Text('Register plot at current location', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              '${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}',
              style: const TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: sideController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Approximate plot size (side length, metres)'),
            ),
            const SizedBox(height: 12),
            TextField(controller: districtController, decoration: const InputDecoration(labelText: 'District')),
            const SizedBox(height: 12),
            TextField(controller: dsdController, decoration: const InputDecoration(labelText: 'DSD')),
            const SizedBox(height: 12),
            TextField(controller: gnController, decoration: const InputDecoration(labelText: 'GN Division')),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B5E20),
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 48),
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Register'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true) return;

    final result = await FarmService.registerPlot(
      centerLat: position.latitude,
      centerLon: position.longitude,
      sideM: double.tryParse(sideController.text) ?? 50,
      district: districtController.text.trim(),
      dsd: dsdController.text.trim(),
      gnDivision: gnController.text.trim(),
    );
    if (!mounted) return;
    if (result.isOk) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Plot registered.')));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: ${result.error}')));
    }
  }

  // Above this accuracy (metres), warn the farmer rather than silently
  // recording a fix that's not trustworthy at plot scale (M-06).
  static const _poorAccuracyMeters = 50.0;

  Future<void> _recordPlanting(Plot plot) async {
    // Kick off location capture in the background while the farmer is still
    // filling in the dialog, so it's usually already resolved by the time
    // they hit Save instead of adding its own visible wait afterward.
    final positionFuture = _getCurrentPosition(context);

    final cropController = TextEditingController(text: 'Tea');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Record planting'),
        content: TextField(
          controller: cropController,
          decoration: const InputDecoration(labelText: 'Crop'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
        ],
      ),
    );
    if (confirmed != true) return;

    // GPS is supplementary provenance data here, not a requirement — a
    // planting record must still save even with no fix (indoors, permission
    // denied, this emulator's flaky GPS simulator, etc).
    final position = await positionFuture;
    final payload = <String, dynamic>{'crop': cropController.text.trim()};
    if (position != null) {
      payload['lat'] = position.latitude;
      payload['lon'] = position.longitude;
      payload['accuracy_m'] = position.accuracy;
    }

    await EventQueue.add(
      eventType: 'planted',
      payload: payload,
      userId: AuthService.instance.userId,
      plotId: plot.id,
    );
    SyncService.instance.syncNow();
    if (!mounted) return;

    final message = position == null
        ? 'Planting recorded (no GPS fix) — queued for sync.'
        : position.accuracy > _poorAccuracyMeters
            ? 'Planting recorded — queued for sync. GPS accuracy was low (±${position.accuracy.round()}m).'
            : 'Planting recorded — queued for sync.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _registerBatch(Plot plot) async {
    final cropController = TextEditingController(text: 'Tea');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Register a batch'),
        content: TextField(
          controller: cropController,
          decoration: const InputDecoration(labelText: 'Crop'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Register')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    // Unlike a planting record, a batch code is issued by the server — it
    // can't be queued offline the way events can, since there's nothing
    // meaningful to show the farmer until the server hands back a real code.
    final result = await FarmService.createBatch(plotId: plot.id, crop: cropController.text.trim());
    if (!mounted) return;

    if (!result.isOk || result.data == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: ${result.error}')));
      return;
    }

    final code = result.data!.code;
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Batch registered'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Give this code to your collector, or write it on the batch:'),
            const SizedBox(height: 16),
            Center(
              child: Text(
                code,
                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, letterSpacing: 4),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: code));
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code copied.')));
            },
            child: const Text('Copy'),
          ),
          ElevatedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('My Farm', style: Theme.of(context).textTheme.headlineMedium),
                IconButton(
                  icon: const Icon(Icons.logout),
                  onPressed: () async {
                    await AuthService.instance.logout();
                    widget.onLoggedOut();
                  },
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text('Your registered plots.', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B5E20),
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _registerPlot,
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text('Register a plot here', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),
            if (_error != null) Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C))),
            Expanded(
              child: _plots == null
                  ? const Center(child: CircularProgressIndicator())
                  : _plots!.isEmpty
                      ? const Center(child: Text('No plots yet.', style: TextStyle(color: Colors.black54)))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            itemCount: _plots!.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              final plot = _plots![i];
                              return Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF5F5F5),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${plot.district ?? 'Unknown district'} · ${plot.gnDivision ?? ''}',
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${plot.areaHa?.toStringAsFixed(3) ?? '?'} ha · '
                                      '${plot.centerLat.toStringAsFixed(4)}, ${plot.centerLon.toStringAsFixed(4)}',
                                      style: const TextStyle(color: Colors.black54, fontSize: 13),
                                    ),
                                    const SizedBox(height: 10),
                                    Wrap(
                                      alignment: WrapAlignment.end,
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        OutlinedButton.icon(
                                          onPressed: () => _recordPlanting(plot),
                                          icon: const Icon(Icons.eco_outlined, size: 18),
                                          label: const Text('Record planting'),
                                        ),
                                        OutlinedButton.icon(
                                          onPressed: () => _registerBatch(plot),
                                          icon: const Icon(Icons.inventory_2_outlined, size: 18),
                                          label: const Text('Register batch'),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

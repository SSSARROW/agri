import 'package:flutter/material.dart';
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
    setState(() {
      if (result.isOk) {
        _plots = result.data;
        _error = null;
      } else {
        _error = result.error;
      }
    });
  }

  Future<Position?> _getCurrentPosition(BuildContext context) async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission is required to register a plot.')),
        );
      }
      return null;
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Turn on location services to register a plot.')),
        );
      }
      return null;
    }
    return Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
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

  Future<void> _recordPlanting(Plot plot) async {
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

    await EventQueue.add(
      eventType: 'planted',
      payload: {'crop': cropController.text.trim()},
      userId: AuthService.instance.userId,
      plotId: plot.id,
    );
    SyncService.instance.syncNow();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Planting recorded — queued for sync.')),
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
                                    Align(
                                      alignment: Alignment.centerRight,
                                      child: OutlinedButton.icon(
                                        onPressed: () => _recordPlanting(plot),
                                        icon: const Icon(Icons.eco_outlined, size: 18),
                                        label: const Text('Record planting'),
                                      ),
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

import 'package:flutter/material.dart';

import '../core/auth_service.dart';
import '../core/event_queue.dart';
import '../core/farm_service.dart';
import '../core/location_service.dart';
import '../core/sync_service.dart';
import '../models/commitment.dart';
import '../models/plot.dart';
import '../models/protocol.dart';
import '../widgets/batch_qr_dialog.dart';
import 'plot_boundary_walk_page.dart';

class FarmPage extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const FarmPage({super.key, required this.onLoggedOut});

  @override
  State<FarmPage> createState() => _FarmPageState();
}

class _FarmPageState extends State<FarmPage> {
  List<Plot>? _plots;
  String? _error;
  List<Commitment>? _commitments;

  @override
  void initState() {
    super.initState();
    _load();
    _loadCommitments();
  }

  // Best-effort and silent on failure — this is informational (what buyers
  // want right now), not core farm data, so it should never show an error
  // banner or block the rest of the page from loading.
  Future<void> _loadCommitments() async {
    final result = await FarmService.openCommitments(crop: 'Tea');
    if (!mounted || !result.isOk) return;
    setState(() => _commitments = result.data);
  }

  Future<void> _load() async {
    final result = await FarmService.myPlots();
    if (!mounted) return;
    // A 401 here means the server won't honor this token right now — not
    // that the farmer is logged out. Forcing a full re-login would defeat
    // the entire point of the PIN unlock (M-07): a device with no signal
    // for days must still open straight into a usable, offline-capable app.
    setState(() {
      if (result.isOk) {
        _plots = result.data;
        _error = null;
      } else {
        _plots = _plots ?? [];
        _error = (result.error ?? '').startsWith('HTTP 401')
            ? 'Your session needs refreshing — reconnect and log in again to sync new plots. Anything already recorded is safe.'
            : result.error;
      }
    });
  }

  String _formatDate(DateTime date) => '${date.day}/${date.month}/${date.year}';

  static const _plotTypeLabels = {
    'open_field': 'Open field',
    'greenhouse': 'Greenhouse',
    'shade_house': 'Shade house',
    'hydroponic': 'Hydroponic',
  };

  Future<void> _registerPlot() async {
    final districtController = TextEditingController(text: 'Nuwara Eliya');
    final dsdController = TextEditingController(text: 'Nuwara Eliya DSD');
    final gnController = TextEditingController(text: 'Kandapola');
    String plotType = 'open_field';

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
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
                'Register a plot',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              const Text(
                "You'll walk the edge of the plot next and drop a pin at each corner.",
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
              const Text(
                'Growing environment',
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
              DropdownButton<String>(
                isExpanded: true,
                value: plotType,
                items: [
                  for (final entry in _plotTypeLabels.entries)
                    DropdownMenuItem(
                      value: entry.key,
                      child: Text(entry.value),
                    ),
                ],
                onChanged: (v) =>
                    setSheetState(() => plotType = v ?? 'open_field'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: districtController,
                decoration: const InputDecoration(labelText: 'District'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dsdController,
                decoration: const InputDecoration(labelText: 'DSD'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: gnController,
                decoration: const InputDecoration(labelText: 'GN Division'),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B5E20),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 48),
                ),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Continue to boundary walk'),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    final registered = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PlotBoundaryWalkPage(
          district: districtController.text.trim(),
          dsd: dsdController.text.trim(),
          gnDivision: gnController.text.trim(),
          plotType: plotType,
        ),
      ),
    );
    if (registered == true) await _load();
  }

  // Above this accuracy (metres), warn the farmer rather than silently
  // recording a fix that's not trustworthy at plot scale (M-06).
  static const _poorAccuracyMeters = 50.0;

  Future<void> _recordPlanting(Plot plot) async {
    // Kick off location capture in the background while the farmer is still
    // filling in the dialog, so it's usually already resolved by the time
    // they hit Save instead of adding its own visible wait afterward.
    final positionFuture = LocationService.getCurrentPosition();

    final cropController = TextEditingController(text: 'Tea');

    // Public endpoint, best-effort — planting still records with no quality
    // standard attached if this fails or nothing's seeded for the crop.
    final protocolsResult = await FarmService.protocolsForCrop(
      cropController.text.trim(),
    );
    final protocols = protocolsResult.isOk
        ? (protocolsResult.data ?? [])
        : <ProtocolSummary>[];
    if (!mounted) return;

    ProtocolSummary? selectedProtocol;
    ProtocolDetail? selectedProtocolDetail;
    bool loadingDetail = false;
    final confirmedSequences = <int>{};

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final allConfirmed =
              selectedProtocol == null ||
              (selectedProtocolDetail != null &&
                  confirmedSequences.length ==
                      selectedProtocolDetail!.stages.length);
          return AlertDialog(
            title: const Text('Record planting'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: cropController,
                    decoration: const InputDecoration(labelText: 'Crop'),
                    autofocus: true,
                  ),
                  if (protocols.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Growing to a quality standard? (optional)',
                      style: TextStyle(color: Colors.black54, fontSize: 13),
                    ),
                    DropdownButton<ProtocolSummary?>(
                      isExpanded: true,
                      value: selectedProtocol,
                      hint: const Text('No specific standard'),
                      items: [
                        const DropdownMenuItem<ProtocolSummary?>(
                          value: null,
                          child: Text('No specific standard'),
                        ),
                        for (final p in protocols)
                          DropdownMenuItem<ProtocolSummary?>(
                            value: p,
                            child: Text(p.name),
                          ),
                      ],
                      onChanged: (p) async {
                        setDialogState(() {
                          selectedProtocol = p;
                          selectedProtocolDetail = null;
                          confirmedSequences.clear();
                          loadingDetail = p != null;
                        });
                        if (p == null) return;
                        final detailResult = await FarmService.protocolDetail(
                          p.id,
                        );
                        setDialogState(() {
                          loadingDetail = false;
                          if (detailResult.isOk) {
                            selectedProtocolDetail = detailResult.data;
                          }
                        });
                      },
                    ),
                  ],
                  if (loadingDetail) ...[
                    const SizedBox(height: 16),
                    const Center(child: CircularProgressIndicator()),
                  ],
                  if (selectedProtocolDetail != null) ...[
                    const SizedBox(height: 12),
                    const Text(
                      "Confirm you'll follow every requirement below — this "
                      "is what the batch will be checked against later.",
                      style: TextStyle(
                        color: Colors.black54,
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    for (final stage in selectedProtocolDetail!.stages)
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                        title: Text(
                          stage.title,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text(
                          stage.instructions,
                          style: const TextStyle(fontSize: 12),
                        ),
                        value: confirmedSequences.contains(stage.sequence),
                        onChanged: (checked) => setDialogState(() {
                          if (checked == true) {
                            confirmedSequences.add(stage.sequence);
                          } else {
                            confirmedSequences.remove(stage.sequence);
                          }
                        }),
                      ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: allConfirmed
                    ? () => Navigator.of(context).pop(true)
                    : null,
                child: const Text('Save'),
              ),
            ],
          );
        },
      ),
    );
    if (confirmed != true) return;

    // GPS is supplementary provenance data here, not a requirement — a
    // planting record must still save even with no fix (indoors, permission
    // denied, this emulator's flaky GPS simulator, etc).
    final position = (await positionFuture).position;
    final payload = <String, dynamic>{'crop': cropController.text.trim()};
    if (position != null) {
      payload['lat'] = position.latitude;
      payload['lon'] = position.longitude;
      payload['accuracy_m'] = position.accuracy;
    }
    // Self-reported by the farmer at planting time, not independently
    // verified — a collector/inspector co-sign is a real gap, not something
    // this checklist claims to solve.
    if (selectedProtocol != null) {
      payload['protocol_id'] = selectedProtocol!.id;
      payload['protocol_name'] = selectedProtocol!.name;
      payload['confirmed_stages'] = confirmedSequences.toList()..sort();
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
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _showProtocolInstructions(ProtocolSummary protocol) async {
    final result = await FarmService.protocolDetail(protocol.id);
    if (!mounted) return;
    if (!result.isOk || result.data == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not load instructions: ${result.error}')),
      );
      return;
    }
    final detail = result.data!;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(detail.name),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                detail.source,
                style: const TextStyle(color: Colors.black54, fontSize: 12),
              ),
              const SizedBox(height: 16),
              for (final stage in detail.stages) ...[
                Text(
                  stage.title,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(stage.instructions),
                const SizedBox(height: 16),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _registerBatch(Plot plot) async {
    final cropController = TextEditingController(text: 'Tea');

    // Public endpoint, best-effort — a farmer can still register a batch
    // with no quality standard attached if this fails or nothing's seeded.
    final protocolsResult = await FarmService.protocolsForCrop(
      cropController.text.trim(),
    );
    final protocols = protocolsResult.isOk
        ? (protocolsResult.data ?? [])
        : <ProtocolSummary>[];
    if (!mounted) return;

    // Pre-select whatever the farmer confirmed adherence to at planting time
    // (see _recordPlanting's checklist) — if it's still in this crop's list.
    ProtocolSummary? selectedProtocol = protocols
        .cast<ProtocolSummary?>()
        .firstWhere(
          (p) => p?.id == plot.committedProtocolId,
          orElse: () => null,
        );
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final mismatch =
              plot.committedProtocolId != null &&
              selectedProtocol?.id != plot.committedProtocolId;
          return AlertDialog(
            title: const Text('Register a batch'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: cropController,
                    decoration: const InputDecoration(labelText: 'Crop'),
                    autofocus: true,
                  ),
                  if (protocols.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Grow to a quality standard? (optional)',
                      style: TextStyle(color: Colors.black54, fontSize: 13),
                    ),
                    DropdownButton<ProtocolSummary?>(
                      isExpanded: true,
                      value: selectedProtocol,
                      hint: const Text('No specific standard'),
                      items: [
                        const DropdownMenuItem<ProtocolSummary?>(
                          value: null,
                          child: Text('No specific standard'),
                        ),
                        for (final p in protocols)
                          DropdownMenuItem<ProtocolSummary?>(
                            value: p,
                            child: Text(p.name),
                          ),
                      ],
                      onChanged: (p) =>
                          setDialogState(() => selectedProtocol = p),
                    ),
                    if (selectedProtocol != null)
                      TextButton(
                        onPressed: () =>
                            _showProtocolInstructions(selectedProtocol!),
                        child: const Text('View planting instructions'),
                      ),
                    if (mismatch) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          selectedProtocol == null
                              ? "This plot's planting was confirmed against "
                                    "${plot.committedProtocolName} — this batch "
                                    "won't claim that standard."
                              : "This plot's planting was confirmed against "
                                    "${plot.committedProtocolName}, not "
                                    "${selectedProtocol!.name}.",
                          style: const TextStyle(
                            color: Color(0xFF9A6B00),
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Register'),
              ),
            ],
          );
        },
      ),
    );
    if (confirmed != true || !mounted) return;

    // Unlike a planting record, a batch code is issued by the server — it
    // can't be queued offline the way events can, since there's nothing
    // meaningful to show the farmer until the server hands back a real code.
    final result = await FarmService.createBatch(
      plotId: plot.id,
      crop: cropController.text.trim(),
      protocolId: selectedProtocol?.id,
    );
    if (!mounted) return;

    if (!result.isOk || result.data == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: ${result.error}')));
      return;
    }

    final code = result.data!.code;
    if (!context.mounted) return;
    await showBatchQrDialog(
      context,
      code,
      subtitle: result.data!.commitmentId != null
          ? 'Matched to an open buyer order for this quality standard.'
          : null,
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
                Text(
                  'My Farm',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
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
            const Text(
              'Your registered plots.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B5E20),
                foregroundColor: Colors.white,
                minimumSize: const Size(0, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: _registerPlot,
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text(
                'Register a plot here',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            if (_commitments != null && _commitments!.isNotEmpty) ...[
              const SizedBox(height: 20),
              const Text(
                'Buyers looking for Tea right now',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 108,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _commitments!.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, i) {
                    final c = _commitments![i];
                    return Container(
                      width: 220,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF1B5E20).withValues(alpha: 0.2),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.protocolName ?? '${c.crop} — any standard',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${c.remainingKg.toStringAsFixed(0)} kg wanted',
                            style: const TextStyle(
                              color: Colors.black87,
                              fontSize: 12,
                            ),
                          ),
                          if (c.indicativePriceLkrPerKg != null)
                            Text(
                              'LKR ${c.indicativePriceLkrPerKg!.toStringAsFixed(0)}/kg',
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                              ),
                            ),
                          const Spacer(),
                          Text(
                            'By ${_formatDate(c.deliveryWindowEnd)}',
                            style: const TextStyle(
                              color: Colors.black54,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C))),
            Expanded(
              child: _plots == null
                  ? const Center(child: CircularProgressIndicator())
                  : _plots!.isEmpty
                  ? const Center(
                      child: Text(
                        'No plots yet.',
                        style: TextStyle(color: Colors.black54),
                      ),
                    )
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
                                  '${plot.district ?? 'Unknown district'} · ${plot.gnDivision ?? ''}'
                                  '${plot.plotType != 'open_field' ? ' · ${_plotTypeLabels[plot.plotType] ?? plot.plotType}' : ''}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${plot.areaHa?.toStringAsFixed(3) ?? '?'} ha · '
                                  '${plot.centerLat.toStringAsFixed(4)}, ${plot.centerLon.toStringAsFixed(4)}',
                                  style: const TextStyle(
                                    color: Colors.black54,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  plot.boundarySource == 'walked'
                                      ? 'Boundary walked in the field'
                                      : 'Estimated square (no boundary walk)',
                                  style: TextStyle(
                                    color: plot.boundarySource == 'walked'
                                        ? const Color(0xFF1B5E20)
                                        : const Color(0xFF9A6B00),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Wrap(
                                  alignment: WrapAlignment.end,
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    OutlinedButton.icon(
                                      onPressed: () => _recordPlanting(plot),
                                      icon: const Icon(
                                        Icons.eco_outlined,
                                        size: 18,
                                      ),
                                      label: const Text('Record planting'),
                                    ),
                                    OutlinedButton.icon(
                                      onPressed: () => _registerBatch(plot),
                                      icon: const Icon(
                                        Icons.inventory_2_outlined,
                                        size: 18,
                                      ),
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

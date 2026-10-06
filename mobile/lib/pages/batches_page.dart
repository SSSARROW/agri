import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../models/batch.dart';
import '../models/plot.dart';
import '../theme/app_colors.dart';
import '../widgets/batch_qr_dialog.dart';
import '../widgets/ui_kit.dart';
import 'batch_schedule_page.dart';

// Buckets a batch's latest pipeline event into where it actually sits in
// the journey — the raw event_type list (registered/collect/weigh/process/
// grade/pack/scan/collector_attestation) is too granular to scan a list by;
// a farmer cares roughly where a batch is, not which of three adjacent
// processing-stage events fired last. Order here is pipeline order, so
// groups render top-to-bottom the way a batch actually moves.
const _statusGroups = <(String, Set<String>)>[
  ('Registered', {'registered'}),
  ('Collected', {'collect', 'collector_attestation'}),
  ('Processing', {'weigh', 'process', 'grade'}),
  ('Packed', {'pack'}),
  ('Scanned', {'scan'}),
];

class BatchesPage extends StatefulWidget {
  const BatchesPage({super.key});

  @override
  State<BatchesPage> createState() => _BatchesPageState();
}

class _BatchesPageState extends State<BatchesPage> {
  List<Batch>? _batches;
  Map<String, Plot> _plotsById = {};
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      FarmService.myBatches(),
      FarmService.myPlots(),
    ]);
    if (!mounted) return;
    final batchesResult = results[0] as FarmResult<List<Batch>>;
    final plotsResult = results[1] as FarmResult<List<Plot>>;
    // See farm_page.dart's _load() for why a 401 doesn't force a re-login.
    setState(() {
      if (batchesResult.isOk) {
        _batches = batchesResult.data;
        _error = null;
      } else {
        _batches = _batches ?? [];
        _error = batchesResult.statusCode == 401
            ? 'Your session needs refreshing — reconnect and log in again to sync new batches.'
            : batchesResult.error;
      }
      // Best-effort — a batch just shows no plot name if this fails, rather
      // than the whole page erroring over a lookup that's secondary to the
      // batch list itself.
      if (plotsResult.isOk) {
        _plotsById = {for (final p in plotsResult.data ?? []) p.id: p};
      }
    });
  }

  Color _statusColor(String status) => switch (status) {
    'registered' => Colors.grey.shade300,
    'planted' => const Color(0xFFE3F2FD),
    'collect' || 'collector_attestation' => const Color(0xFFFFF3CD),
    'weigh' || 'process' || 'grade' => const Color(0xFFFFE0B2),
    'pack' => const Color(0xFFD4EDDA),
    'scan' => const Color(0xFFE1BEE7),
    _ => Colors.grey.shade200,
  };

  String _ageText(DateTime createdAt) {
    final days = DateTime.now().difference(createdAt).inDays;
    if (days <= 0) return 'Registered today';
    if (days == 1) return 'Registered 1 day ago';
    return 'Registered $days days ago';
  }

  List<(String, List<Batch>)> _grouped(List<Batch> batches) {
    final groups = <(String, List<Batch>)>[];
    for (final (label, statuses) in _statusGroups) {
      final inGroup =
          batches.where((b) => statuses.contains(b.latestStatus)).toList()
            ..sort(
              (a, b) => (b.latestOccurredAt ?? b.createdAt).compareTo(
                a.latestOccurredAt ?? a.createdAt,
              ),
            );
      if (inGroup.isNotEmpty) groups.add((label, inGroup));
    }
    final grouped = _statusGroups.expand((g) => g.$2).toSet();
    final leftover =
        batches.where((b) => !grouped.contains(b.latestStatus)).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    if (leftover.isNotEmpty) groups.add(('Other', leftover));
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final batches = _batches;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'My Batches',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Batches from your plots and where each one is in the pipeline.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            Expanded(
              child: batches == null
                  ? const Center(child: CircularProgressIndicator())
                  : batches.isEmpty
                  ? const EmptyState(
                      icon: Icons.inventory_2_outlined,
                      title: 'No batches yet',
                      subtitle: 'Register a batch from one of your plots to see it here.',
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        children: [
                          for (final (label, group) in _grouped(batches)) ...[
                            SectionHeader('$label (${group.length})'),
                            for (final batch in group) ...[
                              _BatchCard(
                                batch: batch,
                                plot: batch.plotId != null
                                    ? _plotsById[batch.plotId]
                                    : null,
                                ageText: _ageText(batch.createdAt),
                                statusColor: _statusColor(batch.latestStatus),
                              ),
                              const SizedBox(height: 10),
                            ],
                            const SizedBox(height: 10),
                          ],
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BatchCard extends StatelessWidget {
  final Batch batch;
  final Plot? plot;
  final String ageText;
  final Color statusColor;

  const _BatchCard({
    required this.batch,
    required this.plot,
    required this.ageText,
    required this.statusColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => showBatchQrDialog(
          context,
          batch.code,
          subtitle: batch.protocolName != null
              ? '${batch.crop} · ${batch.protocolName}'
              : batch.crop,
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const IconCircle(Icons.inventory_2, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            batch.code,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                        if (batch.protocolId != null)
                          IconButton(
                            icon: const Icon(
                              Icons.checklist_outlined,
                              size: 20,
                            ),
                            tooltip: 'View quality standard progress',
                            visualDensity: VisualDensity.compact,
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => BatchSchedulePage(
                                  batchId: batch.id,
                                  batchCode: batch.code,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    Text(
                      batch.protocolName != null
                          ? '${batch.crop} · ${batch.protocolName}'
                          : batch.crop,
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.grass_outlined,
                          size: 13,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            plot?.title ?? 'Plot no longer available',
                            style: const TextStyle(
                              color: Colors.black45,
                              fontSize: 12,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(
                          Icons.schedule,
                          size: 13,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          ageText,
                          style: const TextStyle(
                            color: Colors.black45,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    StatusPill(
                      batch.latestStatus.toUpperCase(),
                      background: statusColor,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

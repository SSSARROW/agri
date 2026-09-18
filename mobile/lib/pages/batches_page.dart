import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../models/batch.dart';
import '../widgets/batch_qr_dialog.dart';

class BatchesPage extends StatefulWidget {
  const BatchesPage({super.key});

  @override
  State<BatchesPage> createState() => _BatchesPageState();
}

class _BatchesPageState extends State<BatchesPage> {
  List<Batch>? _batches;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await FarmService.myBatches();
    if (!mounted) return;
    // See farm_page.dart's _load() for why a 401 doesn't force a re-login.
    setState(() {
      if (result.isOk) {
        _batches = result.data;
        _error = null;
      } else {
        _batches = _batches ?? [];
        _error = (result.error ?? '').startsWith('HTTP 401')
            ? 'Your session needs refreshing — reconnect and log in again to sync new batches.'
            : result.error;
      }
    });
  }

  Color _statusColor(String status) => switch (status) {
    'registered' => Colors.grey.shade300,
    'planted' => const Color(0xFFE3F2FD),
    'collect' => const Color(0xFFFFF3CD),
    'weigh' || 'process' || 'grade' => const Color(0xFFFFE0B2),
    'pack' => const Color(0xFFD4EDDA),
    'scan' => const Color(0xFFE1BEE7),
    _ => Colors.grey.shade200,
  };

  @override
  Widget build(BuildContext context) {
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
            const Text(
              'Batches from your plots and where each one is in the pipeline.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C))),
            Expanded(
              child: _batches == null
                  ? const Center(child: CircularProgressIndicator())
                  : _batches!.isEmpty
                  ? const Center(
                      child: Text(
                        'No batches yet.',
                        style: TextStyle(color: Colors.black54),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        itemCount: _batches!.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final batch = _batches![i];
                          return InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => showBatchQrDialog(
                              context,
                              batch.code,
                              subtitle: batch.protocolName != null
                                  ? '${batch.crop} · ${batch.protocolName}'
                                  : batch.crop,
                            ),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF5F5F5),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          batch.code,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          batch.protocolName != null
                                              ? '${batch.crop} · ${batch.protocolName}'
                                              : batch.crop,
                                          style: const TextStyle(
                                            color: Colors.black54,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: _statusColor(batch.latestStatus),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      batch.latestStatus.toUpperCase(),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
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

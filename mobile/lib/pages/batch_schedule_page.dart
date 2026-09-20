import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../models/protocol_evaluation.dart';

/// The farmer's own staged view of a batch's quality standard (B-32/B-33):
/// which requirements are already met, which are due or overdue, and
/// whether the batch as a whole currently satisfies the protocol it claims.
/// The public provenance page shows a consumer the same computation.
class BatchSchedulePage extends StatefulWidget {
  final String batchId;
  final String batchCode;
  const BatchSchedulePage({
    super.key,
    required this.batchId,
    required this.batchCode,
  });

  @override
  State<BatchSchedulePage> createState() => _BatchSchedulePageState();
}

class _BatchSchedulePageState extends State<BatchSchedulePage> {
  ProtocolEvaluation? _evaluation;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await FarmService.batchSchedule(widget.batchId);
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _evaluation = result.data;
      } else {
        _error = result.error;
      }
    });
  }

  Color _statusColor(String status) => switch (status) {
    'done' => const Color(0xFF1B5E20),
    'overdue' => const Color(0xFFB71C1C),
    'upcoming' || 'pending' => const Color(0xFF7C5C00),
    _ => Colors.black54,
  };

  String _statusLabel(String status) => switch (status) {
    'done' => '✓ Done',
    'overdue' => 'Overdue',
    'upcoming' => 'Upcoming',
    'pending' => 'Pending',
    _ => 'Standing rule',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.batchCode)),
      body: SafeArea(
        child: _error != null
            ? Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFB71C1C)),
                ),
              )
            : _evaluation == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _evaluation!.tierAchieved
                          ? const Color(0xFFE8F5E9)
                          : const Color(0xFFFFF3CD),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _evaluation!.tierAchieved
                              ? '✓ Verified — meets ${_evaluation!.protocolName}'
                              : '${_evaluation!.requiredSatisfied}/${_evaluation!.requiredTotal} required steps done',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _evaluation!.tierAchieved
                                ? const Color(0xFF1B5E20)
                                : const Color(0xFF7C5C00),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _evaluation!.protocolName,
                          style: const TextStyle(
                            color: Colors.black54,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Stages',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  for (final stage in _evaluation!.stages)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  stage.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              Text(
                                _statusLabel(stage.status),
                                style: TextStyle(
                                  color: _statusColor(stage.status),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          if (stage.dueDate != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Due ${stage.dueDate!.day}/${stage.dueDate!.month}/${stage.dueDate!.year}',
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          const SizedBox(height: 6),
                          Text(
                            stage.instructions,
                            style: const TextStyle(fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    'Source: ${_evaluation!.protocolSource}',
                    style: const TextStyle(color: Colors.black54, fontSize: 11),
                  ),
                ],
              ),
      ),
    );
  }
}

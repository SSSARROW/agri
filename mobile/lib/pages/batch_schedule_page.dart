import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../models/protocol_evaluation.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';

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

  StatusLevel _statusLevel(String status) => switch (status) {
    'done' => StatusLevel.success,
    'overdue' => StatusLevel.danger,
    'upcoming' || 'pending' => StatusLevel.warning,
    _ => StatusLevel.neutral,
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
                  style: const TextStyle(color: AppColors.danger),
                ),
              )
            : _evaluation == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Card(
                    color: _evaluation!.tierAchieved
                        ? AppColors.successBg
                        : AppColors.warningBg,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
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
                                  ? AppColors.success
                                  : AppColors.warning,
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
                  ),
                  const SizedBox(height: 24),
                  const SectionHeader('Stages'),
                  for (final stage in _evaluation!.stages)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      stage.title,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  StatusPill(
                                    _statusLabel(stage.status),
                                    level: _statusLevel(stage.status),
                                  ),
                                ],
                              ),
                              if (stage.dueDate != null) ...[
                                const SizedBox(height: 6),
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

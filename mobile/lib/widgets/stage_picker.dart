import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/auth_service.dart';
import '../core/event_queue.dart';
import '../core/pipeline_stages.dart';
import '../core/sync_service.dart';
import '../models/batch.dart';

/// Shared by scan_page.dart (after scanning a QR) and batch_detail_page.dart
/// (a direct "Record stage" button) — recording collect/weigh/process/grade/
/// pack shouldn't require physically scanning a batch's own QR code with the
/// camera when you're already looking at that batch's detail screen.
Future<void> recordNextStage(BuildContext context, Batch batch) async {
  final stage = await showDialog<StageConfig>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(batch.code),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            batch.protocolName != null
                ? '${batch.crop} · ${batch.protocolName}'
                : batch.crop,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 4),
          Text(
            'Currently: ${batch.latestStatus}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          const Text(
            'Record a stage:',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in pipelineStages)
                ActionChip(
                  label: Text(s.label),
                  onPressed: () => Navigator.of(context).pop(s),
                ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
      ],
    ),
  );
  if (stage == null || !context.mounted) return;
  await _recordStage(context, batch, stage);
}

Future<void> _recordStage(
  BuildContext context,
  Batch batch,
  StageConfig stage,
) async {
  final controllers = {
    for (final f in stage.fields) f.key: TextEditingController(),
  };

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('${stage.label} — ${batch.code}'),
      content: stage.fields.isEmpty
          ? const Text('Record this stage now?')
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final f in stage.fields)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: TextField(
                      controller: controllers[f.key],
                      keyboardType: f.numeric
                          ? TextInputType.number
                          : TextInputType.text,
                      inputFormatters: f.numeric
                          ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))]
                          : null,
                      decoration: InputDecoration(labelText: f.label),
                      autofocus: true,
                    ),
                  ),
              ],
            ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Record'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final payload = <String, dynamic>{};
  for (final f in stage.fields) {
    final text = controllers[f.key]!.text.trim();
    if (text.isEmpty) continue;
    payload[f.key] = f.numeric ? num.tryParse(text) ?? text : text;
  }

  await EventQueue.add(
    eventType: stage.eventType,
    payload: payload,
    userId: AuthService.instance.userId,
    batchId: batch.id,
  );
  SyncService.instance.syncNow();
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        '${stage.label} recorded for ${batch.code} — queued for sync.',
      ),
    ),
  );
}

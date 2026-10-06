import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../core/event_queue.dart';
import '../core/sync_service.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';

class QueuePage extends StatelessWidget {
  const QueuePage({super.key});

  StatusLevel _level(String status) => switch (status) {
    'pending' => StatusLevel.warning,
    'synced' => StatusLevel.success,
    'failed' => StatusLevel.danger,
    _ => StatusLevel.neutral,
  };

  @override
  Widget build(BuildContext context) {
    // Its own Scaffold, not a bare SafeArea: this page used to be a tab
    // body (Scaffold, and the height bound that comes with it, supplied by
    // RootShell for free). It's now only ever reached by pushing it from
    // Settings' Sync row, so without this it had no back button, no
    // Material ancestor for its text styling, and the event list overflowed.
    return Scaffold(
      appBar: AppBar(title: const Text('Offline Queue')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Events captured here are written to local storage immediately and synced '
              'when connectivity returns.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            ValueListenableBuilder<Box<Map>>(
              valueListenable: EventQueue.listenable(),
              builder: (context, box, _) {
                final pending = EventQueue.pendingCount();
                return Card(
                  color: pending == 0
                      ? AppColors.successBg
                      : AppColors.warningBg,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          pending == 0
                              ? 'All events synced'
                              : '$pending pending sync',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        TextButton(
                          onPressed: () =>
                              SyncService.instance.retryFailedNow(),
                          child: const Text('Sync now'),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ValueListenableBuilder<Box<Map>>(
                valueListenable: EventQueue.listenable(),
                builder: (context, box, _) {
                  final events = EventQueue.allByRecency();
                  if (events.isEmpty) {
                    return Text(
                      'No queued events yet.',
                      style: Theme.of(context).textTheme.bodySmall,
                    );
                  }
                  return ListView.separated(
                    itemCount: events.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final e = events[i];
                      final status = e['status'] as String;
                      final createdAt = DateTime.parse(
                        e['createdAt'] as String,
                      );
                      final timeLabel =
                          '${createdAt.hour.toString().padLeft(2, '0')}:${createdAt.minute.toString().padLeft(2, '0')}:${createdAt.second.toString().padLeft(2, '0')}';
                      final lastError = e['lastError'] as String?;
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  StatusPill(
                                    status.toUpperCase(),
                                    level: _level(status),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    e['eventType'] as String,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    timeLabel,
                                    style: const TextStyle(
                                      color: Colors.black54,
                                    ),
                                  ),
                                ],
                              ),
                              if (status == 'failed' && lastError != null) ...[
                                const SizedBox(height: 6),
                                Text(
                                  lastError,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

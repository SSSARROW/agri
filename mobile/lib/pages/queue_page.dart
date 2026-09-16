import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../core/event_queue.dart';

class QueuePage extends StatelessWidget {
  const QueuePage({super.key});

  Color _badgeColor(String status) => switch (status) {
        'pending' => const Color(0xFFFFF3CD),
        'synced' => const Color(0xFFD4EDDA),
        'failed' => const Color(0xFFF8D7DA),
        _ => Colors.grey.shade200,
      };

  Color _badgeText(String status) => switch (status) {
        'pending' => const Color(0xFF7C5C00),
        'synced' => const Color(0xFF1B5E20),
        'failed' => const Color(0xFFB71C1C),
        _ => Colors.black87,
      };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Offline Queue', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            const Text(
              'Events captured here are written to local storage immediately and synced '
              'when connectivity returns. This is the foundation for the offline write '
              'queue (M-03).',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1B5E20),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => EventQueue.add(
                    eventType: 'collect',
                    payload: {'note': 'test capture', 'createdOffline': true},
                  ),
                  child: const Text('Add test event', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE0E0E0),
                    foregroundColor: Colors.black87,
                    minimumSize: const Size(0, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => EventQueue.clear(),
                  child: const Text('Clear', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ValueListenableBuilder<Box<Map>>(
                valueListenable: EventQueue.listenable(),
                builder: (context, box, _) {
                  final events = EventQueue.allByRecency();
                  if (events.isEmpty) {
                    return const Text('No queued events yet.', style: TextStyle(color: Colors.black54));
                  }
                  return ListView.separated(
                    itemCount: events.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final e = events[i];
                      final status = e['status'] as String;
                      final createdAt = DateTime.parse(e['createdAt'] as String);
                      final timeLabel =
                          '${createdAt.hour.toString().padLeft(2, '0')}:${createdAt.minute.toString().padLeft(2, '0')}:${createdAt.second.toString().padLeft(2, '0')}';
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF5F5F5),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _badgeColor(status),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                status.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: _badgeText(status),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(e['eventType'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                            const SizedBox(width: 8),
                            Text(timeLabel, style: const TextStyle(color: Colors.black54)),
                          ],
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

import 'package:flutter/material.dart';

import '../../../core/constants.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/offline_queue.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';

class SyncScreen extends StatelessWidget {
  const SyncScreen({super.key});

  String _title(QueuedEvent e) => switch (e.eventType) {
        'planted' => 'Planting · ${e.payload['crop'] ?? ''}',
        'collector_attestation' => 'Condition check',
        _ => stageLabels[e.eventType] ?? titleCase(e.eventType),
      };

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([Services.queue, Services.sync, Services.session]),
      builder: (context, _) {
        final items = Services.queue.mine;
        final q = Services.queue;
        return Scaffold(
          appBar: AppBar(title: const Text('Sync')),
          body: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Column(children: [
                if (Services.session.tokenExpired) const Padding(padding: EdgeInsets.only(bottom: 10), child: Banner2(tone: Tone.bad, title: 'Sign in again to sync', body: 'Uploads are paused until you sign in.')),
                if (q.otherUsersCount > 0)
                  Padding(padding: const EdgeInsets.only(bottom: 10), child: Banner2(tone: Tone.info, title: '${q.otherUsersCount} item${q.otherUsersCount == 1 ? '' : 's'} belong to another account', body: 'They stay on this phone and upload when that person signs in.')),
                Row(children: [
                  Expanded(child: Text(q.pendingCount == 0 ? 'All synced' : '${q.pendingCount} waiting to sync', style: Theme.of(context).textTheme.titleLarge)),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(minimumSize: const Size(140, 48)),
                    onPressed: Services.sync.running ? null : () => Services.sync.syncNow(force: true),
                    icon: Services.sync.running ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Icon(Icons.sync),
                    label: const Text('Sync now'),
                  ),
                ]),
              ]),
            ),
            const Divider(),
            Expanded(
              child: items.isEmpty
                  ? const EmptyPanel(icon: Icons.cloud_done_outlined, title: 'Nothing to sync', body: 'Plantings and batch steps you record appear here until they reach the server.')
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, _) => Gaps.s,
                      itemBuilder: (_, i) {
                        final e = items[i];
                        final tone = switch (e.status) { QueueStatus.synced => Tone.good, QueueStatus.pending => Tone.warn, QueueStatus.failed => Tone.warn, QueueStatus.rejected => Tone.bad };
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Expanded(child: Text(_title(e), style: Theme.of(context).textTheme.titleMedium)),
                                Pill(switch (e.status) { QueueStatus.synced => 'Synced', QueueStatus.pending => 'Waiting', QueueStatus.failed => 'Will retry', QueueStatus.rejected => 'Refused' }, tone: tone),
                              ]),
                              Text(fmtDateTime(e.occurredAt), style: Theme.of(context).textTheme.bodySmall),
                              if (e.lastError != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(e.lastError!, style: const TextStyle(color: C.danger, fontSize: 14))),
                              if (e.status == QueueStatus.rejected)
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(onPressed: () => Services.queue.discard(e), icon: const Icon(Icons.delete_outline), label: const Text('Discard')),
                                ),
                            ]),
                          ),
                        );
                      },
                    ),
            ),
          ]),
        );
      },
    );
  }
}

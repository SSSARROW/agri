import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../data/services.dart';
import '../screens/auth/auth_screens.dart';
import '../screens/settings/sync_screen.dart';
import 'common.dart';

/// Always-visible truth about the offline queue and the session.
class StatusStrip extends StatelessWidget {
  const StatusStrip({super.key});
  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([Services.session, Services.queue, Services.sync]),
      builder: (context, _) {
        final s = Services.session;
        final q = Services.queue;
        if (s.tokenExpired) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Banner2(
              tone: Tone.bad,
              title: 'Sign in again to sync',
              body: 'Your login expired. You can keep recording; ${q.pendingCount} item${q.pendingCount == 1 ? '' : 's'} will upload after you sign in.',
              action: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReauthScreen())),
              actionLabel: 'Sign in',
              icon: Icons.lock_clock,
            ),
          );
        }
        if (q.rejectedCount > 0) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Banner2(
              tone: Tone.warn,
              title: '${q.rejectedCount} record${q.rejectedCount == 1 ? ' was' : 's were'} refused by the server',
              body: 'Open the sync list to see why and discard them.',
              action: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SyncScreen())),
              actionLabel: 'Review',
            ),
          );
        }
        if (q.pendingCount > 0) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SyncScreen())),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(color: C.bark50, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.bark100)),
                child: Row(children: [
                  Services.sync.running
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: C.bark600))
                      : const Icon(Icons.cloud_upload_outlined, size: 20, color: C.bark600),
                  const SizedBox(width: 10),
                  Expanded(child: Text('${q.pendingCount} waiting to sync', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: C.bark700))),
                  const Icon(Icons.chevron_right, color: C.bark600),
                ]),
              ),
            ),
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}

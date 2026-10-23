import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import 'notices_screens.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: AsyncView<({List<AppNotification> items, int unread})>(
        load: Services.repo.notifications,
        builder: (context, data, reload) {
          if (data.items.isEmpty) return const EmptyPanel(icon: Icons.notifications_none_rounded, title: 'Nothing yet', body: 'You\'ll receive reminders here when upcoming planting seasons approach.');
          final t = Theme.of(context).textTheme;
          return Column(children: [
            const Padding(padding: EdgeInsets.only(bottom: 12), child: Banner2(tone: Tone.info, title: 'Reminders appear when you open the app', body: 'Pull down to check for new ones.')),
            for (final n in data.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Tappable(
                  onTap: () async {
                    if (n.unread) Services.repo.markRead(n.id);
                    if (n.noticeId != null) {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => NoticeDetailScreen(id: n.noticeId!)));
                      reload();
                    }
                  },
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(width: 10, height: 10, margin: const EdgeInsets.only(top: 7, right: 12), decoration: BoxDecoration(shape: BoxShape.circle, color: n.unread ? C.bark500 : Colors.transparent)),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(n.title, style: t.titleMedium?.copyWith(fontWeight: n.unread ? FontWeight.w700 : FontWeight.w500)),
                        Text(n.body, style: t.bodyMedium),
                        Gaps.xs,
                        Text(fmtDate(n.sentAt ?? n.createdAt), style: t.bodySmall),
                      ]),
                    ),
                  ]),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../core/notifications_service.dart';
import '../models/farmer_notification.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';
import 'planting_notice_detail_page.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<FarmerNotificationItem>? _items;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await NotificationsService.listNotifications(
      page: 1,
      pageSize: 50,
    );
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res.isOk && res.data != null) {
        _items = res.data!.items;
        _error = null;
      } else {
        _error = res.error;
      }
    });
  }

  Future<void> _onTapNotification(FarmerNotificationItem item) async {
    // Optimistically mark as read locally
    if (!item.isRead) {
      setState(() {
        _items = _items?.map((it) {
          if (it.id == item.id) {
            return FarmerNotificationItem(
              id: it.id,
              noticeId: it.noticeId,
              reminderSlot: it.reminderSlot,
              title: it.title,
              body: it.body,
              language: it.language,
              channel: it.channel,
              status: 'read',
              sentAt: it.sentAt,
              readAt: DateTime.now().toUtc(),
              createdAt: it.createdAt,
            );
          }
          return it;
        }).toList();
      });

      // Best effort backend mark-read (idempotent)
      NotificationsService.markRead(item.id);
    }

    // Open planting notice if noticeId is attached
    if (item.noticeId != null && item.noticeId!.isNotEmpty) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PlantingNoticeDetailPage(noticeId: item.noticeId!),
        ),
      );
      if (mounted) {
        _load();
      }
    }
  }

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return '';
    final local = dt.toLocal();
    final now = DateTime.now();
    final diff = now.difference(local);

    if (diff.inMinutes < 60) {
      final m = diff.inMinutes;
      return m <= 1 ? 'Just now' : '$m mins ago';
    }
    if (diff.inHours < 24) {
      final h = diff.inHours;
      return '$h hour${h == 1 ? '' : 's'} ago';
    }
    if (diff.inDays < 7) {
      final d = diff.inDays;
      return '$d day${d == 1 ? '' : 's'} ago';
    }
    return '${local.day}/${local.month}/${local.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
      ),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading && _items == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && (_items == null || _items!.isEmpty)) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const IconCircle(
                Icons.error_outline,
                size: 56,
                color: AppColors.danger,
              ),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.danger),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _load,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final items = _items ?? [];
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 100),
            EmptyState(
              icon: Icons.notifications_none_outlined,
              title: 'No notifications',
              subtitle:
                  "You'll receive reminders here when upcoming planting seasons approach.",
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final item = items[index];
          final isUnread = !item.isRead;

          return Card(
            color: isUnread ? Colors.white : const Color(0xFFF3F4F0),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: isUnread
                  ? BorderSide(color: AppColors.primary.withValues(alpha: 0.35))
                  : BorderSide.none,
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => _onTapNotification(item),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconCircle(
                      isUnread
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_none_outlined,
                      size: 38,
                      color: isUnread ? AppColors.primary : Colors.black45,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: TextStyle(
                                    fontWeight: isUnread
                                        ? FontWeight.bold
                                        : FontWeight.w600,
                                    fontSize: 14,
                                    color: Colors.black87,
                                  ),
                                ),
                              ),
                              if (isUnread) ...[
                                const SizedBox(width: 6),
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.body,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _formatTimestamp(item.sentAt ?? item.createdAt),
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.black45,
                                ),
                              ),
                              if (item.noticeId != null &&
                                  item.noticeId!.isNotEmpty)
                                const Row(
                                  children: [
                                    Text(
                                      'View notice',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                    SizedBox(width: 2),
                                    Icon(
                                      Icons.chevron_right,
                                      size: 14,
                                      color: AppColors.primary,
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

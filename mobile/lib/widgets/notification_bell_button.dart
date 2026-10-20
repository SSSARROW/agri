import 'package:flutter/material.dart';

import '../core/notifications_service.dart';
import '../pages/notifications_page.dart';
import '../theme/app_colors.dart';

/// A bell icon button with an unread badge.
/// Fetches the unread count on mount and refreshes when returning from the
/// Notifications screen. Failures silently hide the badge so host pages never break.
class NotificationBellButton extends StatefulWidget {
  const NotificationBellButton({super.key});

  @override
  State<NotificationBellButton> createState() => _NotificationBellButtonState();
}

class _NotificationBellButtonState extends State<NotificationBellButton> {
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final count = await NotificationsService.getUnreadCount();
    if (!mounted) return;
    setState(() => _unreadCount = count);
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const NotificationsPage()),
    );
    if (!mounted) return;
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: _openNotifications,
      icon: _unreadCount > 0
          ? Badge(
              backgroundColor: AppColors.danger,
              label: Text(
                _unreadCount > 99 ? '99+' : '$_unreadCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
              child: const Icon(Icons.notifications_outlined, size: 24),
            )
          : const Icon(Icons.notifications_outlined, size: 24),
    );
  }
}

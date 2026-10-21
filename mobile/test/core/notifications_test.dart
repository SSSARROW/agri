import 'package:flutter_test/flutter_test.dart';
import 'package:field/models/farmer_notification.dart';

void main() {
  group('FarmerNotification Models & Parsing', () {
    test('FarmerNotificationItem parses correctly', () {
      final json = {
        'id': 'notif-1',
        'notice_id': 'notice-123',
        'reminder_slot': 14,
        'title': 'Planting Notice Reminder',
        'body': 'Target month 2026-11 is in 14 days.',
        'language': 'en',
        'channel': 'in_app',
        'status': 'sent',
        'sent_at': '2026-10-18T02:00:00Z',
        'read_at': null,
        'created_at': '2026-10-18T02:00:00Z',
      };

      final item = FarmerNotificationItem.fromJson(json);
      expect(item.id, 'notif-1');
      expect(item.noticeId, 'notice-123');
      expect(item.reminderSlot, 14);
      expect(item.title, 'Planting Notice Reminder');
      expect(item.body, 'Target month 2026-11 is in 14 days.');
      expect(item.status, 'sent');
      expect(item.readAt, isNull);
      expect(item.isRead, isFalse);
    });

    test('FarmerNotificationItem detects read status via read_at or status string', () {
      final itemWithReadAt = FarmerNotificationItem.fromJson({
        'id': 'notif-2',
        'title': 'Reminder',
        'status': 'sent',
        'read_at': '2026-10-19T06:30:00Z',
      });
      expect(itemWithReadAt.isRead, isTrue);

      final itemWithReadStatus = FarmerNotificationItem.fromJson({
        'id': 'notif-3',
        'title': 'Reminder',
        'status': 'read',
      });
      expect(itemWithReadStatus.isRead, isTrue);
    });

    test('FarmerNotificationItem handles missing/null values safely', () {
      final item = FarmerNotificationItem.fromJson({});
      expect(item.id, '');
      expect(item.noticeId, isNull);
      expect(item.title, '');
      expect(item.body, '');
      expect(item.status, 'sent');
      expect(item.isRead, isFalse);
    });

    test('PaginatedFarmerNotifications parses unread_count and list', () {
      final json = {
        'items': [
          {
            'id': 'notif-1',
            'notice_id': 'notice-123',
            'title': 'Reminder 1',
            'status': 'sent',
          },
          {
            'id': 'notif-2',
            'notice_id': 'notice-123',
            'title': 'Reminder 2',
            'status': 'read',
            'read_at': '2026-10-19T00:00:00Z',
          },
        ],
        'total': 2,
        'unread_count': 1,
        'page': 1,
        'page_size': 20,
        'total_pages': 1,
      };

      final res = PaginatedFarmerNotifications.fromJson(json);
      expect(res.items.length, 2);
      expect(res.unreadCount, 1);
      expect(res.total, 2);
      expect(res.items[0].isRead, isFalse);
      expect(res.items[1].isRead, isTrue);
    });
  });
}

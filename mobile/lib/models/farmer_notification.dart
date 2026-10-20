class FarmerNotificationItem {
  final String id;
  final String? noticeId;
  final int reminderSlot;
  final String title;
  final String body;
  final String language;
  final String channel;
  final String status;
  final DateTime? sentAt;
  final DateTime? readAt;
  final DateTime? createdAt;

  FarmerNotificationItem({
    required this.id,
    this.noticeId,
    required this.reminderSlot,
    required this.title,
    required this.body,
    required this.language,
    required this.channel,
    required this.status,
    this.sentAt,
    this.readAt,
    this.createdAt,
  });

  bool get isRead => readAt != null || status == 'read';

  factory FarmerNotificationItem.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic val) {
      if (val is String && val.isNotEmpty) {
        return DateTime.tryParse(val);
      }
      return null;
    }

    return FarmerNotificationItem(
      id: (json['id'] as String?) ?? '',
      noticeId: json['notice_id'] as String?,
      reminderSlot: (json['reminder_slot'] as num?)?.toInt() ?? 0,
      title: (json['title'] as String?) ?? '',
      body: (json['body'] as String?) ?? '',
      language: (json['language'] as String?) ?? 'en',
      channel: (json['channel'] as String?) ?? 'in_app',
      status: (json['status'] as String?) ?? 'sent',
      sentAt: parseDate(json['sent_at']),
      readAt: parseDate(json['read_at']),
      createdAt: parseDate(json['created_at']),
    );
  }
}

class PaginatedFarmerNotifications {
  final List<FarmerNotificationItem> items;
  final int total;
  final int unreadCount;
  final int page;
  final int pageSize;
  final int totalPages;

  PaginatedFarmerNotifications({
    required this.items,
    required this.total,
    required this.unreadCount,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  factory PaginatedFarmerNotifications.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List?;
    final list = rawItems != null
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(FarmerNotificationItem.fromJson)
            .toList()
        : <FarmerNotificationItem>[];

    return PaginatedFarmerNotifications(
      items: list,
      total: (json['total'] as num?)?.toInt() ?? list.length,
      unreadCount: (json['unread_count'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['page_size'] as num?)?.toInt() ?? 20,
      totalPages: (json['total_pages'] as num?)?.toInt() ?? 1,
    );
  }
}

import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

/// Offline write queue: every captured event gets a client-generated UUID at
/// creation time, so a later sync against the backend's event API can be
/// idempotent (posting the same UUID twice must create exactly one row).
class EventQueue {
  static const _boxName = 'events';
  static const _uuid = Uuid();

  static Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox<Map>(_boxName);
  }

  static Box<Map> get _box => Hive.box<Map>(_boxName);

  static Future<void> add({
    required String eventType,
    required Map<String, dynamic> payload,
    String? userId,
    String? plotId,
    String? batchId,
    // When the thing actually happened, if different from right now (a
    // backdated planting record, say) — defaults to now like before this
    // param existed. createdAt (queue bookkeeping, for sync ordering) is
    // always "now" regardless, since that's when it was captured locally.
    DateTime? occurredAt,
  }) async {
    final now = DateTime.now().toIso8601String();
    final id = _uuid.v4();
    await _box.put(id, {
      'id': id,
      'eventType': eventType,
      'payload': payload,
      'userId': userId,
      'plotId': plotId,
      'batchId': batchId,
      'occurredAt': (occurredAt ?? DateTime.now()).toIso8601String(),
      'status': 'pending',
      'createdAt': now,
      'attempts': 0,
      'lastError': null,
      'nextRetryAt': null,
    });
  }

  static List<Map> allByRecency() {
    final items = _box.values.toList();
    items.sort(
      (a, b) => (b['createdAt'] as String).compareTo(a['createdAt'] as String),
    );
    return items;
  }

  static int pendingCount() =>
      _box.values.where((e) => e['status'] != 'synced').length;

  static List<Map> dueForSync() {
    final now = DateTime.now();
    return _box.values.where((e) {
      if (e['status'] == 'synced') return false;
      final nextRetryAt = e['nextRetryAt'] as String?;
      if (nextRetryAt == null) return true;
      return now.isAfter(DateTime.parse(nextRetryAt));
    }).toList();
  }

  static Future<void> markSynced(String id) async {
    final event = _box.get(id);
    if (event == null) return;
    await _box.put(id, {
      ...Map<String, dynamic>.from(event),
      'status': 'synced',
      'lastError': null,
      'nextRetryAt': null,
    });
  }

  static Future<void> markFailed(String id, String error) async {
    final event = _box.get(id);
    if (event == null) return;
    final attempts = ((event['attempts'] as int?) ?? 0) + 1;
    final backoffSeconds = attempts.clamp(1, 6) * attempts.clamp(1, 6) * 2; // 2,8,18,32,50,72s
    await _box.put(id, {
      ...Map<String, dynamic>.from(event),
      'status': 'failed',
      'attempts': attempts,
      'lastError': error,
      'nextRetryAt': DateTime.now().add(Duration(seconds: backoffSeconds)).toIso8601String(),
    });
  }

  /// Clears backoff timers on failed items so the next sync pass retries
  /// them immediately, regardless of how long is left to wait.
  static Future<void> resetRetryTimers() async {
    for (final event in _box.values.where((e) => e['status'] == 'failed')) {
      await _box.put(event['id'], {...Map<String, dynamic>.from(event), 'nextRetryAt': null});
    }
  }

  static Future<void> clear() => _box.clear();

  static ValueListenable<Box<Map>> listenable() => _box.listenable();
}

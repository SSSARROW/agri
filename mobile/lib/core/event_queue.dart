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
  }) async {
    final now = DateTime.now().toIso8601String();
    final id = _uuid.v4();
    await _box.put(id, {
      'id': id,
      'eventType': eventType,
      'payload': payload,
      'occurredAt': now,
      'status': 'pending',
      'createdAt': now,
    });
  }

  static List<Map> allByRecency() {
    final items = _box.values.toList();
    items.sort(
      (a, b) => (b['createdAt'] as String).compareTo(a['createdAt'] as String),
    );
    return items;
  }

  static Future<void> clear() => _box.clear();

  static ValueListenable<Box<Map>> listenable() => _box.listenable();
}

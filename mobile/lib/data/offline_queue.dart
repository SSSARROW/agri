import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:hive/hive.dart';

import 'api_client.dart';
import 'session.dart';

enum QueueStatus { pending, failed, rejected, synced }

class QueuedEvent {
  final String id, eventType, userId;
  final String? plotId, batchId;
  final Map<String, dynamic> payload;
  final DateTime occurredAt, createdAt;
  QueueStatus status;
  int attempts;
  String? lastError;
  DateTime? nextRetryAt, syncedAt;

  QueuedEvent({
    required this.id,
    required this.eventType,
    required this.userId,
    required this.payload,
    required this.occurredAt,
    required this.createdAt,
    this.plotId,
    this.batchId,
    this.status = QueueStatus.pending,
    this.attempts = 0,
    this.lastError,
    this.nextRetryAt,
    this.syncedAt,
  });

  factory QueuedEvent.fromJson(Map<String, dynamic> j) => QueuedEvent(
        id: j['id'],
        eventType: j['eventType'],
        userId: j['userId'] ?? '',
        plotId: j['plotId'],
        batchId: j['batchId'],
        payload: (j['payload'] as Map).cast<String, dynamic>(),
        occurredAt: DateTime.parse(j['occurredAt']),
        createdAt: DateTime.parse(j['createdAt']),
        status: QueueStatus.values.firstWhere((s) => s.name == j['status'], orElse: () => QueueStatus.pending),
        attempts: j['attempts'] ?? 0,
        lastError: j['lastError'],
        nextRetryAt: j['nextRetryAt'] == null ? null : DateTime.tryParse(j['nextRetryAt']),
        syncedAt: j['syncedAt'] == null ? null : DateTime.tryParse(j['syncedAt']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'eventType': eventType,
        'userId': userId,
        'plotId': plotId,
        'batchId': batchId,
        'payload': payload,
        'occurredAt': occurredAt.toIso8601String(),
        'createdAt': createdAt.toIso8601String(),
        'status': status.name,
        'attempts': attempts,
        'lastError': lastError,
        'nextRetryAt': nextRetryAt?.toIso8601String(),
        'syncedAt': syncedAt?.toIso8601String(),
      };

  Map<String, dynamic> toRequest() => {
        'id': id,
        'event_type': eventType,
        'user_id': userId,
        'plot_id': plotId,
        'batch_id': batchId,
        'payload': payload,
        'occurred_at': occurredAt.toUtc().toIso8601String(),
      };
}

/// Events recorded with no signal wait here until the server accepts them.
/// Every event has a client-generated id, so re-sending is always safe.
class OfflineQueue extends ChangeNotifier {
  OfflineQueue(this._session);
  final Session _session;
  late final Box<String> _box;
  final List<QueuedEvent> _items = [];

  Future<void> init() async {
    _box = await Hive.openBox<String>('event_queue');
    for (final raw in _box.values) {
      try {
        _items.add(QueuedEvent.fromJson(jsonDecode(raw) as Map<String, dynamic>));
      } catch (_) {/* skip unreadable row */}
    }
    _items.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  /// Only the signed-in person's events are shown and synced, so a shared
  /// phone never attributes one person's work to another.
  List<QueuedEvent> get mine => _items.where((e) => e.userId == _session.userId).toList();
  int get pendingCount => mine.where((e) => e.status == QueueStatus.pending || e.status == QueueStatus.failed).length;
  int get rejectedCount => mine.where((e) => e.status == QueueStatus.rejected).length;
  int get otherUsersCount => _items.where((e) => e.userId != _session.userId && e.status != QueueStatus.synced).length;

  Future<void> add(QueuedEvent e) async {
    _items.insert(0, e);
    await _save(e);
    notifyListeners();
  }

  Future<void> save(QueuedEvent e) async {
    await _save(e);
    notifyListeners();
  }

  Future<void> discard(QueuedEvent e) async {
    _items.removeWhere((x) => x.id == e.id);
    await _box.delete(e.id);
    notifyListeners();
  }

  Future<void> clearWaits() async {
    for (final e in _items) {
      if (e.status == QueueStatus.failed) e.nextRetryAt = null;
    }
    notifyListeners();
  }

  Future<void> prune() async {
    final cutoff = DateTime.now().subtract(const Duration(days: 3));
    final old = _items.where((e) => e.status == QueueStatus.synced && (e.syncedAt ?? e.createdAt).isBefore(cutoff)).toList();
    for (final e in old) {
      _items.remove(e);
      await _box.delete(e.id);
    }
  }

  Future<void> _save(QueuedEvent e) => _box.put(e.id, jsonEncode(e.toJson()));
}

/// Pushes the queue to the server: at start, every 20 s, and when signal returns.
class SyncEngine extends ChangeNotifier {
  SyncEngine(this._queue, this._api, this._session);
  final OfflineQueue _queue;
  final ApiClient _api;
  final Session _session;

  Timer? _timer;
  StreamSubscription? _conn;
  bool running = false;

  void start() {
    _timer ??= Timer.periodic(const Duration(seconds: 20), (_) => syncNow());
    _conn ??= Connectivity().onConnectivityChanged.listen((r) {
      if (r.any((x) => x != ConnectivityResult.none)) syncNow();
    });
    syncNow();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _conn?.cancel();
    _conn = null;
  }

  Future<void> syncNow({bool force = false}) async {
    if (running || _session.token == null || _session.tokenExpired) return;
    running = true;
    notifyListeners();
    if (force) await _queue.clearWaits();
    try {
      final now = DateTime.now();
      final due = _queue.mine
          .where((e) => (e.status == QueueStatus.pending || e.status == QueueStatus.failed) && (e.nextRetryAt == null || !e.nextRetryAt!.isAfter(now)))
          .toList()
          .reversed; // oldest first, so a plot is planted before its photos and stages
      for (final e in due) {
        try {
          await _api.post(Service.field, '/api/v1/events', body: e.toRequest());
          e
            ..status = QueueStatus.synced
            ..syncedAt = DateTime.now()
            ..lastError = null;
        } on ApiException catch (err) {
          if (err.unauthorized) {
            break; // session banner takes over; nothing is lost
          } else if (err.offline) {
            break; // no signal: leave everything pending, don't burn retries
          } else if (err.permanent) {
            e
              ..status = QueueStatus.rejected
              ..lastError = err.message;
          } else {
            final n = e.attempts + 1 > 6 ? 6 : e.attempts + 1;
            e
              ..attempts += 1
              ..status = QueueStatus.failed
              ..lastError = err.message
              ..nextRetryAt = DateTime.now().add(Duration(seconds: n * n * 2));
          }
        }
        await _queue.save(e);
      }
      await _queue.prune();
    } finally {
      running = false;
      notifyListeners();
    }
  }
}

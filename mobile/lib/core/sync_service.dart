import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';
import 'event_queue.dart';

/// Sync engine (M-04): pushes queued offline events to the backend's
/// idempotent event API, retrying failures with backoff and re-syncing
/// automatically when connectivity returns.
class SyncService {
  SyncService._();
  static final SyncService instance = SyncService._();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _pollTimer;
  bool _syncing = false;

  void start() {
    _connectivitySub ??= Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) {
        syncNow();
      }
    });
    _pollTimer ??= Timer.periodic(const Duration(seconds: 20), (_) => syncNow());
    syncNow();
  }

  void dispose() {
    _connectivitySub?.cancel();
    _pollTimer?.cancel();
  }

  Future<void> retryFailedNow() async {
    await EventQueue.resetRetryTimers();
    await syncNow();
  }

  Future<void> syncNow() async {
    if (_syncing) return;
    _syncing = true;
    try {
      for (final event in EventQueue.dueForSync()) {
        await _syncOne(event);
      }
    } finally {
      _syncing = false;
    }
  }

  Future<void> _syncOne(Map event) async {
    final id = event['id'] as String;
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/events'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'id': id,
              'event_type': event['eventType'],
              'payload': event['payload'],
              'occurred_at': event['occurredAt'],
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (res.statusCode == 200 || res.statusCode == 201) {
        await EventQueue.markSynced(id);
      } else {
        await EventQueue.markFailed(id, 'HTTP ${res.statusCode}: ${res.body}');
      }
    } catch (e) {
      await EventQueue.markFailed(id, e.toString());
    }
  }
}

import 'package:uuid/uuid.dart';

import '../core/format.dart' show titleCase;
import '../core/geo.dart';
import 'api_client.dart';
import 'models.dart';
import 'offline_queue.dart';
import 'session.dart';

List<T> _list<T>(dynamic body, T Function(Map<String, dynamic>) f) =>
    ((body as List?) ?? const []).map((e) => f((e as Map).cast<String, dynamic>())).toList();
Map<String, dynamic> _map(dynamic b) => (b as Map).cast<String, dynamic>();

class Repository {
  Repository(this._api, this._queue, this._session);
  final ApiClient _api;
  final OfflineQueue _queue;
  final Session _session;
  static const _uuid = Uuid();

  static String newId() => _uuid.v4();

  /* ── Accounts ────────────────────────────────────────────────────────── */

  Future<({String token, String role})> login(String email, String password) async {
    final b = _map(await _api.post(Service.account, '/auth/login', body: {'email': email, 'password': password}));
    return (token: b['access_token'] as String, role: b['role'] as String);
  }

  Future<({String token, String role})> signUp(String role, Map<String, dynamic> body) async {
    final b = _map(await _api.post(Service.account, '/auth/signup/$role', body: body));
    return (token: b['access_token'] as String, role: b['role'] as String);
  }

  Future<UserProfile> me() async => UserProfile.fromJson(_map(await _api.get(Service.field, '/api/v1/users/me')));

  /* ── Plots ───────────────────────────────────────────────────────────── */

  Future<List<Plot>> myPlots() async => _list(await _api.get(Service.field, '/api/v1/plots/me'), Plot.fromJson);

  Future<Plot> createPlot({
    required String? name,
    required String plotType,
    required String district,
    required String dsd,
    required String gn,
    required String source,
    required List<LatLon> points,
  }) async {
    final b = await _api.post(Service.field, '/api/v1/plots', body: {
      if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
      'boundary_source': source,
      'boundary_points': points.map((p) => p.toJson()).toList(),
      'plot_type': plotType,
      'district': district,
      if (dsd.trim().isNotEmpty) 'dsd': dsd.trim(),
      if (gn.trim().isNotEmpty) 'gn_division': gn.trim(),
    });
    return Plot.fromJson(_map(b));
  }

  Future<Plot> renamePlot(String id, String name) async => Plot.fromJson(_map(await _api.patch(Service.field, '/api/v1/plots/$id', body: {'name': name.trim().isEmpty ? null : name.trim()})));

  Future<PhotoSchedule> photoSchedule(String plotId) async => PhotoSchedule.fromJson(_map(await _api.get(Service.field, '/api/v1/photos/schedule', query: {'plot_id': plotId})));

  Future<List<EventOut>> plotPhotos(String plotId) async => _list(await _api.get(Service.field, '/api/v1/photos', query: {'plot_id': plotId}), EventOut.fromJson);

  Future<List<EventOut>> plotEvents(String plotId) async => _list(await _api.get(Service.field, '/api/v1/events', query: {'plot_id': plotId}), EventOut.fromJson);

  Future<EventOut> uploadPhoto({
    required String filePath,
    required String plotId,
    required String eventType,
    String? batchId,
    String? crop,
    String? caption,
    double? lat,
    double? lon,
    DateTime? occurredAt,
  }) async {
    final b = await _api.multipart(Service.field, '/api/v1/photos', filePath: filePath, fields: {
      'plot_id': plotId,
      'event_type': eventType,
      'event_id': newId(),
      if (batchId != null) 'batch_id': batchId,
      if (crop != null) 'crop': crop,
      if (caption != null && caption.trim().isNotEmpty) 'caption': caption.trim(),
      if (lat != null) 'lat': '$lat',
      if (lon != null) 'lon': '$lon',
      if (occurredAt != null) 'occurred_at': occurredAt.toUtc().toIso8601String(),
    });
    return EventOut.fromJson(_map(b));
  }

  /* ── Batches ─────────────────────────────────────────────────────────── */

  Future<List<Batch>> myBatches() async => _list(await _api.get(Service.field, '/api/v1/batches/me'), Batch.fromJson);

  Future<Batch> batchByCode(String code) async => Batch.fromJson(_map(await _api.get(Service.field, '/api/v1/batches/by-code/${Uri.encodeComponent(code.trim())}')));

  Future<Batch> createBatch({required String plotId, required String crop, String? protocolId}) async =>
      Batch.fromJson(_map(await _api.post(Service.field, '/api/v1/batches', body: {'plot_id': plotId, 'crop': crop, if (protocolId != null) 'protocol_id': protocolId})));

  Future<Batch> mergeBatches({required List<String> parentIds, required String crop}) async =>
      Batch.fromJson(_map(await _api.post(Service.field, '/api/v1/batches/merge', body: {'parent_batch_ids': parentIds, 'crop': crop})));

  Future<List<EventOut>> batchEvents(String batchId) async => _list(await _api.get(Service.field, '/api/v1/events', query: {'batch_id': batchId}), EventOut.fromJson);

  Future<ProtocolEval> batchSchedule(String batchId) async => ProtocolEval.fromJson(_map(await _api.get(Service.field, '/api/v1/batches/$batchId/schedule')));

  Future<List<ProtocolSummary>> protocols(String crop) async => _list(await _api.get(Service.field, '/api/v1/protocols', query: {'crop': titleCase(crop)}), ProtocolSummary.fromJson);

  Future<Protocol> protocol(String id) async => Protocol.fromJson(_map(await _api.get(Service.field, '/api/v1/protocols/$id')));

  /* ── Offline events ──────────────────────────────────────────────────── */

  /// Saves an event on the device immediately; the sync engine delivers it later.
  Future<QueuedEvent> record({
    required String eventType,
    required Map<String, dynamic> payload,
    String? plotId,
    String? batchId,
    DateTime? occurredAt,
  }) async {
    final now = DateTime.now();
    final e = QueuedEvent(
      id: newId(),
      eventType: eventType,
      userId: _session.userId ?? '',
      plotId: plotId,
      batchId: batchId,
      payload: payload,
      occurredAt: occurredAt ?? now,
      createdAt: now,
    );
    await _queue.add(e);
    return e;
  }

  /* ── Market ──────────────────────────────────────────────────────────── */

  Future<List<Order>> orders({String? crop}) async {
    final b = _map(await _api.get(Service.account, '/api/farmer/ads', query: {'page_size': '50', 'crop': crop}));
    return _list(b['items'], Order.fromJson);
  }

  Future<OrderDetail> order(String id) async => OrderDetail.fromJson(_map(await _api.get(Service.account, '/api/farmer/ads/$id')));

  Future<String> apply(String adId, String versionId, double kg) async {
    final b = _map(await _api.post(Service.account, '/api/farmer/ads/$adId/accept', body: {'ad_version_id': versionId, 'supply_quantity_kg': kg}));
    return (b['message'] ?? 'Application sent.').toString();
  }

  Future<void> withdraw(String adId) => _api.post(Service.account, '/api/farmer/ads/$adId/withdraw');

  Future<List<Application>> applications() async => _list(_map(await _api.get(Service.account, '/api/farmer/ads/my-acceptances'))['items'], Application.fromJson);

  /* ── Exporter link & proof ───────────────────────────────────────────── */

  Future<List<VerifiedExporter>> exporters() async => _list(await _api.get(Service.account, '/api/farmer/exporter-link/exporters'), VerifiedExporter.fromJson);

  Future<ExporterLink?> currentLink() async {
    final b = _map(await _api.get(Service.account, '/api/farmer/exporter-link/current'));
    return b['has_active_link'] == true && b['link'] != null ? ExporterLink.fromJson(_map(b['link'])) : null;
  }

  Future<void> requestLink(String exporterId) => _api.post(Service.account, '/api/farmer/exporter-link/request', body: {'exporter_profile_id': exporterId});

  Future<void> cancelLink() => _api.post(Service.account, '/api/farmer/exporter-link/cancel');

  Future<ProofStandards> proofStandards() async => ProofStandards.fromJson(_map(await _api.get(Service.account, '/api/farmer/stage-proofs/standards')));

  Future<List<Submission>> mySubmissions() async => _list(_map(await _api.get(Service.account, '/api/farmer/stage-proofs/my-submissions'))['items'], Submission.fromJson);

  Future<void> submitProof(String stageId, {required List<String> photoUrls, required Map<String, String> answers, String? note, String? plotId}) =>
      _api.post(Service.account, '/api/farmer/stage-proofs/$stageId/submit', body: {
        'photo_urls': photoUrls,
        'quick_field_answers': answers,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        if (plotId != null) 'plot_id': plotId,
      });

  /* ── Planting notices & notifications ────────────────────────────────── */

  Future<List<NoticeSummary>> notices() async => _list(_map(await _api.get(Service.account, '/api/farmer/planting-notices', query: {'page_size': '50'}))['items'], NoticeSummary.fromJson);

  Future<NoticeDetail> notice(String id) async => NoticeDetail.fromJson(_map(await _api.get(Service.account, '/api/farmer/planting-notices/$id')));

  Future<List<PlotOption>> noticePlots(String id) async => _list(await _api.get(Service.account, '/api/farmer/planting-notices/$id/plots'), PlotOption.fromJson);

  Future<String> respondReady(String id, double kg, String plotId) async {
    final b = _map(await _api.post(Service.account, '/api/farmer/planting-notices/$id/respond', body: {'response': 'ready', 'expected_volume_kg': kg, 'plot_id': plotId}));
    return (b['message'] ?? 'Response recorded.').toString();
  }

  Future<void> respondCannot(String id) => _api.post(Service.account, '/api/farmer/planting-notices/$id/respond', body: {'response': 'cannot'});

  Future<({List<AppNotification> items, int unread})> notifications() async {
    final b = _map(await _api.get(Service.account, '/api/farmer/notifications', query: {'page_size': '50'}));
    return (items: _list(b['items'], AppNotification.fromJson), unread: (b['unread_count'] as int?) ?? 0);
  }

  Future<int> unreadCount() async {
    try {
      final b = _map(await _api.get(Service.account, '/api/farmer/notifications', query: {'page_size': '1'}, timeout: const Duration(seconds: 5)));
      return (b['unread_count'] as int?) ?? 0;
    } catch (_) {
      return 0; // the badge disappears rather than erroring
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _api.post(Service.account, '/api/farmer/notifications/$id/read');
    } catch (_) {/* best effort */}
  }
}

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/batch.dart';
import '../models/commitment.dart';
import '../models/plot.dart';
import '../models/protocol.dart';
import '../models/protocol_evaluation.dart';
import 'api_client.dart';
import 'auth_service.dart';

class FarmResult<T> {
  final T? data;
  final String? error;
  FarmResult.ok(this.data) : error = null;
  FarmResult.fail(this.error) : data = null;
  bool get isOk => error == null;
}

class FarmService {
  static Map<String, String> get _authHeaders => {
    'Content-Type': 'application/json',
    if (AuthService.instance.token != null)
      'Authorization': 'Bearer ${AuthService.instance.token}',
  };

  static Future<FarmResult<List<Plot>>> myPlots() async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/plots/me'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Plot.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  // Fallback for when walking the plot isn't practical — a single dropped
  // pin plus an approximate side length. registerPlotWalked (below) is the
  // preferred path; the server tags whichever was used via boundary_source.
  static Future<FarmResult<Plot>> registerPlot({
    required double centerLat,
    required double centerLon,
    required double sideM,
    required String district,
    String? dsd,
    String? gnDivision,
    String plotType = 'open_field',
  }) async {
    return _createPlot({
      'center_lat': centerLat,
      'center_lon': centerLon,
      'side_m': sideM,
      'plot_type': plotType,
      'district': district,
      'dsd': dsd,
      'gn_division': gnDivision,
    });
  }

  // A real surveyed boundary — the farmer walks the edge of the plot and
  // drops a pin at each corner (>=3 points).
  static Future<FarmResult<Plot>> registerPlotWalked({
    required List<Map<String, double>> boundaryPoints,
    required String district,
    String? dsd,
    String? gnDivision,
    String plotType = 'open_field',
  }) async {
    return _createPlot({
      'boundary_points': boundaryPoints,
      'plot_type': plotType,
      'district': district,
      'dsd': dsd,
      'gn_division': gnDivision,
    });
  }

  static Future<FarmResult<Plot>> _createPlot(Map<String, dynamic> body) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/plots'),
            headers: _authHeaders,
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      return FarmResult.ok(
        Plot.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  static Future<FarmResult<Batch>> createBatch({
    required String plotId,
    required String crop,
    String? protocolId,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches'),
            headers: _authHeaders,
            body: jsonEncode({
              'plot_id': plotId,
              'crop': crop,
              'protocol_id': protocolId,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      return FarmResult.ok(
        Batch.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  // Public endpoint (no farmer-specific data) — quality tiers a farmer can
  // choose to grow a batch to, with the instructions attached (B-30).
  static Future<FarmResult<List<ProtocolSummary>>> protocolsForCrop(
    String crop,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/protocols?crop=$crop'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(ProtocolSummary.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  static Future<FarmResult<ProtocolDetail>> protocolDetail(
    String protocolId,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/protocols/$protocolId'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      return FarmResult.ok(
        ProtocolDetail.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  static Future<FarmResult<Batch>> batchByCode(String code) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/by-code/$code'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      return FarmResult.ok(
        Batch.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  // The staged view of a batch's quality standard (B-32/B-33) — which
  // stages are done, due, overdue or standing, and whether the batch
  // currently satisfies the protocol it was registered under.
  static Future<FarmResult<ProtocolEvaluation>> batchSchedule(
    String batchId,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/$batchId/schedule'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      return FarmResult.ok(
        ProtocolEvaluation.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        ),
      );
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  // Public endpoint — open buyer orders a farmer can see before deciding
  // what to grow (B-50 / "connect farmers with buyers"). Only ever shows
  // commitments with volume left to fill.
  static Future<FarmResult<List<Commitment>>> openCommitments({
    String? crop,
  }) async {
    try {
      final uri = Uri.parse('${ApiClient.baseUrl}/api/v1/commitments')
          .replace(queryParameters: crop != null ? {'crop': crop} : null);
      final res = await http
          .get(uri, headers: _authHeaders)
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Commitment.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  // A collector combining several farmers' individually-registered batches
  // into one at the collection point (B-14 lineage, put to use) — see
  // POST /batches/merge on the backend.
  static Future<FarmResult<Batch>> mergeBatches({
    required List<String> parentBatchIds,
    required String crop,
    String? protocolId,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/merge'),
            headers: _authHeaders,
            body: jsonEncode({
              'parent_batch_ids': parentBatchIds,
              'crop': crop,
              'protocol_id': protocolId,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      return FarmResult.ok(
        Batch.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  static Future<FarmResult<List<Batch>>> myBatches() async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/me'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Batch.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }
}

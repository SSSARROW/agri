import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/planting_notice.dart';
import 'auth_service.dart';
import 'farm_service.dart' show FarmResult;

/// Service for farmer planting notices (/api/farmer/planting-notices on web/backend).
/// Allows farmers to browse upcoming planting requests from approved exporters,
/// inspect quality standard stages, and submit 'ready' or 'cannot' responses.
class PlantingNoticesService {
  PlantingNoticesService._();

  static const _baseUrl = String.fromEnvironment(
    'AUTH_BASE_URL',
    defaultValue: 'https://agri-web-backend.onrender.com',
  );

  static Map<String, String> get _authHeaders => {
    'Content-Type': 'application/json',
    if (AuthService.instance.token != null)
      'Authorization': 'Bearer ${AuthService.instance.token}',
  };

  static String _extractError(String body) {
    try {
      final decoded = jsonDecode(body);
      final detail = decoded['detail'];
      if (detail is String && detail.isNotEmpty) return detail;
      if (detail is List && detail.isNotEmpty) {
        // FastAPI validation error list
        final first = detail.first;
        if (first is Map && first['msg'] != null) {
          return first['msg'].toString();
        }
      }
    } catch (_) {}
    return "That didn't work. Please try again.";
  }

  static String _friendlyException(Object e) {
    if (e is TimeoutException) {
      return 'This is taking longer than expected. Check your connection and try again.';
    }
    if (e is SocketException) {
      return "Can't reach the server. Check your connection and try again.";
    }
    return 'Something went wrong. Please try again.';
  }

  /// Lists upcoming planting notices from approved exporters matching the farmer's district.
  static Future<FarmResult<PaginatedPlantingNotices>> listNotices({
    int page = 1,
    int pageSize = 10,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/farmer/planting-notices').replace(
        queryParameters: {
          'page': page.toString(),
          'page_size': pageSize.toString(),
        },
      );
      final res = await http
          .get(uri, headers: _authHeaders)
          .timeout(const Duration(seconds: 10));

      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return FarmResult.ok(PaginatedPlantingNotices.fromJson(body));
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  /// Returns full notice details, public exporter profile, and linked standard stages.
  static Future<FarmResult<PlantingNoticeDetail>> noticeDetail(String id) async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/planting-notices/$id'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));

      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return FarmResult.ok(PlantingNoticeDetail.fromJson(body));
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  /// Lists the farmer's plots that can be chosen for a 'ready' response.
  static Future<FarmResult<List<FarmerNoticePlot>>> noticePlots(String id) async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/planting-notices/$id/plots'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));

      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }

      final items = (jsonDecode(res.body) as List)
          .whereType<Map<String, dynamic>>()
          .map(FarmerNoticePlot.fromJson)
          .toList();
      return FarmResult.ok(items);
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  /// Responds to a planting notice with 'ready' (requires plotId and expectedVolumeKg > 0)
  /// or 'cannot'.
  static Future<FarmResult<NoticeReplyResponse>> respondToNotice({
    required String id,
    required String response,
    double? expectedVolumeKg,
    String? plotId,
  }) async {
    try {
      final Map<String, dynamic> body = {'response': response};
      if (response == 'ready') {
        if (expectedVolumeKg != null) {
          body['expected_volume_kg'] = expectedVolumeKg;
        }
        if (plotId != null) {
          body['plot_id'] = plotId;
        }
      }

      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/planting-notices/$id/respond'),
            headers: _authHeaders,
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 10));

      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return FarmResult.ok(NoticeReplyResponse.fromJson(data));
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }
}

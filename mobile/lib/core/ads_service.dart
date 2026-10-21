import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/ad.dart';
import 'auth_service.dart';
import 'farm_service.dart' show FarmResult;

/// The exporter marketplace (farmer/ads on web/backend, port 8001) — a
/// separate service from FarmService on purpose: it talks to the
/// Supabase-backed auth/business service, not api/, even though both
/// accept the same farmer JWT (see auth_service.dart's own note on this).
class AdsService {
  // Mirrors AuthService's own base URL exactly — farmer/ads lives on the
  // same host as login/signup, not on ApiClient's api/ host.
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
    } catch (_) {
      // Not JSON — fall through to the generic message below.
    }
    return 'That didn\'t work. Please try again.';
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

  static Future<FarmResult<List<AdListItem>>> openAds({String? crop}) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/farmer/ads').replace(
        queryParameters: {
          'page_size': '50',
          if (crop != null) 'crop': crop,
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
      final items = (body['items'] as List)
          .cast<Map<String, dynamic>>()
          .map(AdListItem.fromJson)
          .toList();
      return FarmResult.ok(items);
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<AdDetail>> adDetail(String id) async {
    try {
      final res = await http
          .get(Uri.parse('$_baseUrl/api/farmer/ads/$id'), headers: _authHeaders)
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }
      return FarmResult.ok(
        AdDetail.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<String>> acceptAd({
    required String adId,
    required String adVersionId,
    required double supplyQuantityKg,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/ads/$adId/accept'),
            headers: _authHeaders,
            body: jsonEncode({
              'ad_version_id': adVersionId,
              'supply_quantity_kg': supplyQuantityKg,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return FarmResult.ok(body['message'] as String? ?? 'Application sent.');
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<bool>> withdrawAcceptance(String adId) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/ads/$adId/withdraw'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }
      return FarmResult.ok(true);
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<List<MyAdAcceptance>>> myAcceptances() async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/ads/my-acceptances'),
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
      final items = (body['items'] as List)
          .cast<Map<String, dynamic>>()
          .map(MyAdAcceptance.fromJson)
          .toList();
      return FarmResult.ok(items);
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }
}

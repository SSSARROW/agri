import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/exporter_link.dart';
import 'auth_service.dart';
import 'farm_service.dart' show FarmResult;

/// The long-term farmer-exporter relationship (farmer/exporter-link on
/// web/backend, same host as AdsService) — browsing verified exporters,
/// requesting to follow one's standard, checking the farmer's current
/// relationship, and cancelling a pending request.
class ExporterLinkService {
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

  static Future<FarmResult<List<VerifiedExporter>>> verifiedExporters() async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/exporter-link/exporters'),
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
          .cast<Map<String, dynamic>>()
          .map(VerifiedExporter.fromJson)
          .toList();
      return FarmResult.ok(items);
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<FarmerExporterLink?>> currentLink() async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/exporter-link/current'),
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
      if (body['has_active_link'] != true || body['link'] == null) {
        return FarmResult.ok(null);
      }
      return FarmResult.ok(
        FarmerExporterLink.fromJson(body['link'] as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<FarmerExporterLink>> requestLink(
    String exporterProfileId,
  ) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/exporter-link/request'),
            headers: _authHeaders,
            body: jsonEncode({'exporter_profile_id': exporterProfileId}),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }
      return FarmResult.ok(
        FarmerExporterLink.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        ),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<bool>> cancelRequest() async {
    try {
      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/exporter-link/cancel'),
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
}

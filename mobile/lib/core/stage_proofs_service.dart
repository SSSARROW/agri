import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/stage_proof.dart';
import 'auth_service.dart';
import 'farm_service.dart' show FarmResult;

/// Stage-proof photo verification (farmer/stage-proofs on web/backend, same
/// host as AdsService/ExporterLinkService) — once a farmer has an approved
/// exporter relationship, they submit photo proof per quality-standard
/// stage for that exporter to manually review. Photos themselves are
/// uploaded to api/'s own photo endpoint first (see FarmService.
/// uploadPlotPhoto) — this service only ever sends the resulting URLs.
class StageProofsService {
  static const _baseUrl = String.fromEnvironment(
    'AUTH_BASE_URL',
    defaultValue: 'http://10.0.2.2:8001',
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

  static Future<FarmResult<FarmerStandardsResponse>> myStandards() async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/stage-proofs/standards'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }
      return FarmResult.ok(
        FarmerStandardsResponse.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        ),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<SubmissionOut>> submitProof({
    required String stageId,
    required List<String> photoUrls,
    Map<String, dynamic> quickFieldAnswers = const {},
    String? note,
    String? plotId,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/stage-proofs/$stageId/submit'),
            headers: _authHeaders,
            body: jsonEncode({
              'photo_urls': photoUrls,
              'quick_field_answers': quickFieldAnswers,
              if (note != null && note.isNotEmpty) 'note': note,
              if (plotId != null) 'plot_id': plotId,
            }),
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) {
        return FarmResult.fail(
          _extractError(res.body),
          statusCode: res.statusCode,
        );
      }
      return FarmResult.ok(
        SubmissionOut.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<List<SubmissionOut>>> mySubmissions() async {
    try {
      final res = await http
          .get(
            Uri.parse('$_baseUrl/api/farmer/stage-proofs/my-submissions'),
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
          .map(SubmissionOut.fromJson)
          .toList();
      return FarmResult.ok(items);
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }
}

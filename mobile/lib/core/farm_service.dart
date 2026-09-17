import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/batch.dart';
import '../models/plot.dart';
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
        if (AuthService.instance.token != null) 'Authorization': 'Bearer ${AuthService.instance.token}',
      };

  static Future<FarmResult<List<Plot>>> myPlots() async {
    try {
      final res = await http
          .get(Uri.parse('${ApiClient.baseUrl}/api/v1/plots/me'), headers: _authHeaders)
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Plot.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  static Future<FarmResult<Plot>> registerPlot({
    required double centerLat,
    required double centerLon,
    required double sideM,
    required String district,
    String? dsd,
    String? gnDivision,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/plots'),
            headers: _authHeaders,
            body: jsonEncode({
              'center_lat': centerLat,
              'center_lon': centerLon,
              'side_m': sideM,
              'district': district,
              'dsd': dsd,
              'gn_division': gnDivision,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      return FarmResult.ok(Plot.fromJson(jsonDecode(res.body) as Map<String, dynamic>));
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }

  static Future<FarmResult<List<Batch>>> myBatches() async {
    try {
      final res = await http
          .get(Uri.parse('${ApiClient.baseUrl}/api/v1/batches/me'), headers: _authHeaders)
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) return FarmResult.fail('HTTP ${res.statusCode}: ${res.body}');
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Batch.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(e.toString());
    }
  }
}

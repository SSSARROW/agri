import 'dart:convert';

import 'package:http/http.dart' as http;

class HealthResult {
  final bool ok;
  final String detail;
  HealthResult(this.ok, this.detail);
}

class ApiClient {
  // Defaults to the deployed api/ so a plain build (no --dart-define) still
  // produces working QR codes and real connectivity out of the box - local
  // and deployed share the same Supabase database, so there's no
  // wrong-environment risk either way. Override with
  // --dart-define=API_BASE_URL=http://10.0.2.2:8000 (the Android emulator's
  // alias for the host machine) for fast local-only iteration instead.
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://agri-api-6ymr.onrender.com',
  );

  static Future<HealthResult> checkHealth() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/health'))
          .timeout(const Duration(seconds: 5));
      if (res.statusCode != 200) {
        return HealthResult(false, 'HTTP ${res.statusCode}');
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return HealthResult(data['status'] == 'ok', res.body);
    } catch (e) {
      return HealthResult(false, e.toString());
    }
  }
}

import 'dart:convert';

import 'package:http/http.dart' as http;

class HealthResult {
  final bool ok;
  final String detail;
  HealthResult(this.ok, this.detail);
}

class ApiClient {
  // 10.0.2.2 is the Android emulator's alias for the host machine's localhost,
  // which is where the FastAPI dev server runs.
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
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

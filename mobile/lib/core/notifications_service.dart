import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/farmer_notification.dart';
import 'auth_service.dart';
import 'farm_service.dart' show FarmResult;

/// Service for farmer in-app notification centre (/api/farmer/notifications).
class NotificationsService {
  NotificationsService._();

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
      if (detail is List && detail.isNotEmpty) {
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

  /// Lists farmer notifications delivered to this account ordered newest first.
  static Future<FarmResult<PaginatedFarmerNotifications>> listNotifications({
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/farmer/notifications').replace(
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
      return FarmResult.ok(PaginatedFarmerNotifications.fromJson(body));
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  /// Fetches the unread count silently. If offline or error, returns 0 so
  /// the host badge hides cleanly without error states.
  static Future<int> getUnreadCount() async {
    try {
      if (AuthService.instance.token == null) return 0;
      final uri = Uri.parse('$_baseUrl/api/farmer/notifications').replace(
        queryParameters: {'page': '1', 'page_size': '1'},
      );
      final res = await http
          .get(uri, headers: _authHeaders)
          .timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        return (body['unread_count'] as num?)?.toInt() ?? 0;
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  /// Marks a single notification as read (idempotent).
  static Future<FarmResult<bool>> markRead(String notificationId) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_baseUrl/api/farmer/notifications/$notificationId/read'),
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

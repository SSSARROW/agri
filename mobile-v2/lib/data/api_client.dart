import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;

import '../core/config.dart';
import 'session.dart';

enum Service { field, account }

class ApiException implements Exception {
  final String message;
  final int? status;
  final bool offline;
  const ApiException(this.message, {this.status, this.offline = false});

  bool get unauthorized => status == 401;
  bool get forbidden => status == 403;

  /// A rejection the server will keep giving, so retrying is pointless.
  bool get permanent => status != null && status! >= 400 && status! < 500 && status != 401 && status != 408 && status != 429;

  @override
  String toString() => message;
}

/// One HTTP client for both back-ends. Both accept the same bearer token but
/// report errors in different shapes, which this class flattens into one message.
class ApiClient {
  ApiClient(this._session);
  final Session _session;
  final http.Client _http = http.Client();

  static const _read = Duration(seconds: 10);
  static const _upload = Duration(seconds: 30);

  Uri _uri(Service s, String path, [Map<String, String?>? query]) {
    final base = s == Service.field ? Config.fieldApi : Config.accountApi;
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && v.isNotEmpty) q[k] = v;
    });
    return Uri.parse('$base$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_session.token != null) 'Authorization': 'Bearer ${_session.token}',
      };

  Future<dynamic> get(Service s, String path, {Map<String, String?>? query, Duration timeout = _read}) =>
      _send(() => _http.get(_uri(s, path, query), headers: _headers()), timeout);

  Future<dynamic> post(Service s, String path, {Object? body, Duration timeout = _read}) =>
      _send(() => _http.post(_uri(s, path), headers: _headers(), body: body == null ? null : jsonEncode(body)), timeout, isAuth: path.startsWith('/auth/'));

  Future<dynamic> patch(Service s, String path, {Object? body}) =>
      _send(() => _http.patch(_uri(s, path), headers: _headers(), body: body == null ? null : jsonEncode(body)), _read);

  Future<dynamic> multipart(Service s, String path, {required Map<String, String> fields, required String filePath}) async {
    return _send(() async {
      final req = http.MultipartRequest('POST', _uri(s, path))
        ..headers.addAll(_headers(json: false))
        ..fields.addAll(fields);
      final lower = filePath.toLowerCase();
      final type = lower.endsWith('.png') ? 'png' : (lower.endsWith('.webp') ? 'webp' : 'jpeg');
      req.files.add(await http.MultipartFile.fromPath('file', filePath, contentType: MediaType('image', type)));
      return http.Response.fromStream(await _http.send(req));
    }, _upload);
  }

  Future<dynamic> _send(Future<http.Response> Function() call, Duration timeout, {bool isAuth = false}) async {
    http.Response res;
    try {
      res = await call().timeout(timeout);
    } on TimeoutException {
      throw const ApiException('This is taking longer than expected. Check your signal and try again.', offline: true);
    } on SocketException {
      throw const ApiException("Can't reach the server. Check your connection and try again.", offline: true);
    } on http.ClientException {
      throw const ApiException("Can't reach the server. Check your connection and try again.", offline: true);
    } on HandshakeException {
      throw const ApiException("Can't reach the server securely. Check your connection and try again.", offline: true);
    }

    final dynamic body = res.body.isEmpty ? null : _tryJson(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    // A wrong password on the sign-in form is not an expired session: show the server's own message.
    if (res.statusCode == 401 && !isAuth) {
      _session.markExpired();
      throw const ApiException('Your session needs refreshing. Sign in again to continue. Anything already recorded is safe.', status: 401);
    }
    if (res.statusCode >= 500) {
      throw ApiException('Something went wrong on our end. Please try again shortly.', status: res.statusCode);
    }
    throw ApiException(_message(body) ?? 'Request failed (${res.statusCode}).', status: res.statusCode);
  }

  dynamic _tryJson(String s) {
    try {
      return jsonDecode(s);
    } catch (_) {
      return null;
    }
  }

  String? _message(dynamic body) {
    if (body is! Map) return null;
    final err = body['error'];
    if (err is Map && err['message'] is String) return err['message'];
    final detail = body['detail'];
    if (detail is String) return detail;
    if (detail is List) {
      final msgs = detail.whereType<Map>().map((e) => (e['msg'] ?? '').toString().replaceFirst('Value error, ', '')).where((m) => m.isNotEmpty);
      if (msgs.isNotEmpty) return msgs.take(2).join(' · ');
    }
    return null;
  }
}

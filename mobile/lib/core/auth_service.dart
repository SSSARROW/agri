import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AuthResult {
  final bool ok;
  final String? error;
  AuthResult(this.ok, [this.error]);
}

/// Talks to the separate web/backend auth service (Supabase-backed, owned by
/// the auth team) — not our own api/ service. They share only a JWT secret,
/// verified locally by api/ (see app/core/auth.py) rather than over the wire.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const _authBaseUrl = String.fromEnvironment(
    'AUTH_BASE_URL',
    defaultValue: 'http://10.0.2.2:8001',
  );

  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'auth_token';
  static const _userIdKey = 'auth_user_id';
  static const _roleKey = 'auth_role';
  static const _pinHashKey = 'pin_hash';
  static const _pinSaltKey = 'pin_salt';

  String? _token;
  String? _userId;
  String? _role;
  String? _pinHash;
  String? _pinSalt;

  /// A stored token means there's a session on this device at all — not
  /// necessarily one the server would still accept (see [isUnlocked] and
  /// M-07: the whole point is that a farmer with no signal for weeks must
  /// still be able to open the app and keep capturing).
  bool get isLoggedIn => _token != null;
  bool get hasPin => _pinHash != null;
  String? get token => _token;
  String? get userId => _userId;
  String? get role => _role;

  Future<void> restore() async {
    _token = await _storage.read(key: _tokenKey);
    _userId = await _storage.read(key: _userIdKey);
    _role = await _storage.read(key: _roleKey);
    _pinHash = await _storage.read(key: _pinHashKey);
    _pinSalt = await _storage.read(key: _pinSaltKey);
  }

  Future<void> setPin(String pin) async {
    final salt = _randomSalt();
    final hash = _hashPin(pin, salt);
    _pinSalt = salt;
    _pinHash = hash;
    await _storage.write(key: _pinSaltKey, value: salt);
    await _storage.write(key: _pinHashKey, value: hash);
  }

  bool verifyPin(String pin) {
    if (_pinHash == null || _pinSalt == null) return false;
    return _hashPin(pin, _pinSalt!) == _pinHash;
  }

  String _randomSalt() {
    final rand = Random.secure();
    return base64Url.encode(List<int>.generate(16, (_) => rand.nextInt(256)));
  }

  String _hashPin(String pin, String salt) =>
      sha256.convert(utf8.encode('$salt:$pin')).toString();

  Future<AuthResult> login(String email, String password) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_authBaseUrl/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return AuthResult(false, _extractError(res.body));
      }
      await _storeSession(jsonDecode(res.body) as Map<String, dynamic>);
      return AuthResult(true);
    } catch (e) {
      return AuthResult(false, _friendlyException(e));
    }
  }

  Future<AuthResult> signupFarmer({
    required String email,
    required String password,
    required String name,
    required String phone,
    required String nic,
    required String district,
    required String dsd,
    required String gnDivision,
    required String farmAddress,
    required double farmSizeHa,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_authBaseUrl/auth/signup/farmer'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email,
              'password': password,
              'name': name,
              'phone': phone,
              'nic': nic,
              'district': district,
              'dsd': dsd,
              'gn_division': gnDivision,
              'farm_address': farmAddress,
              'farm_size_ha': farmSizeHa,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return AuthResult(false, _extractError(res.body));
      }
      await _storeSession(jsonDecode(res.body) as Map<String, dynamic>);
      return AuthResult(true);
    } catch (e) {
      return AuthResult(false, _friendlyException(e));
    }
  }

  Future<AuthResult> signupCollector({
    required String email,
    required String password,
    required String name,
    required String phone,
    required String nic,
    required String district,
    required String dsd,
    required String gnDivision,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_authBaseUrl/auth/signup/collector'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email,
              'password': password,
              'name': name,
              'phone': phone,
              'nic': nic,
              'district': district,
              'dsd': dsd,
              'gn_division': gnDivision,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return AuthResult(false, _extractError(res.body));
      }
      await _storeSession(jsonDecode(res.body) as Map<String, dynamic>);
      return AuthResult(true);
    } catch (e) {
      return AuthResult(false, _friendlyException(e));
    }
  }

  Future<void> _storeSession(Map<String, dynamic> body) async {
    final token = body['access_token'] as String;
    final role = body['role'] as String;
    final userId = _userIdFromJwt(token);
    _token = token;
    _role = role;
    _userId = userId;
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _roleKey, value: role);
    if (userId != null) await _storage.write(key: _userIdKey, value: userId);
  }

  /// Decodes the JWT payload locally just to read `sub` — no signature
  /// verification needed client-side, the server verifies it on every call.
  String? _userIdFromJwt(String token) {
    try {
      final parts = token.split('.');
      var payload = parts[1];
      payload = payload.padRight((payload.length + 3) ~/ 4 * 4, '=');
      final decoded = jsonDecode(
        utf8.decode(base64Url.decode(payload)),
      ) as Map<String, dynamic>;
      return decoded['sub'] as String?;
    } catch (_) {
      return null;
    }
  }

  String _friendlyException(Object e) {
    if (e is TimeoutException) {
      return 'This is taking longer than expected. Check your connection and try again.';
    }
    if (e is SocketException) {
      return "Can't reach the server. Check your connection and try again.";
    }
    return 'Something went wrong. Please try again.';
  }

  String _extractError(String body) {
    try {
      final decoded = jsonDecode(body);
      final detail = decoded['detail'];
      if (detail is String && detail.isNotEmpty) return detail;
    } catch (_) {
      // Not JSON — fall through to the generic message below.
    }
    return 'That didn\'t work. Please try again.';
  }

  Future<void> logout() async {
    _token = null;
    _userId = null;
    _role = null;
    await _storage.deleteAll();
  }
}

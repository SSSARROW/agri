import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum AuthStage { booting, signedOut, pinSetup, locked, ready }

class PinResult {
  final bool ok;
  final Duration? lockedFor;
  final int attemptsLeft;
  const PinResult({required this.ok, this.lockedFor, this.attemptsLeft = 0});
}

/// Credentials and unlock state. Everything sensitive lives in secure storage.
class Session extends ChangeNotifier {
  static const _store = FlutterSecureStorage(aOptions: AndroidOptions());
  static const _maxFreeAttempts = 5;

  AuthStage stage = AuthStage.booting;
  String? token, userId, role, lastEmail;

  /// True once the server refused our token. The app keeps working offline,
  /// but sync is paused and a banner asks the person to sign in again.
  bool tokenExpired = false;

  bool get isCollector => role == 'collector';
  bool get isFarmer => role == 'farmer';
  bool get roleSupported => isFarmer || isCollector;

  Future<void> init() async {
    token = await _store.read(key: 'token');
    userId = await _store.read(key: 'user_id');
    role = await _store.read(key: 'role');
    lastEmail = await _store.read(key: 'last_email');
    if (token == null) {
      stage = AuthStage.signedOut;
    } else {
      final hasPin = (await _store.read(key: 'pin_hash')) != null;
      stage = hasPin ? AuthStage.locked : AuthStage.pinSetup;
    }
    notifyListeners();
  }

  /// Called after a successful email sign-in or sign-up.
  Future<void> signedIn({required String accessToken, required String role, required String email}) async {
    final previousUser = userId;
    token = accessToken;
    this.role = role;
    userId = _subOf(accessToken);
    lastEmail = email;
    tokenExpired = false;
    await _store.write(key: 'token', value: accessToken);
    await _store.write(key: 'role', value: role);
    await _store.write(key: 'last_email', value: email);
    if (userId != null) await _store.write(key: 'user_id', value: userId);

    if (previousUser != null && previousUser == userId && stage == AuthStage.ready) {
      // Re-authentication while using the app: keep going exactly where we were.
      notifyListeners();
      return;
    }
    stage = AuthStage.pinSetup;
    notifyListeners();
  }

  static String? _subOf(String jwt) {
    try {
      final parts = jwt.split('.');
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      return (jsonDecode(payload) as Map)['sub']?.toString();
    } catch (_) {
      return null;
    }
  }

  void markExpired() {
    if (!tokenExpired) {
      tokenExpired = true;
      notifyListeners();
    }
  }

  /* ── PIN ──────────────────────────────────────────────────────────────── */

  static String _hash(String salt, String pin) => sha256.convert(utf8.encode('$salt:$pin')).toString();

  Future<void> setPin(String pin) async {
    final rnd = Random.secure();
    final salt = base64UrlEncode(List<int>.generate(16, (_) => rnd.nextInt(256)));
    await _store.write(key: 'pin_salt', value: salt);
    await _store.write(key: 'pin_hash', value: _hash(salt, pin));
    await _store.write(key: 'pin_fails', value: '0');
    await _store.delete(key: 'pin_locked_until');
    stage = AuthStage.ready;
    notifyListeners();
  }

  Future<bool> hasPin() async => (await _store.read(key: 'pin_hash')) != null;

  /// Skipping only applies to this launch; the app asks again next time.
  void skipPin() {
    stage = AuthStage.ready;
    notifyListeners();
  }

  Future<Duration?> lockRemaining() async {
    final raw = await _store.read(key: 'pin_locked_until');
    final until = raw == null ? null : DateTime.tryParse(raw);
    if (until == null) return null;
    final left = until.difference(DateTime.now());
    return left.isNegative ? null : left;
  }

  /// Wrong PINs slow down after five tries so a found phone can't be guessed open.
  Future<PinResult> unlock(String pin) async {
    final left = await lockRemaining();
    if (left != null) return PinResult(ok: false, lockedFor: left);
    final salt = await _store.read(key: 'pin_salt');
    final hash = await _store.read(key: 'pin_hash');
    if (salt != null && hash == _hash(salt, pin)) {
      await _store.write(key: 'pin_fails', value: '0');
      stage = AuthStage.ready;
      notifyListeners();
      return const PinResult(ok: true);
    }
    final fails = (int.tryParse(await _store.read(key: 'pin_fails') ?? '0') ?? 0) + 1;
    await _store.write(key: 'pin_fails', value: '$fails');
    if (fails >= _maxFreeAttempts) {
      final secs = min(900, 30 * pow(2, fails - _maxFreeAttempts).toInt());
      await _store.write(key: 'pin_locked_until', value: DateTime.now().add(Duration(seconds: secs)).toIso8601String());
      return PinResult(ok: false, lockedFor: Duration(seconds: secs));
    }
    return PinResult(ok: false, attemptsLeft: _maxFreeAttempts - fails);
  }

  /// Forgetting a PIN means signing in again. Recorded data stays queued on the device.
  Future<void> logout() async {
    for (final k in ['token', 'user_id', 'role', 'pin_hash', 'pin_salt', 'pin_fails', 'pin_locked_until']) {
      await _store.delete(key: k);
    }
    token = null;
    userId = null;
    role = null;
    tokenExpired = false;
    stage = AuthStage.signedOut;
    notifyListeners();
  }
}

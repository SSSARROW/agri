/// Server addresses come from --dart-define so the same build script can point
/// at an emulator host, a LAN machine or production.
class Config {
  /// Field-data service: plots, batches, events, photos, protocols.
  static const fieldApi = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:8000');

  /// Account & marketplace service: sign-in, orders, links, proof, notices.
  static const accountApi = String.fromEnvironment('AUTH_BASE_URL', defaultValue: 'http://10.0.2.2:8001');

  /// QR labels encode this address, so it must be reachable by a consumer's camera app.
  static String publicBatchUrl(String code) => '$fieldApi/p/$code';

  /// A label printed from a build that points at a private address will not open for buyers.
  static bool get qrIsPublic {
    final host = Uri.tryParse(fieldApi)?.host ?? '';
    if (host == 'localhost' || host == '10.0.2.2' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) return false;
    return true;
  }
}

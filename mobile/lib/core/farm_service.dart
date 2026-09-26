import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:uuid/uuid.dart';

import '../models/batch.dart';
import '../models/commitment.dart';
import '../models/photo_schedule.dart';
import '../models/plot.dart';
import '../models/plot_photo.dart';
import '../models/protocol.dart';
import '../models/protocol_evaluation.dart';
import '../models/user_profile.dart';
import 'api_client.dart';
import 'auth_service.dart';

class FarmResult<T> {
  final T? data;
  final String? error;
  // The HTTP status that produced this failure, when there was one (a
  // timeout or connection failure has none) — lets callers branch on the
  // actual status instead of pattern-matching the human-readable message.
  final int? statusCode;
  FarmResult.ok(this.data) : error = null, statusCode = null;
  FarmResult.fail(this.error, {this.statusCode}) : data = null;
  bool get isOk => error == null;
}

class PhotoUploadResult {
  final String photoUrl;
  // Null when no GPS fix was available at capture time — not itself
  // suspicious (see location_service.dart's known failure modes).
  final double? distanceFromPlotM;
  final bool locationFlagged;
  PhotoUploadResult({
    required this.photoUrl,
    required this.distanceFromPlotM,
    required this.locationFlagged,
  });
}

class FarmService {
  // The API always fails with {"error": {"code", "message", "details"}}
  // (see api/app/core/errors.py) and "message" is already written for a
  // human to read, so surface that instead of the raw HTTP body — only
  // falling back to a generic line if the response isn't shaped that way
  // (e.g. a proxy timeout page instead of a JSON response).
  static String _friendlyError(http.Response res) {
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['error'] is Map) {
        final message = body['error']['message'];
        if (message is String && message.isNotEmpty) return message;
      }
    } catch (_) {
      // Not JSON — fall through to the generic message below.
    }
    if (res.statusCode >= 500) {
      return "Something went wrong on our end. Please try again shortly.";
    }
    return "That didn't work (error ${res.statusCode}). Please try again.";
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

  static Map<String, String> get _authHeaders => {
    'Content-Type': 'application/json',
    if (AuthService.instance.token != null)
      'Authorization': 'Bearer ${AuthService.instance.token}',
  };

  static Future<FarmResult<List<Plot>>> myPlots() async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/plots/me'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Plot.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // A geotagged, timestamped field photo — captured live (never from the
  // gallery, see the camera-only picker call sites) so it's at least harder
  // to fake than a checkbox, even though it's still self-reported rather
  // than independently verified. event_type is "plot_photo" (at
  // registration) or "progress_photo" (during the growing cycle).
  static Future<FarmResult<PhotoUploadResult>> uploadPlotPhoto({
    required String plotId,
    required String eventType,
    required File imageFile,
    String? caption,
    double? lat,
    double? lon,
  }) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiClient.baseUrl}/api/v1/photos'),
      );
      if (AuthService.instance.token != null) {
        request.headers['Authorization'] =
            'Bearer ${AuthService.instance.token}';
      }
      request.fields['plot_id'] = plotId;
      request.fields['event_type'] = eventType;
      request.fields['event_id'] = const Uuid().v4();
      if (caption != null && caption.isNotEmpty) {
        request.fields['caption'] = caption;
      }
      // Lets the server flag a photo taken somewhere other than the plot it
      // claims to document — GPS is best-effort, so this is sent when
      // available rather than required to take the photo at all.
      if (lat != null && lon != null) {
        request.fields['lat'] = lat.toString();
        request.fields['lon'] = lon.toString();
      }
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          imageFile.path,
          // fromPath leaves this as application/octet-stream otherwise —
          // the server checks the declared content type, not the bytes.
          contentType: MediaType('image', _extensionSubtype(imageFile.path)),
        ),
      );
      final streamed = await request.send().timeout(
        const Duration(seconds: 30),
      );
      final res = await http.Response.fromStream(streamed);
      if (res.statusCode != 201) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      final payload =
          (jsonDecode(res.body) as Map<String, dynamic>)['payload']
              as Map<String, dynamic>;
      return FarmResult.ok(
        PhotoUploadResult(
          photoUrl: payload['photo_url'] as String,
          distanceFromPlotM: (payload['distance_from_plot_m'] as num?)
              ?.toDouble(),
          locationFlagged: payload['location_flagged'] as bool? ?? false,
        ),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // image_picker's camera capture produces .jpg on Android/iOS — this only
  // needs to handle that plus the two other types the server accepts.
  static String _extensionSubtype(String path) {
    final ext = path.split('.').last.toLowerCase();
    return switch (ext) {
      'png' => 'png',
      'webp' => 'webp',
      _ => 'jpeg',
    };
  }

  // Which progress-photo checkpoints are done, overdue or upcoming since
  // planting (see api/app/api/routes/photos.py's schedule endpoint).
  static Future<FarmResult<PlotPhotoSchedule>> plotPhotoSchedule(
    String plotId,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse(
              '${ApiClient.baseUrl}/api/v1/photos/schedule?plot_id=$plotId',
            ),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        PlotPhotoSchedule.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        ),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // Every plot_photo/progress_photo taken of a plot, newest first — for the
  // plot detail page's photo gallery.
  static Future<FarmResult<List<PlotPhoto>>> plotPhotos(String plotId) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/photos?plot_id=$plotId'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(PlotPhoto.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // A real surveyed boundary — the farmer walks the edge of the plot and
  // drops a pin at each corner (>=3 points).
  static Future<FarmResult<Plot>> registerPlotWalked({
    required List<Map<String, double>> boundaryPoints,
    required String district,
    String? dsd,
    String? gnDivision,
    String plotType = 'open_field',
    String? name,
    String boundarySource = 'walked',
  }) async {
    return _createPlot({
      'name': name,
      'boundary_source': boundarySource,
      'boundary_points': boundaryPoints,
      'plot_type': plotType,
      'district': district,
      'dsd': dsd,
      'gn_division': gnDivision,
    });
  }

  static Future<FarmResult<Plot>> renamePlot(
    String plotId,
    String? name,
  ) async {
    try {
      final res = await http
          .patch(
            Uri.parse('${ApiClient.baseUrl}/api/v1/plots/$plotId'),
            headers: _authHeaders,
            body: jsonEncode({'name': name}),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        Plot.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<Plot>> _createPlot(Map<String, dynamic> body) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/plots'),
            headers: _authHeaders,
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        Plot.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<Batch>> createBatch({
    required String plotId,
    required String crop,
    String? protocolId,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches'),
            headers: _authHeaders,
            body: jsonEncode({
              'plot_id': plotId,
              'crop': crop,
              'protocol_id': protocolId,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        Batch.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // Public endpoint (no farmer-specific data) — quality tiers a farmer can
  // choose to grow a batch to, with the instructions attached (B-30).
  static Future<FarmResult<List<ProtocolSummary>>> protocolsForCrop(
    String crop,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/protocols?crop=$crop'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(ProtocolSummary.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<ProtocolDetail>> protocolDetail(
    String protocolId,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/protocols/$protocolId'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        ProtocolDetail.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<Batch>> batchByCode(String code) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/by-code/$code'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        Batch.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // The staged view of a batch's quality standard (B-32/B-33) — which
  // stages are done, due, overdue or standing, and whether the batch
  // currently satisfies the protocol it was registered under.
  static Future<FarmResult<ProtocolEvaluation>> batchSchedule(
    String batchId,
  ) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/$batchId/schedule'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        ProtocolEvaluation.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        ),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // Public endpoint — open buyer orders a farmer can see before deciding
  // what to grow (B-50 / "connect farmers with buyers"). Only ever shows
  // commitments with volume left to fill.
  static Future<FarmResult<List<Commitment>>> openCommitments({
    String? crop,
  }) async {
    try {
      final uri = Uri.parse('${ApiClient.baseUrl}/api/v1/commitments')
          .replace(queryParameters: crop != null ? {'crop': crop} : null);
      final res = await http
          .get(uri, headers: _authHeaders)
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Commitment.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // A collector combining several farmers' individually-registered batches
  // into one at the collection point (B-14 lineage, put to use) — see
  // POST /batches/merge on the backend.
  static Future<FarmResult<Batch>> mergeBatches({
    required List<String> parentBatchIds,
    required String crop,
    String? protocolId,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/merge'),
            headers: _authHeaders,
            body: jsonEncode({
              'parent_batch_ids': parentBatchIds,
              'crop': crop,
              'protocol_id': protocolId,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 201) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        Batch.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  static Future<FarmResult<List<Batch>>> myBatches() async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/batches/me'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
      return FarmResult.ok(list.map(Batch.fromJson).toList());
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }

  // The signed-in user's own profile — for the Settings screen.
  static Future<FarmResult<UserProfile>> myProfile() async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiClient.baseUrl}/api/v1/users/me'),
            headers: _authHeaders,
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode != 200) {
        return FarmResult.fail(_friendlyError(res), statusCode: res.statusCode);
      }
      return FarmResult.ok(
        UserProfile.fromJson(jsonDecode(res.body) as Map<String, dynamic>),
      );
    } catch (e) {
      return FarmResult.fail(_friendlyException(e));
    }
  }
}

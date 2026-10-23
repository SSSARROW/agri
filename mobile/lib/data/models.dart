import '../core/format.dart' show titleCase;
import '../core/geo.dart';

double? _d(dynamic v) => v == null ? null : (v as num).toDouble();
List<String> _sl(dynamic v) => (v as List?)?.map((e) => e.toString()).toList() ?? const [];
Map<String, dynamic> _m(dynamic v) => (v as Map?)?.cast<String, dynamic>() ?? const {};

/// Picks the device-language text with English fallback, then the first available.
String pickText(dynamic v, {String lang = 'en'}) {
  final m = _m(v);
  if ((m[lang] ?? '').toString().trim().isNotEmpty) return m[lang].toString();
  if ((m['en'] ?? '').toString().trim().isNotEmpty) return m['en'].toString();
  for (final e in m.values) {
    if (e != null && e.toString().trim().isNotEmpty) return e.toString();
  }
  return '';
}

/* ── Field data ─────────────────────────────────────────────────────────── */

class Planting {
  final String crop;
  final DateTime? plantedAt;
  final double? areaHa;
  final String? protocolId;
  final String? protocolName;
  Planting.fromJson(Map<String, dynamic> j)
      : crop = j['crop'] ?? '',
        plantedAt = DateTime.tryParse('${j['planted_at']}')?.toLocal(),
        areaHa = _d(j['area_ha']),
        protocolId = j['protocol_id'],
        protocolName = j['protocol_name'];
}

class Plot {
  final String id;
  final double centerLat, centerLon;
  final double? areaHa;
  final String boundarySource;
  final String plotType;
  final String? name, district, dsd, gnDivision;
  final List<Planting> plantings;
  final DateTime? createdAt;

  Plot.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        centerLat = _d(j['center_lat']) ?? 0,
        centerLon = _d(j['center_lon']) ?? 0,
        areaHa = _d(j['area_ha']),
        boundarySource = j['boundary_source'] ?? 'walked',
        plotType = j['plot_type'] ?? 'open_field',
        name = (j['name'] as String?)?.trim().isEmpty == true ? null : j['name'],
        district = j['district'],
        dsd = j['dsd'],
        gnDivision = j['gn_division'],
        plantings = ((j['plantings'] as List?) ?? const []).map((e) => Planting.fromJson(_m(e))).toList(),
        createdAt = DateTime.tryParse('${j['created_at']}')?.toLocal();

  bool get measured => boundarySource != 'estimated_square';
  String get location => [gnDivision, dsd, district].where((e) => e != null && e.isNotEmpty).join(', ');
  String get displayName {
    if (name != null) return name!;
    final a = areaHa;
    final when = createdAt;
    return 'Plot${a != null ? ' · ${a < 0.01 ? '${(a * 10000).round()} m²' : '${a.toStringAsFixed(2)} ha'}' : ''}${when != null ? ' · added ${when.day}/${when.month}/${when.year}' : ''}';
  }
}

class Checkpoint {
  final int sequence;
  final DateTime? due;
  final bool satisfied;
  final String status; // done | overdue | upcoming
  Checkpoint.fromJson(Map<String, dynamic> j)
      : sequence = j['sequence'] ?? 0,
        due = DateTime.tryParse('${j['due_date']}')?.toLocal(),
        satisfied = j['satisfied'] == true,
        status = j['status'] ?? 'upcoming';
}

class PhotoSchedule {
  final bool hasRegistrationPhoto;
  final DateTime? plantedAt;
  final int intervalDays;
  final List<Checkpoint> checkpoints;
  PhotoSchedule.fromJson(Map<String, dynamic> j)
      : hasRegistrationPhoto = j['has_registration_photo'] == true,
        plantedAt = DateTime.tryParse('${j['planted_at']}')?.toLocal(),
        intervalDays = j['interval_days'] ?? 30,
        checkpoints = ((j['checkpoints'] as List?) ?? const []).map((e) => Checkpoint.fromJson(_m(e))).toList();

  Checkpoint? get overdue => checkpoints.where((c) => c.status == 'overdue').firstOrNull;
  Checkpoint? get nextDue => checkpoints.where((c) => c.status == 'upcoming').firstOrNull;
}

class Commitment {
  final String id, crop;
  final double volumeKg, remainingKg;
  final DateTime? windowStart, windowEnd;
  final double? price;
  Commitment.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        crop = j['crop'] ?? '',
        volumeKg = _d(j['volume_kg']) ?? 0,
        remainingKg = _d(j['remaining_kg']) ?? 0,
        windowStart = DateTime.tryParse('${j['delivery_window_start']}')?.toLocal(),
        windowEnd = DateTime.tryParse('${j['delivery_window_end']}')?.toLocal(),
        price = _d(j['indicative_price_lkr_per_kg']);
}

class Batch {
  final String id, code, crop;
  final String? plotId, protocolId, protocolName;
  final Commitment? commitment;
  final DateTime? createdAt, latestAt;
  final String latestStatus;
  Batch.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        code = j['code'],
        crop = j['crop'] ?? '',
        plotId = j['plot_id'],
        protocolId = j['protocol_id'],
        protocolName = j['protocol_name'],
        commitment = j['commitment'] == null ? null : Commitment.fromJson(_m(j['commitment'])),
        createdAt = DateTime.tryParse('${j['created_at']}')?.toLocal(),
        latestAt = DateTime.tryParse('${j['latest_occurred_at']}')?.toLocal(),
        latestStatus = j['latest_status'] ?? 'registered';

  /// Where the batch is in its journey.
  String get journey {
    switch (latestStatus) {
      case 'collect':
      case 'collector_attestation':
        return 'Collected';
      case 'weigh':
      case 'process':
      case 'grade':
        return 'Processing';
      case 'pack':
        return 'Packed';
      case 'scanned':
        return 'Scanned';
      case 'registered':
      case 'created':
        return 'Registered';
      default:
        return 'Other';
    }
  }
}

class EventOut {
  final String id, eventType;
  final String? batchId, plotId;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;
  EventOut.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        eventType = j['event_type'],
        batchId = j['batch_id'],
        plotId = j['plot_id'],
        payload = _m(j['payload']),
        occurredAt = DateTime.tryParse('${j['occurred_at']}')?.toLocal() ?? DateTime.now();

  String? get photoUrl => payload['photo_url'] as String?;
  bool get flagged => payload['location_flagged'] == true;
  double? get distanceM => _d(payload['distance_from_plot_m']);
  String? get caption => payload['caption'] as String?;
}

class ProtocolSummary {
  final String id, crop, name, source;
  ProtocolSummary.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        crop = j['crop'] ?? '',
        name = j['name'] ?? '',
        source = j['source'] ?? '';
}

class ProtocolStage {
  final int sequence;
  final int? dayOffset;
  final String title, instructions;
  ProtocolStage.fromJson(Map<String, dynamic> j)
      : sequence = j['sequence'] ?? 0,
        dayOffset = j['day_offset'],
        title = j['title'] ?? '',
        instructions = j['instructions'] ?? '';
}

class Protocol {
  final String id, crop, name, source;
  final List<ProtocolStage> stages;
  Protocol.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        crop = j['crop'] ?? '',
        name = j['name'] ?? '',
        source = j['source'] ?? '',
        stages = ((j['stages'] as List?) ?? const []).map((e) => ProtocolStage.fromJson(_m(e))).toList();
}

class StageEval {
  final int sequence;
  final String title, instructions, status;
  final int? dayOffset;
  final DateTime? due;
  final bool? satisfied;
  StageEval.fromJson(Map<String, dynamic> j)
      : sequence = j['sequence'] ?? 0,
        title = j['title'] ?? '',
        instructions = j['instructions'] ?? '',
        dayOffset = j['day_offset'],
        due = DateTime.tryParse('${j['due_date']}')?.toLocal(),
        satisfied = j['satisfied'],
        status = j['status'] ?? 'pending';
}

class ProtocolEval {
  final String name, source;
  final int requiredTotal, requiredSatisfied;
  final bool achieved;
  final List<StageEval> stages;
  ProtocolEval.fromJson(Map<String, dynamic> j)
      : name = j['protocol_name'] ?? '',
        source = j['protocol_source'] ?? '',
        requiredTotal = j['required_total'] ?? 0,
        requiredSatisfied = j['required_satisfied'] ?? 0,
        achieved = j['tier_achieved'] == true,
        stages = ((j['stages'] as List?) ?? const []).map((e) => StageEval.fromJson(_m(e))).toList();
}

class UserProfile {
  final String id, email, role;
  final String? name, phone, district, dsd, gnDivision, businessName;
  UserProfile.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        email = j['email'] ?? '',
        role = j['role'] ?? '',
        name = j['name'],
        phone = j['phone'],
        district = j['district'],
        dsd = j['dsd'],
        gnDivision = j['gn_division'],
        businessName = j['business_name'];
  String get location => [gnDivision, dsd, district].where((e) => e != null && e.isNotEmpty).join(', ');
}

/* ── Marketplace ────────────────────────────────────────────────────────── */

class Exporter {
  final String companyName;
  final String? description, logoUrl;
  final List<String> certifications;
  Exporter.fromJson(Map<String, dynamic> j)
      : companyName = j['company_name'] ?? '',
        description = j['description'],
        logoUrl = j['logo_url'],
        certifications = _sl(j['certifications']);
}

class Order {
  final String id, crop, gradeTier, priceType;
  final String title;
  final double quantityKg, remainingKg;
  final double? priceFixed, priceMin, priceMax;
  final DateTime? windowStart, windowEnd, expiresAt;
  final String? pickup;
  final List<String> districts;
  final Exporter exporter;
  Order.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        crop = titleCase(j['crop'] ?? ''),
        gradeTier = j['grade_tier'] ?? '',
        priceType = j['price_type'] ?? 'fixed',
        title = pickText(j['title']),
        quantityKg = _d(j['quantity_kg']) ?? 0,
        remainingKg = _d(j['remaining_quantity_kg']) ?? 0,
        priceFixed = _d(j['price_fixed']),
        priceMin = _d(j['price_min']),
        priceMax = _d(j['price_max']),
        windowStart = DateTime.tryParse('${j['collection_window_start']}')?.toLocal(),
        windowEnd = DateTime.tryParse('${j['collection_window_end']}')?.toLocal(),
        expiresAt = DateTime.tryParse('${j['expires_at']}')?.toLocal(),
        pickup = j['pickup_location'],
        districts = _sl(j['eligible_districts']),
        exporter = Exporter.fromJson(_m(j['exporter']));

  String get priceLine {
    String n(double? v) => v == null ? '—' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2));
    return priceType == 'range' ? 'LKR ${n(priceMin)}–${n(priceMax)} / kg' : 'LKR ${n(priceFixed)} / kg';
  }
}

class OrderStage {
  final int position;
  final String name, timing, instructions;
  final int startOffset;
  final List<String> dos, donts, allowedInputs;
  final int photoCount;
  OrderStage.fromJson(Map<String, dynamic> j)
      : position = j['position'] ?? 0,
        name = j['name'] ?? '',
        timing = j['timing_type'] ?? 'one_time',
        startOffset = j['start_offset_days'] ?? 0,
        instructions = pickText(j['instructions']),
        dos = _sl(_m(j['dos'])['en']),
        donts = _sl(_m(j['donts'])['en']),
        allowedInputs = _sl(j['allowed_inputs']),
        photoCount = (_m(j['required_proof'])['photo_count'] as int?) ?? 0;
}

class OrderDetail extends Order {
  final String adVersionId, description, standardName, paymentTiming, rejectionHandling, otherTerms, computedStatus;
  final int standardVersion;
  final List<OrderStage> stages;
  OrderDetail.fromJson(Map<String, dynamic> j)
      : adVersionId = j['ad_version_id'],
        description = pickText(j['description']),
        standardName = j['standard_name'] ?? '',
        standardVersion = j['standard_version_number'] ?? 1,
        computedStatus = j['computed_status'] ?? 'live',
        paymentTiming = (_m(j['terms'])['payment_timing'] ?? '').toString(),
        rejectionHandling = (_m(j['terms'])['rejection_handling'] ?? '').toString(),
        otherTerms = (_m(j['terms'])['other'] ?? '').toString(),
        stages = ((j['standard_stages'] as List?) ?? const []).map((e) => OrderStage.fromJson(_m(e))).toList(),
        super.fromJson(j);
  bool get isOpen => computedStatus == 'live';
}

class Application {
  final String acceptanceId, adId, adTitle, crop, grade, exporter, status, priceType;
  final double supplyKg;
  final double? priceFixed, priceMin, priceMax;
  final DateTime? windowStart, windowEnd, acceptedAt, withdrawnAt;
  Application.fromJson(Map<String, dynamic> j)
      : acceptanceId = j['acceptance_id'],
        adId = j['ad_id'],
        adTitle = pickText(j['ad_title']),
        crop = titleCase(j['crop'] ?? ''),
        grade = j['grade_tier'] ?? '',
        exporter = j['exporter_name'] ?? '',
        status = j['derived_status'] ?? 'pending',
        priceType = j['price_type'] ?? 'fixed',
        supplyKg = _d(j['supply_quantity_kg']) ?? 0,
        priceFixed = _d(j['price_fixed']),
        priceMin = _d(j['price_min']),
        priceMax = _d(j['price_max']),
        windowStart = DateTime.tryParse('${j['collection_window_start']}')?.toLocal(),
        windowEnd = DateTime.tryParse('${j['collection_window_end']}')?.toLocal(),
        acceptedAt = DateTime.tryParse('${j['accepted_at']}')?.toLocal(),
        withdrawnAt = DateTime.tryParse('${j['withdrawn_at']}')?.toLocal();

  String get priceLine {
    String n(double? v) => v == null ? '—' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2));
    return priceType == 'range' ? 'LKR ${n(priceMin)}–${n(priceMax)} / kg' : 'LKR ${n(priceFixed)} / kg';
  }
}

class VerifiedExporter {
  final String id, companyName;
  final String? description;
  final List<String> districts, crops, certifications;
  VerifiedExporter.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        companyName = j['company_name'] ?? '',
        description = j['description'],
        districts = _sl(j['districts_served']),
        crops = _sl(j['crops_bought']),
        certifications = _sl(j['certifications']);
}

class ExporterLink {
  final String id, exporterProfileId, status;
  final String? exporterName, reason;
  final DateTime? requestedAt, decidedAt;
  ExporterLink.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        exporterProfileId = j['exporter_profile_id'] ?? '',
        status = j['status'] ?? 'requested',
        exporterName = j['exporter_company_name'],
        reason = j['decision_reason'],
        requestedAt = DateTime.tryParse('${j['requested_at']}')?.toLocal(),
        decidedAt = DateTime.tryParse('${j['decided_at']}')?.toLocal();
}

class ProofStage {
  final String id, name, instructions, timing;
  final int position, startOffset, photoCount;
  final List<String> dos, donts, photoDescriptions, quickFields;
  final String? submissionStatus, submissionId;
  final bool canResubmit;
  ProofStage.fromJson(Map<String, dynamic> j)
      : id = j['stage_id'],
        name = j['name'] ?? '',
        position = j['position'] ?? 0,
        timing = j['timing_type'] ?? 'one_time',
        startOffset = j['start_offset_days'] ?? 0,
        instructions = pickText(j['instructions']),
        dos = _sl(_m(j['dos'])['en']),
        donts = _sl(_m(j['donts'])['en']),
        photoCount = (_m(j['required_proof'])['photo_count'] as int?) ?? 0,
        photoDescriptions = _sl(_m(j['required_proof'])['photo_descriptions']),
        quickFields = _sl(_m(j['required_proof'])['quick_fields']),
        submissionStatus = j['submission_status'],
        submissionId = j['submission_id'],
        canResubmit = j['can_resubmit'] != false;
}

class ProofStandard {
  final String id, crop, name;
  final int version;
  final List<ProofStage> stages;
  ProofStandard.fromJson(Map<String, dynamic> j)
      : id = j['standard_id'],
        crop = j['crop'] ?? '',
        name = j['standard_name'] ?? '',
        version = j['version_number'] ?? 1,
        stages = ((j['stages'] as List?) ?? const []).map((e) => ProofStage.fromJson(_m(e))).toList();
}

class ProofStandards {
  final bool hasApprovedExporter;
  final String? exporterName;
  final List<ProofStandard> standards;
  ProofStandards.fromJson(Map<String, dynamic> j)
      : hasApprovedExporter = j['has_approved_exporter'] == true,
        exporterName = j['exporter_company_name'],
        standards = ((j['standards'] as List?) ?? const []).map((e) => ProofStandard.fromJson(_m(e))).toList();
}

class Submission {
  final String id, stageName, status;
  final List<String> photos;
  final String? note, reviewNotes;
  final DateTime? submittedAt, reviewedAt;
  Submission.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        stageName = j['stage_name'] ?? '',
        status = j['status'] ?? 'pending',
        photos = _sl(j['photo_urls']),
        note = j['note'],
        reviewNotes = j['review_notes'],
        submittedAt = DateTime.tryParse('${j['submitted_at']}')?.toLocal(),
        reviewedAt = DateTime.tryParse('${j['reviewed_at']}')?.toLocal();
}

class NoticeSummary {
  final String id, crop, targetMonth, exporterName, title;
  final double volumeNeededKg;
  final String? response, plotId;
  final double? expectedKg;
  NoticeSummary.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        crop = titleCase(j['crop'] ?? ''),
        targetMonth = j['target_month'] ?? '',
        exporterName = j['exporter_name'] ?? '',
        title = pickText(j['title']),
        volumeNeededKg = _d(j['volume_needed_kg']) ?? 0,
        response = j['farmer_response'],
        plotId = j['plot_id'],
        expectedKg = _d(j['expected_volume_kg']);
}

class NoticeStage {
  final String name;
  final String? description;
  final int rules;
  NoticeStage.fromJson(Map<String, dynamic> j)
      : name = j['name'] ?? '',
        description = j['description'],
        rules = j['rules_count'] ?? 0;
}

class NoticeDetail {
  final String id, crop, targetMonth, title, message, exporterName, standardName;
  final int standardVersion;
  final double volumeNeededKg;
  final String? response, plotId;
  final double? expectedKg;
  final List<NoticeStage> stages;
  NoticeDetail.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        crop = titleCase(j['crop'] ?? ''),
        targetMonth = j['target_month'] ?? '',
        title = pickText(j['title']),
        message = pickText(j['message']),
        exporterName = (_m(j['exporter'])['company_name'] ?? '').toString(),
        standardName = j['standard_name'] ?? '',
        standardVersion = j['standard_version_number'] ?? 1,
        volumeNeededKg = _d(j['volume_needed_kg']) ?? 0,
        response = j['current_response'],
        plotId = j['current_plot_id'],
        expectedKg = _d(j['current_expected_volume_kg']),
        stages = ((j['stages'] as List?) ?? const []).map((e) => NoticeStage.fromJson(_m(e))).toList();

  /// Replies lock when the target month begins.
  bool get locked {
    final d = DateTime.tryParse(targetMonth.length >= 7 ? '${targetMonth.substring(0, 7)}-01' : targetMonth);
    return d != null && !DateTime.now().isBefore(d);
  }
}

class PlotOption {
  final String id;
  final String? name, district;
  final double areaHa;
  PlotOption.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        district = j['district'],
        areaHa = _d(j['area_ha']) ?? 0;
}

class AppNotification {
  final String id;
  final String? noticeId;
  final String title, body;
  final int slot;
  DateTime? readAt;
  final DateTime? sentAt, createdAt;
  AppNotification.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        noticeId = j['notice_id'],
        title = j['title'] ?? '',
        body = j['body'] ?? '',
        slot = j['reminder_slot'] ?? 0,
        readAt = DateTime.tryParse('${j['read_at']}')?.toLocal(),
        sentAt = DateTime.tryParse('${j['sent_at']}')?.toLocal(),
        createdAt = DateTime.tryParse('${j['created_at']}')?.toLocal();
  bool get unread => readAt == null;
}

/* ── Local ──────────────────────────────────────────────────────────────── */

class PendingCorner {
  final LatLon point;
  final double? accuracyM;
  PendingCorner(this.point, [this.accuracyM]);
}

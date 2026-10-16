/// The exporter marketplace (farmer/ads on web/backend) — a buyer's live
/// purchase request a farmer can browse, read the exporter's own quality
/// standard against, and apply to. Distinct from the simpler Commitment
/// auto-match (api/) used at batch-registration time: this is the
/// farmer-initiated "I want to supply this" side of the relationship.
library;

String _firstLang(Map<String, dynamic>? text) {
  if (text == null || text.isEmpty) return '';
  return (text['en'] as String?) ?? text.values.first as String? ?? '';
}

class AdExporter {
  final String companyName;
  final String? description;
  final String? logoUrl;
  final List<String> certifications;

  AdExporter({
    required this.companyName,
    required this.description,
    required this.logoUrl,
    required this.certifications,
  });

  factory AdExporter.fromJson(Map<String, dynamic> json) => AdExporter(
    companyName: json['company_name'] as String,
    description: json['description'] as String?,
    logoUrl: json['logo_url'] as String?,
    certifications: (json['certifications'] as List?)?.cast<String>() ?? [],
  );
}

class AdListItem {
  final String id;
  final String crop;
  final String gradeTier;
  final double quantityKg;
  final double remainingKg;
  final String priceType;
  final double? priceFixed;
  final double? priceMin;
  final double? priceMax;
  final DateTime collectionWindowStart;
  final DateTime collectionWindowEnd;
  final String? pickupLocation;
  final List<String> eligibleDistricts;
  final DateTime expiresAt;
  final String title;
  final AdExporter exporter;

  AdListItem({
    required this.id,
    required this.crop,
    required this.gradeTier,
    required this.quantityKg,
    required this.remainingKg,
    required this.priceType,
    required this.priceFixed,
    required this.priceMin,
    required this.priceMax,
    required this.collectionWindowStart,
    required this.collectionWindowEnd,
    required this.pickupLocation,
    required this.eligibleDistricts,
    required this.expiresAt,
    required this.title,
    required this.exporter,
  });

  // A single display-ready price line — fixed vs. range both end up read
  // the same way by a farmer deciding whether to apply.
  String get priceLabel {
    if (priceType == 'fixed' && priceFixed != null) {
      return 'LKR ${priceFixed!.toStringAsFixed(0)}/kg';
    }
    if (priceMin != null && priceMax != null) {
      return 'LKR ${priceMin!.toStringAsFixed(0)}–${priceMax!.toStringAsFixed(0)}/kg';
    }
    return 'Price on request';
  }

  factory AdListItem.fromJson(Map<String, dynamic> json) => AdListItem(
    id: json['id'] as String,
    crop: json['crop'] as String,
    gradeTier: json['grade_tier'] as String,
    quantityKg: (json['quantity_kg'] as num).toDouble(),
    remainingKg: (json['remaining_quantity_kg'] as num).toDouble(),
    priceType: json['price_type'] as String,
    priceFixed: (json['price_fixed'] as num?)?.toDouble(),
    priceMin: (json['price_min'] as num?)?.toDouble(),
    priceMax: (json['price_max'] as num?)?.toDouble(),
    collectionWindowStart: DateTime.parse(
      json['collection_window_start'] as String,
    ),
    collectionWindowEnd: DateTime.parse(
      json['collection_window_end'] as String,
    ),
    pickupLocation: json['pickup_location'] as String?,
    eligibleDistricts:
        (json['eligible_districts'] as List?)?.cast<String>() ?? [],
    expiresAt: DateTime.parse(json['expires_at'] as String),
    title: _firstLang(json['title'] as Map<String, dynamic>?),
    exporter: AdExporter.fromJson(json['exporter'] as Map<String, dynamic>),
  );
}

class AdStandardStage {
  final int position;
  final String name;
  final String timingType;
  final int startOffsetDays;
  final String instructions;
  final List<String> dos;
  final List<String> donts;
  final List<String> allowedInputs;
  final int requiredPhotoCount;

  AdStandardStage({
    required this.position,
    required this.name,
    required this.timingType,
    required this.startOffsetDays,
    required this.instructions,
    required this.dos,
    required this.donts,
    required this.allowedInputs,
    required this.requiredPhotoCount,
  });

  factory AdStandardStage.fromJson(Map<String, dynamic> json) {
    final requiredProof = json['required_proof'] as Map<String, dynamic>? ?? {};
    return AdStandardStage(
      position: json['position'] as int,
      name: json['name'] as String,
      timingType: json['timing_type'] as String,
      startOffsetDays: json['start_offset_days'] as int,
      instructions: _firstLang(json['instructions'] as Map<String, dynamic>?),
      dos:
          ((json['dos'] as Map<String, dynamic>?)?['en'] as List?)
              ?.cast<String>() ??
          [],
      donts:
          ((json['donts'] as Map<String, dynamic>?)?['en'] as List?)
              ?.cast<String>() ??
          [],
      allowedInputs: (json['allowed_inputs'] as List?)?.cast<String>() ?? [],
      requiredPhotoCount: (requiredProof['photo_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdDetail extends AdListItem {
  final String adVersionId;
  final int versionNumber;
  final String computedStatus;
  final String description;
  final String? paymentTiming;
  final String? rejectionHandling;
  final String standardName;
  final List<AdStandardStage> standardStages;

  AdDetail({
    required super.id,
    required super.crop,
    required super.gradeTier,
    required super.quantityKg,
    required super.remainingKg,
    required super.priceType,
    required super.priceFixed,
    required super.priceMin,
    required super.priceMax,
    required super.collectionWindowStart,
    required super.collectionWindowEnd,
    required super.pickupLocation,
    required super.eligibleDistricts,
    required super.expiresAt,
    required super.title,
    required super.exporter,
    required this.adVersionId,
    required this.versionNumber,
    required this.computedStatus,
    required this.description,
    required this.paymentTiming,
    required this.rejectionHandling,
    required this.standardName,
    required this.standardStages,
  });

  factory AdDetail.fromJson(Map<String, dynamic> json) {
    final terms = json['terms'] as Map<String, dynamic>? ?? {};
    return AdDetail(
      id: json['id'] as String,
      crop: json['crop'] as String,
      gradeTier: json['grade_tier'] as String,
      quantityKg: (json['quantity_kg'] as num).toDouble(),
      remainingKg: (json['remaining_quantity_kg'] as num).toDouble(),
      priceType: json['price_type'] as String,
      priceFixed: (json['price_fixed'] as num?)?.toDouble(),
      priceMin: (json['price_min'] as num?)?.toDouble(),
      priceMax: (json['price_max'] as num?)?.toDouble(),
      collectionWindowStart: DateTime.parse(
        json['collection_window_start'] as String,
      ),
      collectionWindowEnd: DateTime.parse(
        json['collection_window_end'] as String,
      ),
      pickupLocation: json['pickup_location'] as String?,
      eligibleDistricts:
          (json['eligible_districts'] as List?)?.cast<String>() ?? [],
      expiresAt: DateTime.parse(json['expires_at'] as String),
      title: _firstLang(json['title'] as Map<String, dynamic>?),
      exporter: AdExporter.fromJson(json['exporter'] as Map<String, dynamic>),
      adVersionId: json['ad_version_id'] as String,
      versionNumber: json['version_number'] as int,
      computedStatus: json['computed_status'] as String,
      description: _firstLang(json['description'] as Map<String, dynamic>?),
      paymentTiming: terms['payment_timing'] as String?,
      rejectionHandling: terms['rejection_handling'] as String?,
      standardName: json['standard_name'] as String,
      standardStages:
          (json['standard_stages'] as List? ?? [])
              .cast<Map<String, dynamic>>()
              .map(AdStandardStage.fromJson)
              .toList(),
    );
  }
}

class MyAdAcceptance {
  final String acceptanceId;
  final String adId;
  final String adTitle;
  final String crop;
  final String gradeTier;
  final String exporterName;
  final String? exporterLogoUrl;
  final double supplyQuantityKg;
  final String priceType;
  final double? priceFixed;
  final double? priceMin;
  final double? priceMax;
  final DateTime collectionWindowStart;
  final DateTime collectionWindowEnd;
  final DateTime acceptedAt;
  final DateTime? withdrawnAt;
  // pending | approved | declined | withdrawn | removed
  final String derivedStatus;

  MyAdAcceptance({
    required this.acceptanceId,
    required this.adId,
    required this.adTitle,
    required this.crop,
    required this.gradeTier,
    required this.exporterName,
    required this.exporterLogoUrl,
    required this.supplyQuantityKg,
    required this.priceType,
    required this.priceFixed,
    required this.priceMin,
    required this.priceMax,
    required this.collectionWindowStart,
    required this.collectionWindowEnd,
    required this.acceptedAt,
    required this.withdrawnAt,
    required this.derivedStatus,
  });

  String get priceLabel {
    if (priceType == 'fixed' && priceFixed != null) {
      return 'LKR ${priceFixed!.toStringAsFixed(0)}/kg';
    }
    if (priceMin != null && priceMax != null) {
      return 'LKR ${priceMin!.toStringAsFixed(0)}–${priceMax!.toStringAsFixed(0)}/kg';
    }
    return 'Price on request';
  }

  factory MyAdAcceptance.fromJson(Map<String, dynamic> json) => MyAdAcceptance(
    acceptanceId: json['acceptance_id'] as String,
    adId: json['ad_id'] as String,
    adTitle: _firstLang(json['ad_title'] as Map<String, dynamic>?),
    crop: json['crop'] as String,
    gradeTier: json['grade_tier'] as String,
    exporterName: json['exporter_name'] as String,
    exporterLogoUrl: json['exporter_logo_url'] as String?,
    supplyQuantityKg: (json['supply_quantity_kg'] as num).toDouble(),
    priceType: json['price_type'] as String,
    priceFixed: (json['price_fixed'] as num?)?.toDouble(),
    priceMin: (json['price_min'] as num?)?.toDouble(),
    priceMax: (json['price_max'] as num?)?.toDouble(),
    collectionWindowStart: DateTime.parse(
      json['collection_window_start'] as String,
    ),
    collectionWindowEnd: DateTime.parse(
      json['collection_window_end'] as String,
    ),
    acceptedAt: DateTime.parse(json['accepted_at'] as String),
    withdrawnAt: json['withdrawn_at'] != null
        ? DateTime.parse(json['withdrawn_at'] as String)
        : null,
    derivedStatus: json['derived_status'] as String,
  );
}

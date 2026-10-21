import 'package:flutter/widgets.dart';

/// Resolves a localized map of strings (e.g. {"en": "...", "si": "...", "ta": "..."})
/// using the current device locale, with graceful English fallback, and falling back
/// to the first available non-empty entry.
String resolveLocalized(dynamic text) {
  if (text == null) return '';
  if (text is String) return text;
  if (text is Map) {
    try {
      final lang =
          WidgetsBinding.instance.platformDispatcher.locale.languageCode;
      final localeVal = text[lang];
      if (localeVal is String && localeVal.trim().isNotEmpty) {
        return localeVal.trim();
      }
    } catch (_) {}
    final enVal = text['en'];
    if (enVal is String && enVal.trim().isNotEmpty) {
      return enVal.trim();
    }
    for (final v in text.values) {
      if (v is String && v.trim().isNotEmpty) {
        return v.trim();
      }
    }
  }
  return '';
}

/// Formats a target month string (e.g. "2026-11-01" or "2026-11") into a
/// human-friendly label like "November 2026".
String formatTargetMonth(String targetMonth) {
  try {
    final parts = targetMonth.split('-');
    if (parts.length >= 2) {
      final year = int.tryParse(parts[0]);
      final month = int.tryParse(parts[1]);
      if (year != null && month != null && month >= 1 && month <= 12) {
        const months = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        return '${months[month - 1]} $year';
      }
    }
  } catch (_) {}
  return targetMonth;
}

/// Convenience check for whether the target month has already started.
/// Note: The backend 409 response remains the authoritative check.
bool isTargetMonthStarted(String targetMonth) {
  try {
    final parts = targetMonth.split('-');
    if (parts.length >= 2) {
      final year = int.tryParse(parts[0]);
      final month = int.tryParse(parts[1]);
      if (year != null && month != null) {
        final now = DateTime.now().toUtc();
        final startOfTargetMonth = DateTime.utc(year, month, 1);
        final todayUtc = DateTime.utc(now.year, now.month, now.day);
        return todayUtc.isAfter(startOfTargetMonth) ||
            todayUtc.isAtSameMomentAs(startOfTargetMonth);
      }
    }
  } catch (_) {}
  return false;
}

class PlantingNoticeSummary {
  final String id;
  final String crop;
  final String targetMonth;
  final double volumeNeededKg;
  final String title;
  final String exporterName;
  final String? exporterLogoUrl;
  final String? farmerResponse; // 'ready' | 'cannot' | null
  final double? expectedVolumeKg;
  final String? plotId;
  final DateTime? publishedAt;

  PlantingNoticeSummary({
    required this.id,
    required this.crop,
    required this.targetMonth,
    required this.volumeNeededKg,
    required this.title,
    required this.exporterName,
    this.exporterLogoUrl,
    this.farmerResponse,
    this.expectedVolumeKg,
    this.plotId,
    this.publishedAt,
  });

  bool get isLocked => isTargetMonthStarted(targetMonth);
  bool get isReady => farmerResponse == 'ready';
  bool get isCannot => farmerResponse == 'cannot';
  String get formattedMonth => formatTargetMonth(targetMonth);

  factory PlantingNoticeSummary.fromJson(Map<String, dynamic> json) {
    DateTime? pubDate;
    final pubStr = json['published_at'] ?? json['created_at'];
    if (pubStr is String) {
      pubDate = DateTime.tryParse(pubStr);
    }

    return PlantingNoticeSummary(
      id: (json['id'] as String?) ?? '',
      crop: (json['crop'] as String?) ?? '',
      targetMonth: (json['target_month'] as String?) ?? '',
      volumeNeededKg: (json['volume_needed_kg'] as num?)?.toDouble() ?? 0.0,
      title: resolveLocalized(json['title']),
      exporterName: (json['exporter_name'] as String?) ?? 'Exporter',
      exporterLogoUrl: json['exporter_logo_url'] as String?,
      farmerResponse: json['farmer_response'] as String?,
      expectedVolumeKg: (json['expected_volume_kg'] as num?)?.toDouble(),
      plotId: json['plot_id'] as String?,
      publishedAt: pubDate,
    );
  }
}

class PaginatedPlantingNotices {
  final List<PlantingNoticeSummary> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;

  PaginatedPlantingNotices({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  factory PaginatedPlantingNotices.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List?;
    final list = rawItems != null
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(PlantingNoticeSummary.fromJson)
            .toList()
        : <PlantingNoticeSummary>[];

    return PaginatedPlantingNotices(
      items: list,
      total: (json['total'] as num?)?.toInt() ?? list.length,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['page_size'] as num?)?.toInt() ?? 10,
      totalPages: (json['total_pages'] as num?)?.toInt() ?? 1,
    );
  }
}

class NoticeStageSummary {
  final String id;
  final int stageOrder;
  final String name;
  final String description;
  final int rulesCount;

  NoticeStageSummary({
    required this.id,
    required this.stageOrder,
    required this.name,
    required this.description,
    required this.rulesCount,
  });

  factory NoticeStageSummary.fromJson(Map<String, dynamic> json) {
    return NoticeStageSummary(
      id: (json['id'] as String?) ?? '',
      stageOrder: (json['stage_order'] as num?)?.toInt() ?? 1,
      name: (json['name'] as String?) ?? '',
      description: resolveLocalized(json['description']),
      rulesCount: (json['rules_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class PlantingNoticeDetail {
  final String id;
  final String crop;
  final String targetMonth;
  final double volumeNeededKg;
  final String title;
  final String message;
  final DateTime? publishedAt;
  final String exporterCompanyName;
  final String? exporterLogoUrl;
  final String? currentResponse;
  final double? currentExpectedVolumeKg;
  final String? currentPlotId;
  final String standardVersionId;
  final String standardName;
  final int standardVersionNumber;
  final List<NoticeStageSummary> stages;

  PlantingNoticeDetail({
    required this.id,
    required this.crop,
    required this.targetMonth,
    required this.volumeNeededKg,
    required this.title,
    required this.message,
    this.publishedAt,
    required this.exporterCompanyName,
    this.exporterLogoUrl,
    this.currentResponse,
    this.currentExpectedVolumeKg,
    this.currentPlotId,
    required this.standardVersionId,
    required this.standardName,
    required this.standardVersionNumber,
    required this.stages,
  });

  bool get isLocked => isTargetMonthStarted(targetMonth);
  bool get isReady => currentResponse == 'ready';
  bool get isCannot => currentResponse == 'cannot';
  String get formattedMonth => formatTargetMonth(targetMonth);

  factory PlantingNoticeDetail.fromJson(Map<String, dynamic> json) {
    DateTime? pubDate;
    final pubStr = json['published_at'] ?? json['created_at'];
    if (pubStr is String) {
      pubDate = DateTime.tryParse(pubStr);
    }

    final exp = json['exporter'] as Map<String, dynamic>? ?? {};
    final rawStages = json['stages'] as List?;
    final stagesList = rawStages != null
        ? rawStages
            .whereType<Map<String, dynamic>>()
            .map(NoticeStageSummary.fromJson)
            .toList()
        : <NoticeStageSummary>[];

    return PlantingNoticeDetail(
      id: (json['id'] as String?) ?? '',
      crop: (json['crop'] as String?) ?? '',
      targetMonth: (json['target_month'] as String?) ?? '',
      volumeNeededKg: (json['volume_needed_kg'] as num?)?.toDouble() ?? 0.0,
      title: resolveLocalized(json['title']),
      message: resolveLocalized(json['message']),
      publishedAt: pubDate,
      exporterCompanyName:
          (exp['company_name'] as String?) ?? 'Approved Exporter',
      exporterLogoUrl: exp['logo_url'] as String?,
      currentResponse: json['current_response'] as String?,
      currentExpectedVolumeKg:
          (json['current_expected_volume_kg'] as num?)?.toDouble(),
      currentPlotId: json['current_plot_id'] as String?,
      standardVersionId: (json['standard_version_id'] as String?) ?? '',
      standardName: (json['standard_name'] as String?) ?? 'Standard',
      standardVersionNumber:
          (json['standard_version_number'] as num?)?.toInt() ?? 1,
      stages: stagesList,
    );
  }
}

class FarmerNoticePlot {
  final String id;
  final String name;
  final double areaHa;
  final String? district;
  final String? dsd;
  final String? gnDivision;

  FarmerNoticePlot({
    required this.id,
    required this.name,
    required this.areaHa,
    this.district,
    this.dsd,
    this.gnDivision,
  });

  factory FarmerNoticePlot.fromJson(Map<String, dynamic> json) {
    final rawName = json['name'] as String?;
    final display = (rawName != null && rawName.trim().isNotEmpty)
        ? rawName.trim()
        : 'Plot';
    return FarmerNoticePlot(
      id: (json['id'] as String?) ?? '',
      name: display,
      areaHa: (json['area_ha'] as num?)?.toDouble() ?? 0.0,
      district: json['district'] as String?,
      dsd: json['dsd'] as String?,
      gnDivision: json['gn_division'] as String?,
    );
  }
}

class NoticeReplyResponse {
  final String status;
  final String noticeId;
  final String farmerId;
  final String response;
  final double? expectedVolumeKg;
  final String? plotId;
  final String? respondedAt;
  final String message;

  NoticeReplyResponse({
    required this.status,
    required this.noticeId,
    required this.farmerId,
    required this.response,
    this.expectedVolumeKg,
    this.plotId,
    this.respondedAt,
    required this.message,
  });

  factory NoticeReplyResponse.fromJson(Map<String, dynamic> json) {
    return NoticeReplyResponse(
      status: (json['status'] as String?) ?? 'ok',
      noticeId: (json['notice_id'] as String?) ?? '',
      farmerId: (json['farmer_id'] as String?) ?? '',
      response: (json['response'] as String?) ?? '',
      expectedVolumeKg: (json['expected_volume_kg'] as num?)?.toDouble(),
      plotId: json['plot_id'] as String?,
      respondedAt: json['responded_at'] as String?,
      message: (json['message'] as String?) ?? 'Response saved.',
    );
  }
}

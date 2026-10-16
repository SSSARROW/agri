/// The farmer-facing side of stage-proof photo verification (farmer/
/// stage-proofs on web/backend): once a farmer has an approved relationship
/// with an exporter, the exporter's published quality standard(s) break
/// growing into stages (e.g. "Planting", "Harvest"), each one requiring the
/// farmer to submit photo proof (+ optional quick-field answers) for manual
/// exporter review. Distinct from AdStandardStage (ad.dart) — that one is
/// read-only context on a single buyer order; this one tracks a farmer's
/// own submission status per stage over the life of the relationship.
library;

String _firstLang(Map<String, dynamic>? text) {
  if (text == null || text.isEmpty) return '';
  return (text['en'] as String?) ?? text.values.first as String? ?? '';
}

List<String> _firstLangList(Map<String, dynamic>? text) {
  if (text == null || text.isEmpty) return [];
  final en = text['en'];
  if (en is List) return en.cast<String>();
  final first = text.values.first;
  if (first is List) return first.cast<String>();
  return [];
}

class RequiredProof {
  final int photoCount;
  final List<String> photoDescriptions;
  final List<String> quickFields;

  RequiredProof({
    required this.photoCount,
    required this.photoDescriptions,
    required this.quickFields,
  });

  factory RequiredProof.fromJson(Map<String, dynamic>? json) => RequiredProof(
    photoCount: (json?['photo_count'] as num?)?.toInt() ?? 0,
    photoDescriptions:
        (json?['photo_descriptions'] as List?)?.cast<String>() ?? [],
    quickFields: (json?['quick_fields'] as List?)?.cast<String>() ?? [],
  );
}

class StageWithStatus {
  final String stageId;
  final int position;
  final String name;
  final String timingType;
  final int startOffsetDays;
  final String instructions;
  final List<String> dos;
  final List<String> donts;
  final List<String> allowedInputs;
  final RequiredProof requiredProof;
  // pending | approved | rejected | null (never submitted).
  final String? submissionStatus;
  final String? submissionId;
  // True once the exporter has reopened a rejected submission, or there's
  // nothing blocking a first submission — false while pending, or while
  // rejected-and-not-yet-reopened.
  final bool canResubmit;

  StageWithStatus({
    required this.stageId,
    required this.position,
    required this.name,
    required this.timingType,
    required this.startOffsetDays,
    required this.instructions,
    required this.dos,
    required this.donts,
    required this.allowedInputs,
    required this.requiredProof,
    required this.submissionStatus,
    required this.submissionId,
    required this.canResubmit,
  });

  factory StageWithStatus.fromJson(Map<String, dynamic> json) =>
      StageWithStatus(
        stageId: json['stage_id'] as String,
        position: json['position'] as int,
        name: json['name'] as String,
        timingType: json['timing_type'] as String,
        startOffsetDays: json['start_offset_days'] as int,
        instructions: _firstLang(
          json['instructions'] as Map<String, dynamic>?,
        ),
        dos: _firstLangList(json['dos'] as Map<String, dynamic>?),
        donts: _firstLangList(json['donts'] as Map<String, dynamic>?),
        allowedInputs:
            (json['allowed_inputs'] as List?)?.cast<String>() ?? [],
        requiredProof: RequiredProof.fromJson(
          json['required_proof'] as Map<String, dynamic>?,
        ),
        submissionStatus: json['submission_status'] as String?,
        submissionId: json['submission_id'] as String?,
        canResubmit: json['can_resubmit'] as bool? ?? true,
      );

  /// Never submitted, and nothing stops a first submission.
  bool get isUnsubmitted => submissionStatus == null;
  bool get isPending => submissionStatus == 'pending';
  bool get isApproved => submissionStatus == 'approved';
  bool get isRejected => submissionStatus == 'rejected';

  /// Whether the "submit proof" flow should be offered at all right now.
  bool get canSubmit =>
      isUnsubmitted || (isRejected && canResubmit);
}

class StandardWithStages {
  final String standardId;
  final String crop;
  final String standardName;
  final int versionNumber;
  final List<StageWithStatus> stages;

  StandardWithStages({
    required this.standardId,
    required this.crop,
    required this.standardName,
    required this.versionNumber,
    required this.stages,
  });

  factory StandardWithStages.fromJson(Map<String, dynamic> json) =>
      StandardWithStages(
        standardId: json['standard_id'] as String,
        crop: json['crop'] as String,
        standardName: json['standard_name'] as String,
        versionNumber: json['version_number'] as int,
        stages: (json['stages'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(StageWithStatus.fromJson)
            .toList(),
      );
}

class FarmerStandardsResponse {
  final bool hasApprovedExporter;
  final String? exporterCompanyName;
  final List<StandardWithStages> standards;

  FarmerStandardsResponse({
    required this.hasApprovedExporter,
    required this.exporterCompanyName,
    required this.standards,
  });

  factory FarmerStandardsResponse.fromJson(Map<String, dynamic> json) =>
      FarmerStandardsResponse(
        hasApprovedExporter: json['has_approved_exporter'] as bool? ?? false,
        exporterCompanyName: json['exporter_company_name'] as String?,
        standards: (json['standards'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(StandardWithStages.fromJson)
            .toList(),
      );
}

class SubmissionOut {
  final String id;
  final String linkId;
  final String stageId;
  final String stageName;
  final List<String> photoUrls;
  final Map<String, dynamic> quickFieldAnswers;
  final String? note;
  // pending | approved | rejected
  final String status;
  final DateTime submittedAt;
  final DateTime? reviewedAt;
  final String? reviewNotes;

  SubmissionOut({
    required this.id,
    required this.linkId,
    required this.stageId,
    required this.stageName,
    required this.photoUrls,
    required this.quickFieldAnswers,
    required this.note,
    required this.status,
    required this.submittedAt,
    required this.reviewedAt,
    required this.reviewNotes,
  });

  factory SubmissionOut.fromJson(Map<String, dynamic> json) => SubmissionOut(
    id: json['id'] as String,
    linkId: json['link_id'] as String,
    stageId: json['stage_id'] as String,
    stageName: json['stage_name'] as String,
    photoUrls: (json['photo_urls'] as List?)?.cast<String>() ?? [],
    quickFieldAnswers:
        (json['quick_field_answers'] as Map?)?.cast<String, dynamic>() ?? {},
    note: json['note'] as String?,
    status: json['status'] as String,
    submittedAt: DateTime.parse(json['submitted_at'] as String),
    reviewedAt: json['reviewed_at'] != null
        ? DateTime.parse(json['reviewed_at'] as String)
        : null,
    reviewNotes: json['review_notes'] as String?,
  );
}

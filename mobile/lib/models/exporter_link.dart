/// The long-term farmer↔exporter relationship (farmer/exporter-link on
/// web/backend) — distinct from a one-off Ad acceptance: a farmer commits
/// to growing toward one exporter's own standard over time rather than
/// supplying a fixed quantity by a fixed date. A farmer can only have one
/// active (requested or approved) relationship at once.
class VerifiedExporter {
  final String id;
  final String companyName;
  final String? description;
  final String? logoUrl;
  final List<String> districtsServed;
  final List<String> cropsBought;
  final List<String> certifications;

  VerifiedExporter({
    required this.id,
    required this.companyName,
    required this.description,
    required this.logoUrl,
    required this.districtsServed,
    required this.cropsBought,
    required this.certifications,
  });

  factory VerifiedExporter.fromJson(Map<String, dynamic> json) =>
      VerifiedExporter(
        id: json['id'] as String,
        companyName: json['company_name'] as String,
        description: json['description'] as String?,
        logoUrl: json['logo_url'] as String?,
        districtsServed:
            (json['districts_served'] as List?)?.cast<String>() ?? [],
        cropsBought: (json['crops_bought'] as List?)?.cast<String>() ?? [],
        certifications:
            (json['certifications'] as List?)?.cast<String>() ?? [],
      );
}

class FarmerExporterLink {
  final String id;
  final String exporterProfileId;
  final String? exporterCompanyName;
  // requested | approved | declined | removed | cancelled
  final String status;
  final DateTime requestedAt;
  final DateTime? decidedAt;
  final String? decisionReason;

  FarmerExporterLink({
    required this.id,
    required this.exporterProfileId,
    required this.exporterCompanyName,
    required this.status,
    required this.requestedAt,
    required this.decidedAt,
    required this.decisionReason,
  });

  factory FarmerExporterLink.fromJson(Map<String, dynamic> json) =>
      FarmerExporterLink(
        id: json['id'] as String,
        exporterProfileId: json['exporter_profile_id'] as String,
        exporterCompanyName: json['exporter_company_name'] as String?,
        status: json['status'] as String,
        requestedAt: DateTime.parse(json['requested_at'] as String),
        decidedAt: json['decided_at'] != null
            ? DateTime.parse(json['decided_at'] as String)
            : null,
        decisionReason: json['decision_reason'] as String?,
      );
}

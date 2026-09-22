class Plot {
  final String id;
  final String? ownerUserId;
  final double centerLat;
  final double centerLon;
  final double? areaHa;
  final String boundarySource;
  final String? district;
  final String? dsd;
  final String? gnDivision;
  // Which protocol the farmer confirmed adherence to when recording planting
  // (see farm_page.dart's checklist) — self-reported at that time, not
  // independently verified. Null if no protocol was confirmed, or nothing's
  // been planted on this plot yet.
  final String? committedProtocolId;
  final String? committedProtocolName;
  final DateTime createdAt;

  Plot({
    required this.id,
    required this.ownerUserId,
    required this.centerLat,
    required this.centerLon,
    required this.areaHa,
    required this.boundarySource,
    required this.district,
    required this.dsd,
    required this.gnDivision,
    required this.committedProtocolId,
    required this.committedProtocolName,
    required this.createdAt,
  });

  factory Plot.fromJson(Map<String, dynamic> json) => Plot(
    id: json['id'] as String,
    ownerUserId: json['owner_user_id'] as String?,
    centerLat: (json['center_lat'] as num).toDouble(),
    centerLon: (json['center_lon'] as num).toDouble(),
    areaHa: (json['area_ha'] as num?)?.toDouble(),
    boundarySource: json['boundary_source'] as String? ?? 'estimated_square',
    district: json['district'] as String?,
    dsd: json['dsd'] as String?,
    gnDivision: json['gn_division'] as String?,
    committedProtocolId: json['committed_protocol_id'] as String?,
    committedProtocolName: json['committed_protocol_name'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
  );
}

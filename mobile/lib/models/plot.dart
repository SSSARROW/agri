import '../core/plot_area.dart';

class Plot {
  final String id;
  final String? ownerUserId;
  final double centerLat;
  final double centerLon;
  final double? areaHa;
  final String boundarySource;
  // The growing environment — a plot's boundary shape already supports any
  // polygon (a walked circle, an irregular greenhouse footprint), this is
  // separate metadata since it affects which protocol requirements apply
  // (e.g. organic's buffer-zone-from-neighbors rule doesn't fit a greenhouse).
  final String plotType;
  // Optional farmer-chosen label — plots in one GN division otherwise all
  // read the same in a list.
  final String? name;
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
    required this.plotType,
    required this.name,
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
    plotType: json['plot_type'] as String? ?? 'open_field',
    name: json['name'] as String?,
    district: json['district'] as String?,
    dsd: json['dsd'] as String?,
    gnDivision: json['gn_division'] as String?,
    committedProtocolId: json['committed_protocol_id'] as String?,
    committedProtocolName: json['committed_protocol_name'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
  );

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  /// What to call this plot on screen: the farmer's own name if they gave
  /// one, otherwise something that still tells two plots apart (size and
  /// when it was added) rather than a location every plot shares.
  String get title {
    final n = name?.trim();
    if (n != null && n.isNotEmpty) return n;
    final local = createdAt.toLocal();
    return '${formatArea(areaHa)} plot · added ${local.day} ${_months[local.month - 1]}';
  }

  /// How the boundary was captured — shown next to the plot so a measured
  /// boundary is never confused with a rough estimate.
  String get boundaryLabel => switch (boundarySource) {
    'walked' => 'Boundary walked in the field',
    'traced' => 'Boundary traced on satellite map',
    _ => 'Estimated square (no boundary walk)',
  };

  bool get boundaryMeasured =>
      boundarySource == 'walked' || boundarySource == 'traced';

  String get location =>
      [gnDivision, district].where((s) => s != null && s.isNotEmpty).join(', ');
}

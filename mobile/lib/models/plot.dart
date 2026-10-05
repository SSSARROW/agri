import '../core/plot_area.dart';

/// One crop currently recorded as planted on a plot — a plot can carry more
/// than one of these at once (intercropping), so [Plot.plantings] is a list
/// rather than a single committed protocol.
class PlotPlanting {
  final String crop;
  final DateTime plantedAt;
  // The area claimed for this crop specifically, if the farmer gave one at
  // planting time — null means the whole plot.
  final double? areaHa;
  final String? protocolId;
  final String? protocolName;

  PlotPlanting({
    required this.crop,
    required this.plantedAt,
    required this.areaHa,
    required this.protocolId,
    required this.protocolName,
  });

  factory PlotPlanting.fromJson(Map<String, dynamic> json) => PlotPlanting(
    crop: json['crop'] as String,
    plantedAt: DateTime.parse(json['planted_at'] as String),
    areaHa: (json['area_ha'] as num?)?.toDouble(),
    protocolId: json['protocol_id'] as String?,
    protocolName: json['protocol_name'] as String?,
  );
}

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
  // Most recent planting per crop currently on this plot — more than one
  // entry means the farmer is intercropping. Empty if nothing's been
  // planted on this plot yet.
  final List<PlotPlanting> plantings;
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
    required this.plantings,
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
    plantings: (json['plantings'] as List<dynamic>? ?? [])
        .map((p) => PlotPlanting.fromJson(p as Map<String, dynamic>))
        .toList(),
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

  /// This plot's planting record for [crop] specifically, if any — case
  /// insensitive since the crop picker's "Other" free text isn't normalized.
  PlotPlanting? plantingFor(String crop) {
    for (final p in plantings) {
      if (p.crop.toLowerCase() == crop.toLowerCase()) return p;
    }
    return null;
  }
}

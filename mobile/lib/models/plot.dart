class Plot {
  final String id;
  final String? ownerUserId;
  final double centerLat;
  final double centerLon;
  final double? areaHa;
  final String? district;
  final String? dsd;
  final String? gnDivision;
  final DateTime createdAt;

  Plot({
    required this.id,
    required this.ownerUserId,
    required this.centerLat,
    required this.centerLon,
    required this.areaHa,
    required this.district,
    required this.dsd,
    required this.gnDivision,
    required this.createdAt,
  });

  factory Plot.fromJson(Map<String, dynamic> json) => Plot(
        id: json['id'] as String,
        ownerUserId: json['owner_user_id'] as String?,
        centerLat: (json['center_lat'] as num).toDouble(),
        centerLon: (json['center_lon'] as num).toDouble(),
        areaHa: (json['area_ha'] as num?)?.toDouble(),
        district: json['district'] as String?,
        dsd: json['dsd'] as String?,
        gnDivision: json['gn_division'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

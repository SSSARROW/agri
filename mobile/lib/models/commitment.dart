class Commitment {
  final String id;
  final String crop;
  final String? protocolId;
  final String? protocolName;
  final double volumeKg;
  final double remainingKg;
  final DateTime deliveryWindowStart;
  final DateTime deliveryWindowEnd;
  final double? indicativePriceLkrPerKg;

  Commitment({
    required this.id,
    required this.crop,
    required this.protocolId,
    required this.protocolName,
    required this.volumeKg,
    required this.remainingKg,
    required this.deliveryWindowStart,
    required this.deliveryWindowEnd,
    required this.indicativePriceLkrPerKg,
  });

  factory Commitment.fromJson(Map<String, dynamic> json) => Commitment(
    id: json['id'] as String,
    crop: json['crop'] as String,
    protocolId: json['protocol_id'] as String?,
    protocolName: json['protocol_name'] as String?,
    volumeKg: (json['volume_kg'] as num).toDouble(),
    remainingKg: (json['remaining_kg'] as num).toDouble(),
    deliveryWindowStart: DateTime.parse(
      json['delivery_window_start'] as String,
    ),
    deliveryWindowEnd: DateTime.parse(json['delivery_window_end'] as String),
    indicativePriceLkrPerKg: (json['indicative_price_lkr_per_kg'] as num?)
        ?.toDouble(),
  );
}

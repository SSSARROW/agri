/// What a batch auto-matched to at registration (B-50) — the concrete
/// buyer order behind "matched to an open buyer order", not just a yes/no.
class MatchedCommitment {
  final String id;
  final String crop;
  final double volumeKg;
  final double remainingKg;
  final DateTime deliveryWindowStart;
  final DateTime deliveryWindowEnd;
  final double? indicativePriceLkrPerKg;

  MatchedCommitment({
    required this.id,
    required this.crop,
    required this.volumeKg,
    required this.remainingKg,
    required this.deliveryWindowStart,
    required this.deliveryWindowEnd,
    required this.indicativePriceLkrPerKg,
  });

  factory MatchedCommitment.fromJson(Map<String, dynamic> json) =>
      MatchedCommitment(
        id: json['id'] as String,
        crop: json['crop'] as String,
        volumeKg: (json['volume_kg'] as num).toDouble(),
        remainingKg: (json['remaining_kg'] as num).toDouble(),
        deliveryWindowStart: DateTime.parse(
          json['delivery_window_start'] as String,
        ),
        deliveryWindowEnd: DateTime.parse(
          json['delivery_window_end'] as String,
        ),
        indicativePriceLkrPerKg: (json['indicative_price_lkr_per_kg'] as num?)
            ?.toDouble(),
      );
}

class Batch {
  final String id;
  final String code;
  final String crop;
  final String? plotId;
  final String? protocolId;
  final String? protocolName;
  final String? commitmentId;
  final MatchedCommitment? commitment;
  final DateTime createdAt;
  final String latestStatus;
  final DateTime? latestOccurredAt;

  Batch({
    required this.id,
    required this.code,
    required this.crop,
    required this.plotId,
    required this.protocolId,
    required this.protocolName,
    required this.commitmentId,
    required this.commitment,
    required this.createdAt,
    required this.latestStatus,
    required this.latestOccurredAt,
  });

  factory Batch.fromJson(Map<String, dynamic> json) => Batch(
    id: json['id'] as String,
    code: json['code'] as String,
    crop: json['crop'] as String,
    plotId: json['plot_id'] as String?,
    protocolId: json['protocol_id'] as String?,
    protocolName: json['protocol_name'] as String?,
    commitmentId: json['commitment_id'] as String?,
    commitment: json['commitment'] != null
        ? MatchedCommitment.fromJson(json['commitment'] as Map<String, dynamic>)
        : null,
    createdAt: DateTime.parse(json['created_at'] as String),
    latestStatus: json['latest_status'] as String,
    latestOccurredAt: json['latest_occurred_at'] != null
        ? DateTime.parse(json['latest_occurred_at'] as String)
        : null,
  );
}

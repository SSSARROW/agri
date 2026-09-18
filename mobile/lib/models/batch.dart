class Batch {
  final String id;
  final String code;
  final String crop;
  final String? plotId;
  final String? protocolId;
  final String? protocolName;
  final String? commitmentId;
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
        createdAt: DateTime.parse(json['created_at'] as String),
        latestStatus: json['latest_status'] as String,
        latestOccurredAt: json['latest_occurred_at'] != null
            ? DateTime.parse(json['latest_occurred_at'] as String)
            : null,
      );
}

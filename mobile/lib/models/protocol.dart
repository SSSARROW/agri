class ProtocolSummary {
  final String id;
  final String crop;
  final String tier;
  final String name;
  final String source;

  ProtocolSummary({
    required this.id,
    required this.crop,
    required this.tier,
    required this.name,
    required this.source,
  });

  factory ProtocolSummary.fromJson(Map<String, dynamic> json) => ProtocolSummary(
        id: json['id'] as String,
        crop: json['crop'] as String,
        tier: json['tier'] as String,
        name: json['name'] as String,
        source: json['source'] as String,
      );
}

class ProtocolStage {
  final int sequence;
  final int? dayOffset;
  final String title;
  final String instructions;

  ProtocolStage({required this.sequence, required this.dayOffset, required this.title, required this.instructions});

  factory ProtocolStage.fromJson(Map<String, dynamic> json) => ProtocolStage(
        sequence: json['sequence'] as int,
        dayOffset: json['day_offset'] as int?,
        title: json['title'] as String,
        instructions: json['instructions'] as String,
      );
}

class ProtocolDetail extends ProtocolSummary {
  final List<ProtocolStage> stages;

  ProtocolDetail({
    required super.id,
    required super.crop,
    required super.tier,
    required super.name,
    required super.source,
    required this.stages,
  });

  factory ProtocolDetail.fromJson(Map<String, dynamic> json) => ProtocolDetail(
        id: json['id'] as String,
        crop: json['crop'] as String,
        tier: json['tier'] as String,
        name: json['name'] as String,
        source: json['source'] as String,
        stages: (json['stages'] as List).cast<Map<String, dynamic>>().map(ProtocolStage.fromJson).toList(),
      );
}

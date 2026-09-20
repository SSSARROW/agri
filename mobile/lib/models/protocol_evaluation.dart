class StageEvaluation {
  final int sequence;
  final String title;
  final String instructions;
  final int? dayOffset;
  final DateTime? dueDate;
  final List<String>? requiredEventTypes;
  final bool? satisfied;
  final String status; // standing | done | overdue | upcoming | pending

  StageEvaluation({
    required this.sequence,
    required this.title,
    required this.instructions,
    required this.dayOffset,
    required this.dueDate,
    required this.requiredEventTypes,
    required this.satisfied,
    required this.status,
  });

  factory StageEvaluation.fromJson(Map<String, dynamic> json) =>
      StageEvaluation(
        sequence: json['sequence'] as int,
        title: json['title'] as String,
        instructions: json['instructions'] as String,
        dayOffset: json['day_offset'] as int?,
        dueDate: json['due_date'] != null
            ? DateTime.parse(json['due_date'] as String)
            : null,
        requiredEventTypes: (json['required_event_types'] as List?)
            ?.cast<String>(),
        satisfied: json['satisfied'] as bool?,
        status: json['status'] as String,
      );
}

class ProtocolEvaluation {
  final String protocolId;
  final String protocolName;
  final String protocolTier;
  final String protocolSource;
  final List<StageEvaluation> stages;
  final int requiredTotal;
  final int requiredSatisfied;
  final bool tierAchieved;

  ProtocolEvaluation({
    required this.protocolId,
    required this.protocolName,
    required this.protocolTier,
    required this.protocolSource,
    required this.stages,
    required this.requiredTotal,
    required this.requiredSatisfied,
    required this.tierAchieved,
  });

  factory ProtocolEvaluation.fromJson(Map<String, dynamic> json) =>
      ProtocolEvaluation(
        protocolId: json['protocol_id'] as String,
        protocolName: json['protocol_name'] as String,
        protocolTier: json['protocol_tier'] as String,
        protocolSource: json['protocol_source'] as String,
        stages: (json['stages'] as List)
            .cast<Map<String, dynamic>>()
            .map(StageEvaluation.fromJson)
            .toList(),
        requiredTotal: json['required_total'] as int,
        requiredSatisfied: json['required_satisfied'] as int,
        tierAchieved: json['tier_achieved'] as bool,
      );
}

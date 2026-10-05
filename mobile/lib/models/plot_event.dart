/// A raw recorded event on a plot (currently just "planted", but this isn't
/// type-specific) — used to look back at the full detail behind a summary
/// line like PlotPlanting, not just what PlotOut.plantings surfaces.
class PlotEvent {
  final String id;
  final String eventType;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;

  PlotEvent({
    required this.id,
    required this.eventType,
    required this.payload,
    required this.occurredAt,
  });

  factory PlotEvent.fromJson(Map<String, dynamic> json) => PlotEvent(
    id: json['id'] as String,
    eventType: json['event_type'] as String,
    payload: json['payload'] as Map<String, dynamic>,
    occurredAt: DateTime.parse(json['occurred_at'] as String),
  );
}

class PlotPhoto {
  final String id;
  final String eventType; // "plot_photo" | "progress_photo"
  final String photoUrl;
  final String? caption;
  final DateTime occurredAt;
  final bool locationFlagged;

  PlotPhoto({
    required this.id,
    required this.eventType,
    required this.photoUrl,
    required this.caption,
    required this.occurredAt,
    required this.locationFlagged,
  });

  factory PlotPhoto.fromJson(Map<String, dynamic> json) {
    final payload = json['payload'] as Map<String, dynamic>;
    return PlotPhoto(
      id: json['id'] as String,
      eventType: json['event_type'] as String,
      photoUrl: payload['photo_url'] as String,
      caption: payload['caption'] as String?,
      occurredAt: DateTime.parse(json['occurred_at'] as String),
      locationFlagged: payload['location_flagged'] as bool? ?? false,
    );
  }
}

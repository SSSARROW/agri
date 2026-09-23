class PhotoCheckpoint {
  final int sequence;
  final DateTime dueDate;
  final bool satisfied;
  final String status; // "done" | "overdue" | "upcoming"

  PhotoCheckpoint({
    required this.sequence,
    required this.dueDate,
    required this.satisfied,
    required this.status,
  });

  factory PhotoCheckpoint.fromJson(Map<String, dynamic> json) =>
      PhotoCheckpoint(
        sequence: json['sequence'] as int,
        dueDate: DateTime.parse(json['due_date'] as String),
        satisfied: json['satisfied'] as bool,
        status: json['status'] as String,
      );
}

// How often a progress photo is expected during the growing cycle — a
// platform quality-maintenance cadence (see api/app/api/routes/photos.py),
// not a claim from any cited protocol.
class PlotPhotoSchedule {
  final String plotId;
  final bool hasRegistrationPhoto;
  final DateTime? plantedAt;
  final int intervalDays;
  final List<PhotoCheckpoint> checkpoints;

  PlotPhotoSchedule({
    required this.plotId,
    required this.hasRegistrationPhoto,
    required this.plantedAt,
    required this.intervalDays,
    required this.checkpoints,
  });

  factory PlotPhotoSchedule.fromJson(Map<String, dynamic> json) =>
      PlotPhotoSchedule(
        plotId: json['plot_id'] as String,
        hasRegistrationPhoto: json['has_registration_photo'] as bool,
        plantedAt: json['planted_at'] != null
            ? DateTime.parse(json['planted_at'] as String)
            : null,
        intervalDays: json['interval_days'] as int,
        checkpoints: (json['checkpoints'] as List)
            .cast<Map<String, dynamic>>()
            .map(PhotoCheckpoint.fromJson)
            .toList(),
      );
}

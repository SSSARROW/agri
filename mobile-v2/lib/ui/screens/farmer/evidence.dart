import '../../../core/format.dart';
import '../../../data/models.dart';
import '../../widgets/common.dart';

/// The single most urgent photo-evidence status for a plot.
({String text, Tone tone})? evidenceStatus(PhotoSchedule? s) {
  if (s == null) return null;
  if (!s.hasRegistrationPhoto) return (text: 'No registration photo on file', tone: Tone.bad);
  final o = s.overdue;
  if (o != null) return (text: 'Progress photo overdue since ${fmtDate(o.due)}', tone: Tone.bad);
  final n = s.nextDue;
  if (n != null) return (text: 'Next progress photo due ${fmtDate(n.due)}', tone: Tone.info);
  return null;
}

String eventTypeLabel(String t) => switch (t) {
      'plot_photo' => 'Registration photo',
      'planting_photo' => 'Planting photo',
      'progress_photo' => 'Progress photo',
      'batch_photo' => 'Batch photo',
      'planted' => 'Planted',
      'collect' => 'Collected',
      'weigh' => 'Weighed',
      'process' => 'Processed',
      'grade' => 'Graded',
      'pack' => 'Packed',
      'collector_attestation' => 'Collector\'s condition check',
      _ => titleCase(t),
    };

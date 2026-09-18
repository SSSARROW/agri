/// Config-driven capture forms per event type (M-05) — one dialog renderer
/// in scan_page.dart reads this list, rather than a hand-built screen per
/// pipeline stage. Adding a new stage should only ever mean adding an entry
/// here.
class StageField {
  final String key;
  final String label;
  final bool numeric;
  const StageField({
    required this.key,
    required this.label,
    this.numeric = false,
  });
}

class StageConfig {
  final String eventType;
  final String label;
  final List<StageField> fields;
  const StageConfig({
    required this.eventType,
    required this.label,
    this.fields = const [],
  });
}

const List<StageConfig> pipelineStages = [
  StageConfig(eventType: 'collect', label: 'Collect'),
  StageConfig(
    eventType: 'weigh',
    label: 'Weigh',
    fields: [StageField(key: 'weight_kg', label: 'Weight (kg)', numeric: true)],
  ),
  StageConfig(eventType: 'process', label: 'Process'),
  StageConfig(
    eventType: 'grade',
    label: 'Grade',
    fields: [StageField(key: 'grade', label: 'Grade (e.g. BOPF)')],
  ),
  StageConfig(
    eventType: 'pack',
    label: 'Pack',
    fields: [
      StageField(
        key: 'package_count',
        label: 'Number of packages',
        numeric: true,
      ),
    ],
  ),
];

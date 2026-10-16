import 'dart:io';

import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../core/photo_capture.dart';
import '../core/stage_proofs_service.dart';
import '../models/plot.dart';
import '../models/stage_proof.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';

String _formatDateTime(DateTime d) {
  final local = d.toLocal();
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');
  return '${local.day}/${local.month}/${local.year} $hh:$mm';
}

String _labelize(String key) {
  return key
      .split('_')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

// web/backend's submit endpoint requires at least one photo_url regardless
// of what a stage's own required_proof.photo_count says (confirmed against
// the live API: a stage declaring 0 photos still 422s on an empty list) —
// so the farmer is always asked for at least one, even for a "0 photos"
// stage, to match what the server will actually accept.
int _effectivePhotoCount(StageWithStatus stage) =>
    stage.requiredProof.photoCount > 0 ? stage.requiredProof.photoCount : 1;

/// Your approved exporter's published quality standard(s), stage by stage —
/// what you need to photograph and record for each one, and your current
/// submission status. Reached from market_page.dart's "My exporter" tab
/// once the relationship is approved (farmer/stage-proofs on web/backend).
class StageProofsPage extends StatefulWidget {
  const StageProofsPage({super.key});

  @override
  State<StageProofsPage> createState() => _StageProofsPageState();
}

class _StageProofsPageState extends State<StageProofsPage> {
  FarmerStandardsResponse? _standards;
  Map<String, SubmissionOut> _submissionsById = {};
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      StageProofsService.myStandards(),
      StageProofsService.mySubmissions(),
    ]);
    if (!mounted) return;
    final standardsResult = results[0] as FarmResult<FarmerStandardsResponse>;
    final submissionsResult = results[1] as FarmResult<List<SubmissionOut>>;
    setState(() {
      _loading = false;
      if (standardsResult.isOk) {
        _standards = standardsResult.data;
        _error = null;
      } else {
        _error = standardsResult.error;
      }
      // Standards already carries submission_status/submission_id per
      // stage — this is only fetched to surface review_notes, which the
      // standards endpoint doesn't include.
      if (submissionsResult.isOk) {
        _submissionsById = {
          for (final s in submissionsResult.data!) s.id: s,
        };
      }
    });
  }

  Future<void> _openSubmit(
    StageWithStatus stage,
    StandardWithStages standard,
  ) async {
    final submitted = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _SubmitProofPage(stage: stage, standard: standard),
      ),
    );
    if (submitted == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quality standard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Submission history',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const SubmissionHistoryPage(),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    final standards = _standards;
    if (standards == null || !standards.hasApprovedExporter) {
      return const EmptyState(
        icon: Icons.handshake_outlined,
        title: 'No approved exporter relationship',
        subtitle:
            'You need an approved exporter relationship before you can submit stage proof.',
      );
    }
    if (standards.standards.isEmpty) {
      return EmptyState(
        icon: Icons.fact_check_outlined,
        title: 'No published standard yet',
        subtitle:
            '${standards.exporterCompanyName ?? 'Your exporter'} hasn\'t '
            'published a quality standard yet. Check back soon.',
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final standard in standards.standards) ...[
            SectionHeader(
              '${standard.crop} · ${standard.standardName} (v${standard.versionNumber})',
            ),
            const SizedBox(height: 8),
            for (final stage in standard.stages)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _StageCard(
                  stage: stage,
                  submission: stage.submissionId != null
                      ? _submissionsById[stage.submissionId]
                      : null,
                  onSubmit: () => _openSubmit(stage, standard),
                ),
              ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _StageCard extends StatelessWidget {
  final StageWithStatus stage;
  final SubmissionOut? submission;
  final VoidCallback onSubmit;

  const _StageCard({
    required this.stage,
    required this.submission,
    required this.onSubmit,
  });

  (StatusLevel, String) get _statusDisplay {
    if (stage.isApproved) return (StatusLevel.success, 'APPROVED');
    if (stage.isPending) return (StatusLevel.warning, 'PENDING REVIEW');
    if (stage.isRejected) return (StatusLevel.danger, 'REJECTED');
    return (StatusLevel.neutral, 'NOT SUBMITTED');
  }

  @override
  Widget build(BuildContext context) {
    final (level, label) = _statusDisplay;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const IconCircle(Icons.eco_outlined, size: 36),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${stage.position}. ${stage.name}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ),
                StatusPill(label, level: level),
              ],
            ),
            if (stage.instructions.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(stage.instructions, style: const TextStyle(fontSize: 13)),
            ],
            Builder(
              builder: (context) {
                final photoCount = _effectivePhotoCount(stage);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.camera_alt_outlined,
                          size: 14,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$photoCount photo${photoCount == 1 ? '' : 's'} required as proof',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ),
                    if (stage.requiredProof.quickFields.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Also record: ${stage.requiredProof.quickFields.map(_labelize).join(', ')}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.black45,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
            if (stage.dos.isNotEmpty || stage.donts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final d in stage.dos)
                      Text(
                        '✓ $d',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.success,
                        ),
                      ),
                    for (final d in stage.donts)
                      Text(
                        '✕ $d',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.danger,
                        ),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 10),
            _buildStatusAction(),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusAction() {
    if (stage.isApproved) {
      return const StatusRow(
        'Approved by your exporter.',
        level: StatusLevel.success,
      );
    }
    if (stage.isPending) {
      return const StatusRow(
        'Submitted — awaiting your exporter\'s review.',
        level: StatusLevel.warning,
      );
    }
    if (stage.isRejected) {
      final reason = submission?.reviewNotes;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.dangerBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Rejected',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppColors.danger,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  reason != null && reason.isNotEmpty
                      ? reason
                      : 'Your exporter rejected this submission.',
                  style: const TextStyle(fontSize: 13, color: AppColors.danger),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (stage.canResubmit)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: onSubmit,
                child: const Text('Resubmit proof'),
              ),
            )
          else
            const StatusRow(
              'Waiting for your exporter to reopen this stage before you can resubmit.',
              level: StatusLevel.neutral,
            ),
        ],
      );
    }
    // Never submitted.
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        onPressed: onSubmit,
        child: const Text('Submit proof'),
      ),
    );
  }
}

/// Per-photo capture/upload state — kept separate per slot so a failed
/// upload on one photo never discards another slot's already-uploaded URL.
class _PhotoSlot {
  File? file;
  String? url;
  String? error;
  bool busy = false;
}

/// Capture `photo_count` camera photos (each uploaded to api/'s photo
/// endpoint as it's taken), fill in any quick fields, add an optional note,
/// then submit everything to web/backend as one stage-proof submission.
class _SubmitProofPage extends StatefulWidget {
  final StageWithStatus stage;
  final StandardWithStages standard;
  const _SubmitProofPage({required this.stage, required this.standard});

  @override
  State<_SubmitProofPage> createState() => _SubmitProofPageState();
}

class _SubmitProofPageState extends State<_SubmitProofPage> {
  List<Plot>? _plots;
  String? _plotId;
  String? _plotsError;
  bool _loadingPlots = true;
  late List<_PhotoSlot> _slots;
  late Map<String, TextEditingController> _quickFieldControllers;
  final _noteController = TextEditingController();
  bool _submitting = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _slots = List.generate(
      _effectivePhotoCount(widget.stage),
      (_) => _PhotoSlot(),
    );
    _quickFieldControllers = {
      for (final f in widget.stage.requiredProof.quickFields)
        f: TextEditingController(),
    };
    _loadPlots();
  }

  @override
  void dispose() {
    _noteController.dispose();
    for (final c in _quickFieldControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadPlots() async {
    final result = await FarmService.myPlots();
    if (!mounted) return;
    setState(() {
      _loadingPlots = false;
      if (result.isOk) {
        _plots = result.data;
        if (_plots != null && _plots!.length == 1) {
          _plotId = _plots!.first.id;
        }
        _plotsError = null;
      } else {
        _plotsError = result.error;
      }
    });
  }

  bool get _allPhotosDone => _slots.every((s) => s.url != null);

  bool get _canSubmit =>
      _plotId != null &&
      _allPhotosDone &&
      !_submitting &&
      !_slots.any((s) => s.busy);

  Future<void> _captureSlot(int index) async {
    if (_plotId == null) {
      setState(() => _submitError = 'Pick a plot first.');
      return;
    }
    final slot = _slots[index];
    setState(() {
      slot.busy = true;
      slot.error = null;
      _submitError = null;
    });
    File? file;
    try {
      file = await PhotoCapture.takePhoto();
    } catch (_) {
      file = null;
    }
    if (file == null) {
      if (mounted) setState(() => slot.busy = false);
      return;
    }
    if (mounted) setState(() => slot.file = file);
    final result = await FarmService.uploadPlotPhoto(
      plotId: _plotId!,
      eventType: 'progress_photo',
      imageFile: file,
    );
    if (!mounted) return;
    setState(() {
      slot.busy = false;
      if (result.isOk) {
        slot.url = result.data!.photoUrl;
        slot.error = null;
      } else {
        slot.url = null;
        slot.error = result.error;
      }
    });
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    final result = await StageProofsService.submitProof(
      stageId: widget.stage.stageId,
      photoUrls: _slots.map((s) => s.url!).toList(),
      quickFieldAnswers: {
        for (final entry in _quickFieldControllers.entries)
          entry.key: entry.value.text.trim(),
      },
      note: _noteController.text.trim().isEmpty
          ? null
          : _noteController.text.trim(),
      plotId: _plotId,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (result.isOk) {
      Navigator.of(context).pop(true);
    } else {
      setState(() => _submitError = result.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.stage.name)),
      body: SafeArea(
        child: _loadingPlots
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_plotsError != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _plotsError!,
                        style: const TextStyle(color: AppColors.danger),
                      ),
                    ),
                  if (_plots != null && _plots!.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'You need at least one registered plot before you can submit proof.',
                        style: TextStyle(color: AppColors.danger),
                      ),
                    ),
                  if (_plots != null && _plots!.length > 1) _buildPlotPicker(),
                  const SectionHeader('Photo proof'),
                  for (var i = 0; i < _slots.length; i++) _buildPhotoSlot(i),
                  if (_quickFieldControllers.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const SectionHeader('Details'),
                    for (final entry in _quickFieldControllers.entries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: TextField(
                          controller: entry.value,
                          decoration: InputDecoration(
                            labelText: _labelize(entry.key),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                  ],
                  const SizedBox(height: 8),
                  const SectionHeader('Note (optional)'),
                  TextField(
                    controller: _noteController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Anything your exporter should know',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_submitError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _submitError!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: _canSubmit ? _submit : null,
                      child: _submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Submit proof',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildPlotPicker() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<String>(
        initialValue: _plotId,
        decoration: const InputDecoration(
          labelText: 'Which plot is this for',
          border: OutlineInputBorder(),
        ),
        items: [
          for (final p in _plots!)
            DropdownMenuItem(value: p.id, child: Text(p.title)),
        ],
        onChanged: (v) => setState(() => _plotId = v),
      ),
    );
  }

  Widget _buildPhotoSlot(int index) {
    final slot = _slots[index];
    final descriptions = widget.stage.requiredProof.photoDescriptions;
    final description = index < descriptions.length
        ? descriptions[index]
        : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: (_plotId == null || slot.busy)
                ? null
                : () => _captureSlot(index),
            child: Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: Colors.black12,
                borderRadius: BorderRadius.circular(10),
                image: slot.file != null
                    ? DecorationImage(
                        image: FileImage(slot.file!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: slot.busy
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : slot.file == null
                  ? const Icon(Icons.camera_alt_outlined, color: Colors.black45)
                  : Align(
                      alignment: Alignment.bottomRight,
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(
                          slot.url != null ? Icons.check_circle : Icons.error,
                          color: slot.url != null
                              ? AppColors.success
                              : AppColors.danger,
                          size: 20,
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  description != null && description.isNotEmpty
                      ? description
                      : 'Photo ${index + 1}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                if (slot.error != null)
                  Text(
                    slot.error!,
                    style: const TextStyle(fontSize: 12, color: AppColors.danger),
                  ),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: (_plotId == null || slot.busy)
                      ? null
                      : () => _captureSlot(index),
                  child: Text(
                    slot.url != null
                        ? 'Retake'
                        : (slot.error != null ? 'Retry' : 'Take photo'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Full submission history across every stage, newest first — review notes
/// shown prominently on anything rejected, since that's the whole point of
/// the manual-review loop.
class SubmissionHistoryPage extends StatefulWidget {
  const SubmissionHistoryPage({super.key});

  @override
  State<SubmissionHistoryPage> createState() => _SubmissionHistoryPageState();
}

class _SubmissionHistoryPageState extends State<SubmissionHistoryPage> {
  List<SubmissionOut>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await StageProofsService.mySubmissions();
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _items = result.data;
        _error = null;
      } else {
        _error = result.error;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Submission history')),
      body: SafeArea(
        child: _error != null
            ? Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.danger),
                ),
              )
            : _items == null
            ? const Center(child: CircularProgressIndicator())
            : _items!.isEmpty
            ? const EmptyState(
                icon: Icons.history,
                title: 'No submissions yet',
                subtitle: 'Submit your first stage proof to see it here.',
              )
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items!.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _buildItem(_items![i]),
                ),
              ),
      ),
    );
  }

  Widget _buildItem(SubmissionOut s) {
    final level = switch (s.status) {
      'approved' => StatusLevel.success,
      'rejected' => StatusLevel.danger,
      _ => StatusLevel.warning,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    s.stageName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ),
                StatusPill(s.status.toUpperCase(), level: level),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Submitted ${_formatDateTime(s.submittedAt)}',
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
            if (s.reviewedAt != null)
              Text(
                'Reviewed ${_formatDateTime(s.reviewedAt!)}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            if (s.status == 'rejected' &&
                s.reviewNotes != null &&
                s.reviewNotes!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  s.reviewNotes!,
                  style: const TextStyle(fontSize: 13, color: AppColors.danger),
                ),
              ),
            ],
            if (s.note != null && s.note!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Note: ${s.note}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
            if (s.photoUrls.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(
                    Icons.photo_library_outlined,
                    size: 14,
                    color: Colors.black45,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${s.photoUrls.length} photo${s.photoUrls.length == 1 ? '' : 's'}',
                    style: const TextStyle(fontSize: 12, color: Colors.black45),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

import 'dart:io';

import 'package:flutter/material.dart';

import '../../../core/device.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';

class ExporterScreen extends StatefulWidget {
  const ExporterScreen({super.key});
  @override
  State<ExporterScreen> createState() => _ExporterScreenState();
}

class _ExporterScreenState extends State<ExporterScreen> {
  int _rev = 0;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My exporter')),
      body: AsyncView<(ExporterLink?, List<VerifiedExporter>)>(
        key: ValueKey(_rev),
        load: () async {
          final link = await Services.repo.currentLink();
          final list = link == null ? await Services.repo.exporters() : <VerifiedExporter>[];
          return (link, list);
        },
        builder: (context, data, reload) {
          final (link, exporters) = data;
          final t = Theme.of(context).textTheme;
          if (link != null) return _current(context, link, t);
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Banner2(tone: Tone.info, title: 'You are not following an exporter', body: 'Following an exporter\'s quality standard lets them see your plots and records, and lets you send proof photos. You can follow one exporter at a time.'),
            Gaps.m,
            if (exporters.isEmpty) const EmptyPanel(icon: Icons.business_outlined, title: 'No verified exporters yet', body: 'Check back soon.'),
            for (final e in exporters)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(e.companyName, style: t.titleLarge),
                      if ((e.description ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(e.description!, style: t.bodyMedium)),
                      Gaps.s,
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final c in e.crops) Pill(titleCase(c), tone: Tone.good),
                        for (final c in e.certifications) Pill(c, tone: Tone.info, icon: Icons.verified_outlined),
                      ]),
                      if (e.districts.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Buys in ${e.districts.take(6).join(', ')}${e.districts.length > 6 ? ' +${e.districts.length - 6} more' : ''}', style: t.bodySmall)),
                      Gaps.m,
                      FilledButton(
                        onPressed: () async {
                          final ok = await confirmDialog(context, title: 'Follow ${e.companyName}?', body: 'You can only follow one exporter at a time. They will review your request.', confirm: 'Send request');
                          if (!ok) return;
                          try {
                            await Services.repo.requestLink(e.id);
                            if (context.mounted) snack(context, 'Request sent.');
                            setState(() => _rev++);
                          } catch (err) {
                            if (context.mounted) snack(context, errText(err));
                          }
                        },
                        child: const Text('Request to follow their standard'),
                      ),
                    ]),
                  ),
                ),
              ),
          ]);
        },
      ),
    );
  }

  Widget _current(BuildContext context, ExporterLink link, TextTheme t) {
    final approved = link.status == 'approved';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: approved ? C.leaf50 : C.warn50, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Pill(approved ? 'Following' : 'Waiting for approval', tone: approved ? Tone.good : Tone.warn),
          Gaps.s,
          Text(link.exporterName ?? 'Exporter', style: t.headlineMedium),
          Gaps.xs,
          Text(
            approved
                ? 'You\'re following this exporter\'s quality standard. Keep your planting and progress records up to date. This is who sees them.'
                : 'Requested ${fmtDate(link.requestedAt)}. They will review it soon. You can\'t follow another exporter while this is open.',
            style: t.bodyLarge,
          ),
        ]),
      ),
      Gaps.m,
      if (approved)
        FilledButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StageProofScreen())), icon: const Icon(Icons.photo_camera_outlined), label: const Text('Send stage proof'))
      else
        OutlinedButton(
          onPressed: () async {
            final ok = await confirmDialog(context, title: 'Cancel your request?', body: 'You can then request a different exporter.', confirm: 'Cancel request', danger: true);
            if (!ok) return;
            try {
              await Services.repo.cancelLink();
              if (context.mounted) snack(context, 'Request cancelled.');
              setState(() => _rev++);
            } catch (e) {
              if (context.mounted) snack(context, errText(e));
            }
          },
          child: const Text('Cancel request'),
        ),
    ]);
  }
}

/* ── Stage proof ──────────────────────────────────────────────────────────── */

class StageProofScreen extends StatefulWidget {
  const StageProofScreen({super.key});
  @override
  State<StageProofScreen> createState() => _StageProofScreenState();
}

class _StageProofScreenState extends State<StageProofScreen> {
  int _rev = 0;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Stage proof')),
      body: AsyncView<(ProofStandards, List<Submission>)>(
        key: ValueKey(_rev),
        load: () async {
          final s = await Services.repo.proofStandards();
          final subs = s.hasApprovedExporter ? await Services.repo.mySubmissions().catchError((_) => <Submission>[]) : <Submission>[];
          return (s, subs);
        },
        builder: (context, data, reload) {
          final (s, subs) = data;
          final t = Theme.of(context).textTheme;
          if (!s.hasApprovedExporter) return const EmptyPanel(icon: Icons.handshake_outlined, title: 'Follow an exporter first', body: 'Once an exporter approves you, their quality standard\'s stages appear here for you to send proof.');
          if (s.standards.isEmpty) return EmptyPanel(icon: Icons.hourglass_empty, title: 'Nothing to prove yet', body: '${s.exporterName ?? 'Your exporter'} hasn\'t published a quality standard yet.');
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final std in s.standards) ...[
              Section('${std.name} · v${std.version}', subtitle: std.crop, children: [
                for (final st in std.stages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Tappable(
                      onTap: () async {
                        final status = st.submissionStatus;
                        final canSubmit = status == null || status == 'none' || (status == 'rejected' && st.canResubmit);
                        if (!canSubmit) {
                          snack(context, status == 'pending' ? 'This stage is waiting for your exporter to review it.' : status == 'approved' ? 'This stage is approved.' : 'Waiting for your exporter to reopen this stage before you can resubmit.');
                          return;
                        }
                        final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => SubmitProofScreen(stage: st)));
                        if (ok == true) setState(() => _rev++);
                      },
                      child: Row(children: [
                        CircleAvatar(radius: 18, backgroundColor: C.leaf100, child: Text('${st.position}', style: const TextStyle(fontWeight: FontWeight.w700, color: C.leaf700))),
                        Gaps.m,
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(st.name, style: t.titleMedium),
                            Text(st.timing == 'recurring' ? 'Repeats · from day ${st.startOffset}' : 'Day ${st.startOffset}', style: t.bodySmall),
                          ]),
                        ),
                        _statusPill(st),
                      ]),
                    ),
                  ),
              ]),
            ],
            if (subs.isNotEmpty) ...[
              Gaps.m,
              Section('Your submissions', children: [
                for (final sub in subs)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [Expanded(child: Text(sub.stageName, style: t.titleMedium)), Pill(titleCase(sub.status), tone: statusTone(sub.status))]),
                          Text('Sent ${fmtDate(sub.submittedAt)} · ${sub.photos.length} photo${sub.photos.length == 1 ? '' : 's'}', style: t.bodySmall),
                          if (sub.status == 'rejected' && (sub.reviewNotes ?? '').isNotEmpty)
                            Padding(padding: const EdgeInsets.only(top: 10), child: Banner2(tone: Tone.bad, title: 'Sent back', body: sub.reviewNotes)),
                          if (sub.status == 'approved' && (sub.reviewNotes ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('“${sub.reviewNotes}”', style: t.bodyMedium)),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ],
            Gaps.m,
            Text('Proof photos also appear in your plot\'s photo history and on the public batch page.', style: t.bodySmall),
          ]);
        },
      ),
    );
  }

  Widget _statusPill(ProofStage st) {
    return switch (st.submissionStatus) {
      'pending' => const Pill('In review', tone: Tone.warn),
      'approved' => const Pill('Approved', tone: Tone.good),
      'rejected' => st.canResubmit ? const Pill('Resubmit', tone: Tone.bad) : const Pill('Awaiting exporter', tone: Tone.neutral),
      _ => const Pill('Send proof', tone: Tone.bark),
    };
  }
}

class SubmitProofScreen extends StatefulWidget {
  const SubmitProofScreen({super.key, required this.stage});
  final ProofStage stage;
  @override
  State<SubmitProofScreen> createState() => _SubmitProofScreenState();
}

class _Slot {
  String? localPath, url;
  bool uploading = false;
  String? error;
}

class _SubmitProofScreenState extends State<SubmitProofScreen> {
  late final int _count = widget.stage.photoCount < 1 ? 1 : widget.stage.photoCount; // the server rejects an empty list
  late final List<_Slot> _slots = List.generate(_count, (_) => _Slot());
  late final Map<String, TextEditingController> _answers = {for (final f in widget.stage.quickFields) f: TextEditingController()};
  final _note = TextEditingController();
  List<Plot>? _plots;
  String? _plotId, _plotsError;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlots();
  }

  Future<void> _loadPlots() async {
    setState(() => _plotsError = null);
    try {
      final p = await Services.repo.myPlots();
      if (!mounted) return;
      setState(() {
        _plots = p;
        if (p.length == 1) _plotId = p.first.id;
      });
    } catch (e) {
      if (mounted) setState(() => _plotsError = errText(e));
    }
  }

  Future<void> _shoot(int i) async {
    if (_plotId == null) {
      snack(context, 'Choose the plot first.');
      return;
    }
    final path = await Device.takePhoto();
    if (path == null) return;
    final s = _slots[i];
    setState(() {
      s.localPath = path;
      s.url = null;
      s.uploading = true;
      s.error = null;
    });
    try {
      final fix = await Device.tryFix();
      final ev = await Services.repo.uploadPhoto(filePath: path, plotId: _plotId!, eventType: 'progress_photo', caption: widget.stage.name, lat: fix?.lat, lon: fix?.lon);
      if (mounted) setState(() => s.url = ev.photoUrl);
    } catch (e) {
      if (mounted) setState(() => s.error = errText(e));
    } finally {
      if (mounted) setState(() => s.uploading = false);
    }
  }

  bool get _ready => _plotId != null && _slots.every((s) => s.url != null) && !_slots.any((s) => s.uploading) && !_submitting;

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await Services.repo.submitProof(
        widget.stage.id,
        photoUrls: _slots.map((s) => s.url!).toList(),
        answers: {for (final e in _answers.entries) e.key: e.value.text.trim()},
        note: _note.text,
        plotId: _plotId,
      );
      if (!mounted) return;
      snack(context, 'Proof sent for review.');
      Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final st = widget.stage;
    return Scaffold(
      appBar: AppBar(title: Text(st.name)),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
        if (st.instructions.isNotEmpty) Text(st.instructions, style: t.bodyLarge),
        for (final d in st.dos) Padding(padding: const EdgeInsets.only(top: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.check, size: 20, color: C.leaf600), Gaps.s, Expanded(child: Text(d))])),
        for (final d in st.donts) Padding(padding: const EdgeInsets.only(top: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.close, size: 20, color: C.danger), Gaps.s, Expanded(child: Text(d))])),
        Gaps.l,
        Text('Which plot?', style: t.titleMedium),
        Gaps.s,
        if (_plotsError != null) ErrorPanel(message: _plotsError!, onRetry: _loadPlots)
        else if (_plots == null) const Center(child: CircularProgressIndicator(color: C.leaf600))
        else if (_plots!.isEmpty) const Banner2(tone: Tone.warn, title: 'Register a plot first', body: 'Proof photos are stored with a plot.')
        else
          Column(children: [for (final p in _plots!) Padding(padding: const EdgeInsets.only(bottom: 8), child: ChoiceTile(title: p.displayName, subtitle: p.location, selected: _plotId == p.id, onTap: () => setState(() => _plotId = p.id)))]),
        Gaps.l,
        Text('Photos', style: t.titleMedium),
        Gaps.s,
        for (var i = 0; i < _slots.length; i++) _slotTile(i, t),
        if (_answers.isNotEmpty) ...[
          Gaps.l,
          Text('Quick answers', style: t.titleMedium),
          Gaps.s,
          for (final e in _answers.entries) Padding(padding: const EdgeInsets.only(bottom: 12), child: TextField(controller: e.value, decoration: InputDecoration(labelText: titleCase(e.key)))),
        ],
        Gaps.m,
        TextField(controller: _note, maxLines: 3, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Note (optional)')),
        if (_error != null) ...[Gaps.m, Banner2(tone: Tone.bad, title: _error!)],
        Gaps.l,
        BusyButton(label: 'Send proof', busy: _submitting, onPressed: _ready ? _submit : null),
      ]),
    );
  }

  Widget _slotTile(int i, TextTheme t) {
    final s = _slots[i];
    final desc = i < widget.stage.photoDescriptions.length ? widget.stage.photoDescriptions[i] : 'Photo ${i + 1}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            GestureDetector(
              onTap: s.uploading ? null : () => _shoot(i),
              child: Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(color: C.sunken, borderRadius: BorderRadius.circular(12)),
                clipBehavior: Clip.antiAlias,
                child: s.localPath != null ? Image.file(File(s.localPath!), fit: BoxFit.cover) : const Icon(Icons.add_a_photo_outlined, size: 32, color: C.inkMute),
              ),
            ),
            Gaps.m,
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(desc, style: t.titleMedium),
                if (s.uploading) const Padding(padding: EdgeInsets.only(top: 6), child: Row(children: [SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2.5)), SizedBox(width: 8), Text('Uploading…')]))
                else if (s.error != null) Text(s.error!, style: const TextStyle(color: C.danger, fontSize: 14))
                else if (s.url != null) const Text('Uploaded', style: TextStyle(color: C.leaf700, fontWeight: FontWeight.w600))
                else Text('Tap to take photo', style: t.bodySmall),
                if (s.localPath != null && !s.uploading) TextButton(style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 40)), onPressed: () => _shoot(i), child: Text(s.error != null ? 'Retry' : 'Retake')),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

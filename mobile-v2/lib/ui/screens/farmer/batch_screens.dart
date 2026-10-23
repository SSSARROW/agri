import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/config.dart';
import '../../../core/constants.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'evidence.dart';

/* ── Batches tab ──────────────────────────────────────────────────────────── */

class BatchesTab extends StatelessWidget {
  const BatchesTab({super.key});
  static const _order = ['Registered', 'Collected', 'Processing', 'Packed', 'Scanned', 'Other'];

  Future<(List<Batch>, Map<String, Plot>)> _load() async {
    final r = await Future.wait([Services.repo.myBatches(), Services.repo.myPlots().catchError((_) => <Plot>[])]);
    return (r[0] as List<Batch>, {for (final p in r[1] as List<Plot>) p.id: p});
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<(List<Batch>, Map<String, Plot>)>(
      load: _load,
      builder: (context, data, reload) {
        final (batches, plots) = data;
        if (batches.isEmpty) {
          return const EmptyPanel(icon: Icons.inventory_2_outlined, title: 'No harvest batches yet', body: 'Open one of your plots and tap Harvest to register a batch and get its QR label.');
        }
        final groups = <String, List<Batch>>{};
        for (final b in batches) {
          groups.putIfAbsent(b.journey, () => []).add(b);
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final g in _order)
            if (groups[g] != null) ...[
              Section(g, subtitle: '${groups[g]!.length} batch${groups[g]!.length == 1 ? '' : 'es'}', children: [
                for (final b in (groups[g]!..sort((a, c) => (c.latestAt ?? c.createdAt ?? DateTime(2000)).compareTo(a.latestAt ?? a.createdAt ?? DateTime(2000)))))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: BatchCard(batch: b, plotName: b.plotId == null ? 'Combined batch' : (plots[b.plotId]?.displayName ?? 'Plot no longer available'), onChanged: reload),
                  ),
              ]),
              Gaps.s,
            ],
        ]);
      },
    );
  }
}

class BatchCard extends StatelessWidget {
  const BatchCard({super.key, required this.batch, this.plotName, this.onChanged});
  final Batch batch;
  final String? plotName;
  final VoidCallback? onChanged;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final reg = batch.createdAt == null ? '' : 'Registered ${ago(batch.createdAt)}';
    return Tappable(
      onTap: () async {
        await Navigator.push(context, MaterialPageRoute(builder: (_) => BatchDetailScreen(batch: batch, plotName: plotName)));
        onChanged?.call();
      },
      child: Row(children: [
        Container(width: 48, height: 48, decoration: BoxDecoration(color: C.bark50, borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.qr_code_2, color: C.bark600, size: 28)),
        Gaps.m,
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(batch.code, style: t.titleMedium?.copyWith(letterSpacing: 1.2, fontFamily: 'monospace')),
            Text('${batch.crop}${batch.protocolName != null ? ' · ${batch.protocolName}' : ''}', style: t.bodyMedium),
            Text([if (plotName != null) plotName, reg].where((e) => e != null && e.isNotEmpty).join(' · '), style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
        Pill(eventTypeLabel(batch.latestStatus == 'registered' ? 'registered' : batch.latestStatus).replaceFirst('Registered', 'New'), tone: Tone.neutral),
      ]),
    );
  }
}

/* ── Batch detail ─────────────────────────────────────────────────────────── */

class BatchDetailScreen extends StatelessWidget {
  const BatchDetailScreen({super.key, required this.batch, this.plotName});
  final Batch batch;
  final String? plotName;

  static const _hidden = {'lat', 'lon', 'accuracy_m', 'photo_url', 'caption', 'location_flagged', 'distance_from_plot_m', 'crop'};

  String _fieldLabel(String k) => k == 'weight_kg' ? 'Weight' : titleCase(k.replaceAll(RegExp(r'_(kg|ha|m)$'), ''));
  String _fieldValue(String k, dynamic v) => k == 'weight_kg' ? '$v kg' : (v is List ? v.join(', ') : '$v');

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(batch.code, style: const TextStyle(letterSpacing: 1.2))),
      body: AsyncView<List<EventOut>>(
        load: () => Services.repo.batchEvents(batch.id),
        builder: (context, events, reload) {
          final evs = [...events]..sort((a, b) => a.occurredAt.compareTo(b.occurredAt));
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: FilledButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BatchQrScreen(batch: batch))), icon: const Icon(Icons.qr_code_2), label: const Text('QR label'))),
              Gaps.s,
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => RecordStageScreen(batch: batch)));
                    if (ok == true) reload();
                  },
                  icon: const Icon(Icons.add_task),
                  label: const Text('Record step'),
                ),
              ),
            ]),
            Gaps.m,
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  InfoRow('Crop', batch.crop),
                  InfoRow('Standard', batch.protocolName ?? 'None'),
                  InfoRow('Plot', plotName ?? (batch.plotId == null ? 'Combined batch' : null)),
                  InfoRow('Status', eventTypeLabel(batch.latestStatus)),
                ]),
              ),
            ),
            if (batch.commitment != null && batch.commitment!.remainingKg > 0) ...[Gaps.m, _MatchedOrder(c: batch.commitment!)],
            if (batch.protocolId != null) ...[
              Gaps.m,
              Tappable(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BatchProgressScreen(batch: batch))),
                child: Row(children: [const Icon(Icons.fact_check_outlined, color: C.leaf600), Gaps.m, Expanded(child: Text('Quality standard progress', style: t.titleMedium)), const Icon(Icons.chevron_right, color: C.inkMute)]),
              ),
            ],
            Gaps.l,
            Section('Timeline', children: [
              _TimelineRow(icon: Icons.flag_outlined, title: 'Registered', sub: fmtDateTime(batch.createdAt)),
              for (final e in evs)
                _TimelineRow(
                  icon: e.photoUrl != null ? Icons.photo_outlined : Icons.check,
                  title: eventTypeLabel(e.eventType),
                  sub: fmtDateTime(e.occurredAt),
                  detail: [
                    for (final en in e.payload.entries)
                      if (!_hidden.contains(en.key) && en.value != null && '${en.value}'.isNotEmpty) '${_fieldLabel(en.key)}: ${_fieldValue(en.key, en.value)}',
                    if (e.caption != null && e.caption!.isNotEmpty) '“${e.caption}”',
                    if (e.flagged) 'Taken ${e.distanceM?.round() ?? '?'} m from this plot',
                  ],
                  photo: e.photoUrl,
                  last: e == evs.last,
                ),
            ]),
          ]);
        },
      ),
    );
  }
}

class _MatchedOrder extends StatelessWidget {
  const _MatchedOrder({required this.c});
  final Commitment c;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: C.bark50, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.bark100)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Row(children: [Icon(Icons.handshake_outlined, color: C.bark600), SizedBox(width: 8), Text('Matched to an open buyer order', style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: C.bark700))]),
        Gaps.s,
        Text('${fmtKg(c.remainingKg)} wanted${c.price != null ? ' · ${fmtLkr(c.price)} / kg' : ''}', style: Theme.of(context).textTheme.bodyLarge),
        if (c.windowEnd != null) Text('Deliver by ${fmtDate(c.windowEnd)}', style: Theme.of(context).textTheme.bodyMedium),
      ]),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.icon, required this.title, required this.sub, this.detail = const [], this.photo, this.last = false});
  final IconData icon;
  final String title, sub;
  final List<String> detail;
  final String? photo;
  final bool last;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 36,
          child: Column(children: [
            Container(width: 28, height: 28, decoration: const BoxDecoration(color: C.leaf100, shape: BoxShape.circle), child: Icon(icon, size: 16, color: C.leaf700)),
            if (!last) Expanded(child: Container(width: 2, color: C.line)),
          ]),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 18, left: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: t.titleMedium),
              Text(sub, style: t.bodySmall),
              for (final d in detail) Text(d, style: t.bodyMedium),
              if (photo != null) Padding(padding: const EdgeInsets.only(top: 8), child: NetPhoto(photo!, size: 110)),
            ]),
          ),
        ),
      ]),
    );
  }
}

/* ── Standard progress ────────────────────────────────────────────────────── */

class BatchProgressScreen extends StatelessWidget {
  const BatchProgressScreen({super.key, required this.batch});
  final Batch batch;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Standard progress')),
      body: AsyncView<ProtocolEval>(
        load: () => Services.repo.batchSchedule(batch.id),
        builder: (context, p, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: p.achieved ? C.leaf50 : C.warn50, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Icon(p.achieved ? Icons.verified : Icons.pending_actions, size: 36, color: p.achieved ? C.leaf600 : C.warn),
              Gaps.m,
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.achieved ? 'Verified' : '${p.requiredSatisfied} of ${p.requiredTotal} steps done', style: t.titleLarge),
                  Text(p.achieved ? 'Meets ${p.name}' : p.name, style: t.bodyMedium),
                ]),
              ),
            ]),
          ),
          Gaps.m,
          for (final s in p.stages)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(s.title, style: t.titleMedium)),
                      Pill(s.dayOffset == null && s.status != 'done' ? 'Standing rule' : titleCase(s.status), tone: statusTone(s.status)),
                    ]),
                    if (s.due != null) Text('Due ${fmtDate(s.due)}', style: t.bodySmall),
                    Gaps.xs,
                    Text(s.instructions, style: t.bodyMedium),
                  ]),
                ),
              ),
            ),
          if (p.source.isNotEmpty) Text('Source: ${p.source}', style: t.bodySmall),
        ]),
      ),
    );
  }
}

/* ── QR label ─────────────────────────────────────────────────────────────── */

class BatchQrScreen extends StatelessWidget {
  const BatchQrScreen({super.key, required this.batch, this.justRegistered = false});
  final Batch batch;
  final bool justRegistered;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(justRegistered ? 'Batch registered' : 'QR label')),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 40), children: [
        if (justRegistered) ...[const Banner2(tone: Tone.good, title: 'Your batch is registered', body: 'Print or write this code on the batch label before it leaves you.'), Gaps.m],
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: C.line)),
          child: Column(children: [
            RepaintBoundary(child: QrImageView(data: Config.publicBatchUrl(batch.code), size: 240, backgroundColor: Colors.white, errorCorrectionLevel: QrErrorCorrectLevel.M)),
            Gaps.m,
            Text(batch.code, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: 3, fontFamily: 'monospace')),
            Text('${batch.crop}${batch.protocolName != null ? ' · ${batch.protocolName}' : ''}', style: t.bodyMedium),
          ]),
        ),
        Gaps.m,
        OutlinedButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: batch.code));
            snack(context, 'Code copied');
          },
          icon: const Icon(Icons.copy),
          label: const Text('Copy code'),
        ),
        if (batch.commitment != null && batch.commitment!.remainingKg > 0) ...[Gaps.m, _MatchedOrder(c: batch.commitment!)],
        Gaps.m,
        const Banner2(tone: Tone.info, title: 'How the label works', body: 'Scanned in this app it records the next step. Scanned with any phone camera it opens this batch\'s public history for buyers.'),
        if (!Config.qrIsPublic) ...[Gaps.m, Banner2(tone: Tone.warn, title: 'Do not print this label', body: 'This build points at a test server (${Config.fieldApi}). Buyers\' phones cannot open that address. Use the production app to print real labels.')],
        if (justRegistered) ...[Gaps.l, FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Done'))],
      ]),
    );
  }
}

/* ── Record a stage ───────────────────────────────────────────────────────── */

class RecordStageScreen extends StatefulWidget {
  const RecordStageScreen({super.key, required this.batch});
  final Batch batch;
  @override
  State<RecordStageScreen> createState() => _RecordStageScreenState();
}

class _RecordStageScreenState extends State<RecordStageScreen> {
  String _stage = 'weigh';
  final _val = TextEditingController();
  String? _err;
  bool _saving = false;

  Future<void> _save() async {
    final payload = <String, dynamic>{};
    if (_stage == 'weigh') {
      final w = parseNum(_val.text);
      if (w == null || w <= 0) return setState(() => _err = 'Enter the weight in kg, for example 42.5');
      payload['weight_kg'] = w;
    } else if (_stage == 'grade') {
      if (_val.text.trim().isEmpty) return setState(() => _err = 'Enter the grade, for example BOPF');
      payload['grade'] = _val.text.trim();
    } else if (_stage == 'pack') {
      final n = int.tryParse(_val.text.trim());
      if (n == null || n <= 0) return setState(() => _err = 'Enter the number of packages');
      payload['packages'] = n;
    }
    setState(() => _saving = true);
    await Services.repo.record(eventType: _stage, batchId: widget.batch.id, plotId: widget.batch.plotId, payload: payload);
    Services.sync.syncNow();
    if (!mounted) return;
    snack(context, '${stageLabels[_stage]} recorded for ${widget.batch.code}. It will sync when you have signal.');
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Record a step')),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [const Icon(Icons.qr_code_2, color: C.bark600), Gaps.s, Expanded(child: Text('${widget.batch.code} · ${widget.batch.crop}', style: t.titleMedium))]))),
        Gaps.l,
        Text('Which step?', style: t.titleMedium),
        Gaps.s,
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final s in stageTypes)
            ChoiceChip(label: Text(stageLabels[s]!, style: const TextStyle(fontSize: 17)), selected: _stage == s, showCheckmark: false, onSelected: (_) => setState(() {
                  _stage = s;
                  _val.clear();
                  _err = null;
                })),
        ]),
        Gaps.l,
        if (_stage == 'weigh') TextField(controller: _val, autofocus: true, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimalOnly, decoration: InputDecoration(labelText: 'Weight (kg)', errorText: _err)),
        if (_stage == 'grade') TextField(controller: _val, autofocus: true, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(labelText: 'Grade', hintText: 'e.g. BOPF', errorText: _err)),
        if (_stage == 'pack') TextField(controller: _val, autofocus: true, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Number of packages', errorText: _err)),
        if (_stage == 'collect' || _stage == 'process') Text('Record this step now?', style: t.bodyLarge),
        Gaps.l,
        BusyButton(label: 'Record ${stageLabels[_stage]!.toLowerCase()}', busy: _saving, onPressed: _save),
        Gaps.s,
        Text('Steps are saved on your phone first and uploaded when you have signal.', style: t.bodySmall, textAlign: TextAlign.center),
      ]),
    );
  }
}

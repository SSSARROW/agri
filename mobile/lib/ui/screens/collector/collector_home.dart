import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hive/hive.dart';

import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import '../../widgets/status_strip.dart';
import '../farmer/batch_screens.dart';
import '../farmer/scanner.dart';
import '../settings/me_screen.dart';

class RoundItem {
  final String batchId, code, crop, condition;
  final String? standard, note, plotId;
  final double weightKg;
  final bool notVerified;
  RoundItem({required this.batchId, required this.code, required this.crop, required this.weightKg, required this.condition, this.note, this.standard, this.plotId, this.notVerified = false});

  Map<String, dynamic> toJson() => {'batchId': batchId, 'code': code, 'crop': crop, 'weightKg': weightKg, 'condition': condition, 'note': note, 'standard': standard, 'plotId': plotId, 'notVerified': notVerified};
  factory RoundItem.fromJson(Map<String, dynamic> j) => RoundItem(batchId: j['batchId'], code: j['code'], crop: j['crop'], weightKg: (j['weightKg'] as num).toDouble(), condition: j['condition'], note: j['note'], standard: j['standard'], plotId: j['plotId'], notVerified: j['notVerified'] == true);
}

/// The basket is kept on the device so closing the app mid-round loses nothing.
class RoundStore extends ChangeNotifier {
  Box<String>? _box;
  final List<RoundItem> items = [];

  String get _key => 'round_${Services.session.userId}';

  Future<void> load() async {
    _box ??= await Hive.openBox<String>('collector_round');
    items.clear();
    final raw = _box!.get(_key);
    if (raw != null) {
      try {
        items.addAll((jsonDecode(raw) as List).map((e) => RoundItem.fromJson((e as Map).cast<String, dynamic>())));
      } catch (_) {/* ignore an unreadable basket */}
    }
    notifyListeners();
  }

  Future<void> _save() async {
    await _box!.put(_key, jsonEncode(items.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  Future<void> add(RoundItem i) async {
    items.add(i);
    await _save();
  }

  Future<void> remove(RoundItem i) async {
    items.removeWhere((e) => e.batchId == i.batchId);
    await _save();
  }

  Future<void> clear() async {
    items.clear();
    await _save();
  }

  bool has(String batchId) => items.any((e) => e.batchId == batchId);
  double get totalKg => items.fold(0, (a, b) => a + b.weightKg);
}

class CollectorHome extends StatefulWidget {
  const CollectorHome({super.key});
  @override
  State<CollectorHome> createState() => _CollectorHomeState();
}

class _CollectorHomeState extends State<CollectorHome> {
  final _round = RoundStore();
  bool _ready = false;
  bool _merging = false;

  @override
  void initState() {
    super.initState();
    Services.sync.start();
    _round.load().then((_) {
      if (mounted) setState(() => _ready = true);
    });
  }

  Future<void> _scan() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (ctx) => Scaffold(
          appBar: AppBar(title: const Text('Scan farmer batch')),
          body: QrScannerView(
            hint: 'Scan the farmer\'s batch QR',
            onCode: (code) async {
              try {
                final added = await _handleCode(ctx, code);
                if (added && ctx.mounted) Navigator.pop(ctx);
              } catch (e) {
                if (ctx.mounted) snack(ctx, 'Could not look up "$code": ${errText(e)}');
              }
            },
          ),
        ),
      ),
    );
  }

  /// Returns true when the batch joined the round.
  Future<bool> _handleCode(BuildContext ctx, String code) async {
    final b = await Services.repo.batchByCode(code);
    if (_round.has(b.id)) {
      if (ctx.mounted) snack(ctx, '${b.code} is already in this round.');
      return false;
    }

    // Independently check the farmer's claim before taking their produce.
    var notVerified = false;
    if (b.protocolId != null) {
      String? warning;
      try {
        final ev = await Services.repo.batchSchedule(b.id);
        if (!ev.achieved) warning = 'Not yet verified: ${b.code} claims ${ev.name}, but only ${ev.requiredSatisfied} of ${ev.requiredTotal} required steps have a matching recorded event.';
      } catch (_) {
        warning = 'Not yet verified: could not check ${b.code}\'s claim against ${b.protocolName ?? 'its standard'} (no connection or an error).';
      }
      if (warning != null) {
        if (!ctx.mounted) return false;
        final go = await confirmDialog(ctx, title: 'Unverified claim', body: '$warning\n\nAdd it to this round anyway?', confirm: 'Add anyway');
        if (!go) return false;
        notVerified = true;
      }
    }
    if (!ctx.mounted) return false;
    final item = await showModalBottomSheet<RoundItem>(
      context: ctx,
      isScrollControlled: true,
      builder: (_) => _WeighSheet(batch: b, notVerified: notVerified),
    );
    if (item == null) return false;

    await Services.repo.record(eventType: 'weigh', batchId: b.id, plotId: b.plotId, payload: {'weight_kg': item.weightKg});
    await Services.repo.record(eventType: 'collector_attestation', batchId: b.id, plotId: b.plotId, payload: {'condition': item.condition, if ((item.note ?? '').isNotEmpty) 'note': item.note});
    await _round.add(item);
    Services.sync.syncNow();
    return true;
  }

  Future<void> _combine() async {
    final items = _round.items;
    final crops = items.map((e) => e.crop.toLowerCase()).toSet();
    if (crops.length > 1) {
      final go = await confirmDialog(context, title: 'Mixed crops', body: 'This round contains ${crops.length} different crops. A combined batch has a single crop (${items.first.crop}). Combine anyway?', confirm: 'Combine anyway');
      if (!go) return;
    }
    setState(() => _merging = true);
    try {
      final merged = await Services.repo.mergeBatches(parentIds: items.map((e) => e.batchId).toList(), crop: items.first.crop);
      // The combined batch carries the round's total weight, not just its parents.
      await Services.repo.record(eventType: 'weigh', batchId: merged.id, payload: {'weight_kg': _round.totalKg});
      await _round.clear();
      Services.sync.syncNow();
      if (!mounted) return;
      await Navigator.push(context, MaterialPageRoute(builder: (_) => BatchQrScreen(batch: merged, justRegistered: true)));
    } catch (e) {
      if (mounted) snack(context, errText(e));
    } finally {
      if (mounted) setState(() => _merging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Collection round'),
        actions: [
          IconButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => Scaffold(appBar: AppBar(title: const Text('Me')), body: const MeScreen())),
            ),
            icon: const Icon(Icons.settings_outlined, size: 28),
          ),
        ],
      ),
      body: !_ready
          ? const Center(child: CircularProgressIndicator(color: C.leaf600))
          : ListenableBuilder(
              listenable: _round,
              builder: (context, _) {
                final items = _round.items;
                return Column(children: [
                  const StatusStrip(),
                  Expanded(
                    child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(color: C.leaf900, borderRadius: BorderRadius.circular(20)),
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${items.length} batch${items.length == 1 ? '' : 'es'}', style: const TextStyle(color: Colors.white70, fontSize: 15)),
                              Text(fmtKg(_round.totalKg), style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
                            ]),
                          ),
                          FilledButton.icon(
                            style: FilledButton.styleFrom(minimumSize: const Size(0, 56), backgroundColor: C.bark500, padding: const EdgeInsets.symmetric(horizontal: 20)),
                            onPressed: _scan,
                            icon: const Icon(Icons.qr_code_scanner),
                            label: const Text('Scan'),
                          ),
                        ]),
                      ),
                      Gaps.m,
                      if (items.isEmpty)
                        const EmptyPanel(icon: Icons.local_shipping_outlined, title: 'Start your round', body: 'Scan each farmer\'s batch QR, weigh what you take and check its condition. Then combine everything into one outgoing batch.')
                      else
                        for (final i in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                                child: Row(children: [
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Text(i.code, style: t.titleMedium?.copyWith(letterSpacing: 1.2, fontFamily: 'monospace')),
                                      Text('${i.crop} · ${fmtKg(i.weightKg)}', style: t.bodyLarge),
                                      Gaps.xs,
                                      Wrap(spacing: 8, runSpacing: 6, children: [
                                        Pill(titleCase(i.condition), tone: i.condition == 'poor' ? Tone.bad : i.condition == 'fair' ? Tone.warn : Tone.good, icon: i.condition == 'poor' ? Icons.flag : null),
                                        if (i.notVerified) const Pill('Not verified', tone: Tone.warn),
                                      ]),
                                    ]),
                                  ),
                                  IconButton(
                                    onPressed: () async {
                                      final ok = await confirmDialog(context, title: 'Remove ${i.code}?', body: 'It leaves this round. The weight and condition you already recorded stay on the batch.', confirm: 'Remove', danger: true);
                                      if (ok) _round.remove(i);
                                    },
                                    icon: const Icon(Icons.close, color: C.inkMute),
                                  ),
                                ]),
                              ),
                            ),
                          ),
                    ]),
                  ),
                  if (items.isNotEmpty)
                    SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                        child: BusyButton(
                          label: items.length < 2 ? 'Add at least 2 batches to combine' : 'Combine ${items.length} batches',
                          icon: Icons.merge_type,
                          busy: _merging,
                          onPressed: items.length < 2 ? null : _combine,
                        ),
                      ),
                    ),
                ]);
              },
            ),
    );
  }
}

class _WeighSheet extends StatefulWidget {
  const _WeighSheet({required this.batch, required this.notVerified});
  final Batch batch;
  final bool notVerified;
  @override
  State<_WeighSheet> createState() => _WeighSheetState();
}

class _WeighSheetState extends State<_WeighSheet> {
  final _kg = TextEditingController();
  final _note = TextEditingController();
  String _cond = 'good';
  String? _err;

  void _ok() {
    final w = parseNum(_kg.text);
    if (w == null || w <= 0) return setState(() => _err = 'Enter the weight in kg, for example 42.5');
    final b = widget.batch;
    Navigator.pop(context, RoundItem(batchId: b.id, code: b.code, crop: b.crop, weightKg: w, condition: _cond, note: _note.text.trim(), standard: b.protocolName, plotId: b.plotId, notVerified: widget.notVerified));
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.batch.code, style: t.titleLarge?.copyWith(letterSpacing: 1.5, fontFamily: 'monospace')),
          Text('${widget.batch.crop}${widget.batch.protocolName != null ? ' · ${widget.batch.protocolName}' : ''}', style: t.bodyMedium),
          Gaps.m,
          TextField(
            controller: _kg,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: decimalOnly,
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
            decoration: InputDecoration(labelText: 'Weight received (kg)', errorText: _err),
          ),
          Gaps.m,
          Text('Condition on arrival', style: t.titleMedium),
          Gaps.s,
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'good', label: Text('Good'), icon: Icon(Icons.thumb_up_alt_outlined)),
              ButtonSegment(value: 'fair', label: Text('Fair')),
              ButtonSegment(value: 'poor', label: Text('Poor'), icon: Icon(Icons.flag_outlined)),
            ],
            selected: {_cond},
            showSelectedIcon: false,
            style: ButtonStyle(minimumSize: WidgetStateProperty.all(const Size(0, 52))),
            onSelectionChanged: (s) => setState(() => _cond = s.first),
          ),
          Gaps.m,
          TextField(controller: _note, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Note (optional)')),
          Gaps.m,
          FilledButton(onPressed: _ok, child: const Text('Add to round')),
        ]),
      ),
    );
  }
}

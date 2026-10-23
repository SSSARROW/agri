import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import '../../widgets/load_section.dart';

class NoticesList extends StatelessWidget {
  const NoticesList({super.key});
  @override
  Widget build(BuildContext context) {
    return AsyncView<List<NoticeSummary>>(
      load: Services.repo.notices,
      builder: (context, items, reload) {
        if (items.isEmpty) {
          return const EmptyPanel(icon: Icons.event_available_outlined, title: 'No planting requests', body: 'When an exporter you follow asks for a crop in a coming month, it appears here. You must be approved by an exporter first.');
        }
        final t = Theme.of(context).textTheme;
        return Column(children: [
          for (final n in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Tappable(
                onTap: () async {
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => NoticeDetailScreen(id: n.id)));
                  reload();
                },
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Pill('${n.crop} · ${fmtMonth(n.targetMonth)}', tone: Tone.info, icon: Icons.event_outlined),
                    const Spacer(),
                    Pill(switch (n.response) { 'ready' => 'Ready', 'cannot' => 'Can\'t', _ => 'No response yet' }, tone: switch (n.response) { 'ready' => Tone.good, 'cannot' => Tone.neutral, _ => Tone.warn }),
                  ]),
                  Gaps.s,
                  Text(n.title, style: t.titleMedium),
                  Text('${n.exporterName} needs ${fmtKg(n.volumeNeededKg)}', style: t.bodyMedium),
                  if (n.response == 'ready' && n.expectedKg != null) Text('You committed ${fmtKg(n.expectedKg)}', style: t.bodySmall?.copyWith(color: C.leaf700)),
                ]),
              ),
            ),
        ]);
      },
    );
  }
}

class NoticeDetailScreen extends StatefulWidget {
  const NoticeDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<NoticeDetailScreen> createState() => _NoticeDetailScreenState();
}

class _NoticeDetailScreenState extends State<NoticeDetailScreen> {
  int _rev = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Planting request')),
      body: AsyncView<NoticeDetail>(
        key: ValueKey(_rev),
        load: () => Services.repo.notice(widget.id),
        builder: (context, n, reload) {
          final t = Theme.of(context).textTheme;
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Pill('${n.crop} · ${fmtMonth(n.targetMonth)}', tone: Tone.info, icon: Icons.event_outlined),
            Gaps.s,
            Text(n.title, style: t.headlineMedium),
            Text(n.exporterName, style: t.titleMedium?.copyWith(color: C.inkSoft)),
            Gaps.m,
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: C.info50, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [const Icon(Icons.scale_outlined, color: C.info), Gaps.s, Expanded(child: Text('${fmtKg(n.volumeNeededKg)} needed in total', style: t.titleMedium?.copyWith(color: C.info)))]),
            ),
            if (n.message.isNotEmpty) ...[Gaps.m, Text(n.message, style: t.bodyLarge)],
            Gaps.l,
            _ReplyCard(notice: n, onChanged: () => setState(() => _rev++)),
            if (n.stages.isNotEmpty) ...[
              Gaps.l,
              Section('Standard to follow', subtitle: '${n.standardName} · v${n.standardVersion}', children: [
                for (final s in n.stages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(s.name, style: t.titleMedium), if ((s.description ?? '').isNotEmpty) Text(s.description!, style: t.bodyMedium), if (s.rules > 0) Text('${s.rules} rule${s.rules == 1 ? '' : 's'}', style: t.bodySmall)]))),
                  ),
              ]),
            ],
          ]);
        },
      ),
    );
  }
}

class _ReplyCard extends StatelessWidget {
  const _ReplyCard({required this.notice, required this.onChanged});
  final NoticeDetail notice;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final n = notice;
    final ready = n.response == 'ready';
    final cannot = n.response == 'cannot';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Your reply', style: t.titleLarge),
          Gaps.s,
          if (n.locked)
            const Banner2(tone: Tone.neutral, title: 'Replies are closed', body: 'The target month has started, so answers can no longer change.', icon: Icons.lock_outline)
          else ...[
            if (ready) Banner2(tone: Tone.good, title: 'You are ready to supply ${fmtKg(n.expectedKg)}', body: 'You can change your answer any time before the month starts.')
            else if (cannot) const Banner2(tone: Tone.neutral, title: 'You said you can\'t', body: 'You can change your answer any time before the month starts.', icon: Icons.info_outline)
            else Text('Can you supply this crop in ${fmtMonth(n.targetMonth)}?', style: t.bodyLarge),
            Gaps.m,
            FilledButton.icon(onPressed: () => _ready(context), icon: const Icon(Icons.check), label: Text(ready ? 'Change volume or plot' : 'Yes, I\'m ready')),
            Gaps.s,
            OutlinedButton(
              onPressed: cannot ? null : () => _cannot(context),
              child: const Text('I can\'t this season'),
            ),
          ],
        ]),
      ),
    );
  }

  Future<void> _cannot(BuildContext context) async {
    final ok = await confirmDialog(context, title: 'Decline this request?', body: 'Any plot you previously committed to this request will be released.', confirm: 'I can\'t');
    if (!ok) return;
    try {
      await Services.repo.respondCannot(notice.id);
      if (context.mounted) snack(context, 'Response recorded.');
      onChanged();
    } catch (e) {
      if (context.mounted) snack(context, errText(e));
    }
  }

  Future<void> _ready(BuildContext context) async {
    final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => _ReadySheet(notice: notice));
    if (ok == true) onChanged();
  }
}

class _ReadySheet extends StatefulWidget {
  const _ReadySheet({required this.notice});
  final NoticeDetail notice;
  @override
  State<_ReadySheet> createState() => _ReadySheetState();
}

class _ReadySheetState extends State<_ReadySheet> {
  late final _kg = TextEditingController(text: widget.notice.expectedKg == null ? '' : widget.notice.expectedKg!.toStringAsFixed(widget.notice.expectedKg! % 1 == 0 ? 0 : 1));
  String? _plot, _err;
  bool _busy = false;

  Future<void> _send() async {
    final kg = parseNum(_kg.text);
    if (kg == null || kg <= 0) return setState(() => _err = 'Please enter a valid volume greater than 0 kg.');
    if (_plot == null) return setState(() => _err = 'Please select a plot.');
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final msg = await Services.repo.respondReady(widget.notice.id, kg, _plot!);
      if (!mounted) return;
      snack(context, msg);
      Navigator.pop(context, true);
    } catch (e) {
      setState(() => _err = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Commit a plot and volume', style: t.titleLarge),
          Gaps.m,
          LoadSection<List<PlotOption>>(
            load: () => Services.repo.noticePlots(widget.notice.id),
            builder: (_, plots, _) {
              if (plots.isEmpty) return const Banner2(tone: Tone.warn, title: 'You have no registered plots yet', body: 'Register a plot first, then come back to commit it.');
              _plot ??= plots.any((p) => p.id == widget.notice.plotId) ? widget.notice.plotId : plots.first.id;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Which plot?', style: t.titleMedium),
                Gaps.s,
                for (final p in plots)
                  Padding(padding: const EdgeInsets.only(bottom: 8), child: ChoiceTile(title: p.name ?? 'Plot', subtitle: '${p.areaHa.toStringAsFixed(2)} ha${p.district != null ? ' · ${p.district}' : ''}', selected: _plot == p.id, onTap: () => setState(() => _plot = p.id))),
                Gaps.s,
                TextField(controller: _kg, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimalOnly, decoration: InputDecoration(labelText: 'Expected volume (kg)', errorText: _err)),
                Gaps.m,
                BusyButton(label: 'Confirm', busy: _busy, onPressed: _send),
              ]);
            },
          ),
        ]),
      ),
    );
  }
}

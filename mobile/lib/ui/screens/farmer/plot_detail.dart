import 'package:flutter/material.dart';

import '../../../core/constants.dart';
import '../../../core/device.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/load_section.dart';
import 'batch_screens.dart';
import 'evidence.dart';
import 'harvest_register.dart';
import 'planting_screens.dart';

class PlotDetailScreen extends StatefulWidget {
  const PlotDetailScreen({super.key, required this.plot});
  final Plot plot;
  @override
  State<PlotDetailScreen> createState() => _PlotDetailScreenState();
}

class _PlotDetailScreenState extends State<PlotDetailScreen> {
  late Plot plot = widget.plot;
  int _rev = 0; // bump to reload every section after an action

  Future<void> _rename() async {
    final ctl = TextEditingController(text: plot.name ?? '');
    final v = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Rename plot'),
        content: TextField(controller: ctl, maxLength: 60, autofocus: true, decoration: const InputDecoration(labelText: 'Plot name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(100, 48)), onPressed: () => Navigator.pop(c, ctl.text), child: const Text('Save')),
        ],
      ),
    );
    if (v == null) return;
    try {
      final p = await Services.repo.renamePlot(plot.id, v);
      if (mounted) setState(() => plot = p);
    } catch (e) {
      if (mounted) snack(context, errText(e));
    }
  }

  Future<void> _progressPhoto() async {
    final note = TextEditingController();
    final go = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Add a progress photo', style: Theme.of(c).textTheme.titleLarge),
          Gaps.s,
          Text('Show how the crop looks today. Add a note if something stands out.', style: Theme.of(c).textTheme.bodyMedium),
          Gaps.m,
          TextField(controller: note, decoration: const InputDecoration(labelText: 'Note (optional)'), textCapitalization: TextCapitalization.sentences),
          Gaps.m,
          FilledButton.icon(onPressed: () => Navigator.pop(c, true), icon: const Icon(Icons.photo_camera), label: const Text('Open camera')),
        ]),
      ),
    );
    if (go != true) return;
    final path = await Device.takePhoto();
    if (path == null || !mounted) return;
    snack(context, 'Uploading photo…');
    try {
      final fix = await Device.tryFix();
      final ev = await Services.repo.uploadPhoto(filePath: path, plotId: plot.id, eventType: 'progress_photo', caption: note.text, lat: fix?.lat, lon: fix?.lon);
      if (!mounted) return;
      snack(context, ev.flagged ? 'Progress photo uploaded, but it was taken ${ev.distanceM?.round() ?? '?'} m from this plot.' : 'Progress photo uploaded.');
      setState(() => _rev++);
    } catch (e) {
      if (mounted) snack(context, 'Could not upload photo: ${errText(e)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(plot.name ?? 'Plot'), actions: [IconButton(onPressed: _rename, icon: const Icon(Icons.edit_outlined), tooltip: 'Rename')]),
      body: ListView(key: ValueKey(_rev), padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
        Row(children: [
          Expanded(child: FilledButton.icon(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(60)), onPressed: () async {
            final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => RecordPlantingScreen(plot: plot)));
            if (ok == true) setState(() => _rev++);
          }, icon: const Icon(Icons.grass), label: const Text('Plant'))),
          Gaps.s,
          Expanded(child: FilledButton.icon(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(60), backgroundColor: C.bark600), onPressed: () async {
            final b = await Navigator.push<Batch>(context, MaterialPageRoute(builder: (_) => HarvestRegisterScreen(plot: plot)));
            if (b != null) setState(() => _rev++);
          }, icon: const Icon(Icons.inventory_2_outlined), label: const Text('Harvest'))),
        ]),
        Gaps.s,
        OutlinedButton.icon(onPressed: _progressPhoto, icon: const Icon(Icons.photo_camera_outlined), label: const Text('Add progress photo')),
        Gaps.l,
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              InfoRow('Area', fmtHa(plot.areaHa)),
              InfoRow('Environment', plotTypes[plot.plotType] ?? titleCase(plot.plotType)),
              InfoRow('Location', plot.location),
              InfoRow('Boundary', null, valueWidget: Align(alignment: Alignment.centerLeft, child: Pill(plot.measured ? 'Measured (${plot.boundarySource})' : 'Estimated', tone: plot.measured ? Tone.good : Tone.warn))),
              InfoRow('Centre', '${plot.centerLat.toStringAsFixed(5)}, ${plot.centerLon.toStringAsFixed(5)}'),
            ]),
          ),
        ),
        Gaps.l,
        Section('Planted crops', children: [
          if (plot.plantings.isEmpty)
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Text('Nothing recorded yet. Tap Plant when you plant something. Progress photos are scheduled from the planting date.', style: t.bodyMedium)))
          else
            for (final p in plot.plantings)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Tappable(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlantingDetailScreen(plot: plot, crop: p.crop))),
                  child: Row(children: [
                    const Icon(Icons.eco, color: C.leaf600),
                    Gaps.m,
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${p.crop}${p.areaHa != null ? ' (${fmtHa(p.areaHa)})' : ''}', style: t.titleMedium),
                        Text(p.protocolName != null ? 'Committed to ${p.protocolName}' : 'No specific standard', style: t.bodySmall),
                        Text('Planted ${fmtDate(p.plantedAt)}', style: t.bodySmall),
                      ]),
                    ),
                    const Icon(Icons.chevron_right, color: C.inkMute),
                  ]),
                ),
              ),
        ]),
        Gaps.m,
        Section('Photo evidence', children: [
          LoadSection<PhotoSchedule>(
            load: () => Services.repo.photoSchedule(plot.id),
            builder: (_, s, _) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _Check(s.hasRegistrationPhoto, 'Registration photo', s.hasRegistrationPhoto ? 'On file' : 'Missing. Add a photo from this plot.'),
                  if (s.plantedAt == null)
                    Padding(padding: const EdgeInsets.only(top: 8), child: Text('Progress photos are due every ${s.intervalDays} days once you record a planting.', style: t.bodySmall))
                  else
                    for (final c in s.checkpoints) _Check(c.status == 'done', 'Progress check ${c.sequence}', switch (c.status) { 'done' => 'Done', 'overdue' => 'Overdue since ${fmtDate(c.due)}', _ => 'Due ${fmtDate(c.due)}' }, bad: c.status == 'overdue'),
                ]),
              ),
            ),
          ),
        ]),
        Gaps.m,
        Section('Photos', children: [
          LoadSection<List<EventOut>>(
            load: () => Services.repo.plotPhotos(plot.id),
            builder: (_, photos, _) => photos.isEmpty
                ? Text('No photos yet.', style: t.bodyMedium)
                : Wrap(spacing: 10, runSpacing: 10, children: [
                    for (final p in photos.where((e) => e.photoUrl != null))
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        NetPhoto(p.photoUrl!, size: 104, flagged: p.flagged, onTap: () => showPhoto(context, p.photoUrl!, caption: '${eventTypeLabel(p.eventType)} · ${fmtDateTime(p.occurredAt)}${p.flagged ? '\nTaken ${p.distanceM?.round() ?? '?'} m from this plot' : ''}${p.caption != null ? '\n${p.caption}' : ''}')),
                        const SizedBox(height: 4),
                        SizedBox(width: 104, child: Text(eventTypeLabel(p.eventType), style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis)),
                      ]),
                  ]),
          ),
        ]),
        Gaps.m,
        Section('Batches from this plot', children: [
          LoadSection<List<Batch>>(
            load: () async => (await Services.repo.myBatches()).where((b) => b.plotId == plot.id).toList(),
            builder: (_, bs, _) => bs.isEmpty
                ? Text('No harvest batches yet.', style: t.bodyMedium)
                : Column(children: [for (final b in bs) Padding(padding: const EdgeInsets.only(bottom: 10), child: BatchCard(batch: b, plotName: plot.name))]),
          ),
        ]),
      ]),
    );
  }
}

class _Check extends StatelessWidget {
  const _Check(this.ok, this.title, this.sub, {this.bad = false});
  final bool ok, bad;
  final String title, sub;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Icon(ok ? Icons.check_circle : (bad ? Icons.error : Icons.radio_button_unchecked), color: ok ? C.leaf600 : (bad ? C.danger : C.inkMute)),
        Gaps.s,
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: Theme.of(context).textTheme.titleMedium), Text(sub, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: bad ? C.danger : null))])),
      ]),
    );
  }
}

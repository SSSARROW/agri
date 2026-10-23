import 'package:flutter/material.dart';

import '../../../core/constants.dart';
import '../../../core/device.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';

class RecordPlantingScreen extends StatefulWidget {
  const RecordPlantingScreen({super.key, required this.plot});
  final Plot plot;
  @override
  State<RecordPlantingScreen> createState() => _RecordPlantingScreenState();
}

class _RecordPlantingScreenState extends State<RecordPlantingScreen> {
  String _crop = 'Tea';
  DateTime _date = DateTime.now();
  late final _area = TextEditingController(text: widget.plot.areaHa == null ? '' : widget.plot.areaHa!.toStringAsFixed(widget.plot.areaHa! < 0.1 ? 4 : 2));

  List<ProtocolSummary> _protocols = [];
  bool _loadingProtocols = false;
  String? _protocolError;
  ProtocolSummary? _chosen;
  Protocol? _full;
  final Set<int> _confirmed = {};

  Fix? _fix;
  bool _fixing = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProtocols();
    Device.tryFix().then((f) {
      if (!mounted) return;
      setState(() {
        _fix = f;
        _fixing = false;
      });
    });
  }

  bool get _standardCrop => knownCrops.contains(_crop);

  Future<void> _loadProtocols() async {
    setState(() {
      _protocols = [];
      _chosen = null;
      _full = null;
      _confirmed.clear();
      _protocolError = null;
    });
    if (!_standardCrop) return;
    setState(() => _loadingProtocols = true);
    try {
      final ps = await Services.repo.protocols(_crop);
      if (mounted) setState(() => _protocols = ps);
    } catch (e) {
      if (mounted) setState(() => _protocolError = errText(e));
    } finally {
      if (mounted) setState(() => _loadingProtocols = false);
    }
  }

  Future<void> _choose(ProtocolSummary? p) async {
    setState(() {
      _chosen = p;
      _full = null;
      _confirmed.clear();
    });
    if (p == null) return;
    try {
      final full = await Services.repo.protocol(p.id);
      if (mounted && _chosen?.id == p.id) setState(() => _full = full);
    } catch (e) {
      if (mounted) setState(() => _protocolError = errText(e));
    }
  }

  bool get _allConfirmed => _full != null && _confirmed.length == _full!.stages.length;
  bool get _valid => _crop.trim().isNotEmpty && (_chosen == null || _allConfirmed);

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final area = parseNum(_area.text);
    final planted = DateTime(_date.year, _date.month, _date.day, 12);
    await Services.repo.record(
      eventType: 'planted',
      plotId: widget.plot.id,
      occurredAt: planted.isAfter(DateTime.now()) ? DateTime.now() : planted,
      payload: {
        'crop': _crop.trim(),
        if (area != null && area > 0) 'area_ha': area,
        if (_fix != null) ...{'lat': _fix!.lat, 'lon': _fix!.lon, 'accuracy_m': _fix!.accuracyM},
        if (_chosen != null) ...{
          'protocol_id': _chosen!.id,
          'protocol_name': _chosen!.name,
          'confirmed_stages': _full!.stages.map((s) => s.title).toList(),
        },
      },
    );
    Services.sync.syncNow();
    if (!mounted) return;

    final msg = _fix == null ? 'Planting recorded (no GPS fix). It will sync when you have signal.' : (_fix!.weak ? 'Planting recorded. GPS accuracy was low (±${_fix!.accuracyM.round()} m).' : 'Planting recorded. It will sync when you have signal.');
    final photo = await showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      builder: (c) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.check_circle, size: 48, color: C.leaf600),
          Gaps.s,
          Text(msg, textAlign: TextAlign.center, style: Theme.of(c).textTheme.titleMedium),
          Gaps.s,
          Text('Add a photo of what you planted? It is optional but strengthens your record.', textAlign: TextAlign.center, style: Theme.of(c).textTheme.bodyMedium),
          Gaps.l,
          FilledButton.icon(onPressed: () => Navigator.pop(c, true), icon: const Icon(Icons.photo_camera), label: const Text('Take planting photo')),
          Gaps.s,
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Skip photo')),
        ]),
      ),
    );

    if (photo == true) {
      final path = await Device.takePhoto();
      if (path != null) {
        try {
          final ev = await Services.repo.uploadPhoto(filePath: path, plotId: widget.plot.id, eventType: 'planting_photo', crop: _crop.trim(), lat: _fix?.lat, lon: _fix?.lon, occurredAt: planted);
          if (mounted) snack(context, ev.flagged ? 'Photo attached, but it was taken ${ev.distanceM?.round() ?? '?'} m from this plot.' : 'Photo attached.');
        } catch (e) {
          if (mounted) snack(context, 'Photo could not be uploaded: ${errText(e)}');
        }
      }
    }
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Record planting')),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
        Text(widget.plot.displayName, style: t.bodySmall),
        Gaps.m,
        CropPicker(onChanged: (c) {
          if (c != _crop) {
            _crop = c;
            _loadProtocols();
          }
          setState(() {});
        }),
        Gaps.l,
        InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () async {
            final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
            if (d != null) setState(() => _date = d);
          },
          child: InputDecorator(decoration: const InputDecoration(labelText: 'Date planted', suffixIcon: Icon(Icons.calendar_today_outlined)), child: Text(fmtDate(_date), style: t.bodyLarge)),
        ),
        Gaps.m,
        TextField(
          controller: _area,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: decimalOnly,
          decoration: const InputDecoration(labelText: 'Area planted with this crop (ha)', helperText: 'Lower it if you grow more than one crop here. Leave blank for the whole plot.'),
        ),
        Gaps.l,
        if (_standardCrop) ...[
          Section('Quality standard', subtitle: 'Optional. Choose one only if you will follow every requirement.', children: [
            if (_loadingProtocols) const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: C.leaf600)))
            else if (_protocolError != null) ErrorPanel(message: _protocolError!, onRetry: _loadProtocols)
            else ...[
              ChoiceTile(title: 'No specific standard', selected: _chosen == null, onTap: () => _choose(null)),
              for (final p in _protocols) Padding(padding: const EdgeInsets.only(top: 10), child: ChoiceTile(title: p.name, subtitle: p.source, selected: _chosen?.id == p.id, onTap: () => _choose(p))),
            ],
            if (_chosen != null && _full == null && _protocolError == null) const Padding(padding: EdgeInsets.only(top: 16), child: Center(child: CircularProgressIndicator(color: C.leaf600))),
            if (_full != null) ...[
              Gaps.m,
              Banner2(tone: Tone.info, title: 'Confirm you will follow every requirement', body: 'This is your promise. Buyers can later check the batch against it.'),
              Gaps.s,
              Card(
                child: Column(children: [
                  for (final s in _full!.stages)
                    CheckboxListTile(
                      value: _confirmed.contains(s.sequence),
                      onChanged: (v) => setState(() => v == true ? _confirmed.add(s.sequence) : _confirmed.remove(s.sequence)),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      title: Text(s.title, style: t.titleMedium),
                      subtitle: Text('${s.dayOffset != null ? 'Day ${s.dayOffset} · ' : 'Standing rule · '}${s.instructions}', style: t.bodySmall),
                    ),
                ]),
              ),
            ],
          ]),
        ] else
          Banner2(tone: Tone.info, title: 'No standard for this crop', body: 'Standards are only available for tea, cinnamon and pepper. You can still record the planting.'),
        Gaps.m,
        Row(children: [
          Icon(_fixing ? Icons.gps_not_fixed : (_fix != null ? Icons.gps_fixed : Icons.gps_off), size: 20, color: _fix != null ? C.leaf600 : C.inkMute),
          Gaps.s,
          Expanded(child: Text(_fixing ? 'Getting your GPS position…' : (_fix != null ? 'Location captured (±${_fix!.accuracyM.round()} m)' : 'No GPS fix. The planting will be saved without a location.'), style: t.bodySmall)),
        ]),
        if (_error != null) ...[Gaps.m, Banner2(tone: Tone.bad, title: _error!)],
        Gaps.l,
        BusyButton(label: _chosen != null && !_allConfirmed ? 'Confirm every requirement to save' : 'Save planting', busy: _saving, onPressed: _valid ? _save : null),
      ]),
    );
  }
}

class PlantingDetailScreen extends StatelessWidget {
  const PlantingDetailScreen({super.key, required this.plot, required this.crop});
  final Plot plot;
  final String crop;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('$crop planting')),
      body: AsyncView<EventOut?>(
        load: () async {
          final evs = await Services.repo.plotEvents(plot.id);
          final planted = evs.where((e) => e.eventType == 'planted' && (e.payload['crop'] ?? '').toString().toLowerCase() == crop.toLowerCase()).toList()
            ..sort((a, b) => b.occurredAt.compareTo(a.occurredAt));
          return planted.firstOrNull;
        },
        builder: (context, e, _) {
          if (e == null) return const EmptyPanel(icon: Icons.grass, title: 'No details found', body: 'This planting is still waiting to sync, or was recorded on another device.');
          final p = e.payload;
          final acc = (p['accuracy_m'] as num?)?.round();
          final confirmed = ((p['confirmed_stages'] as List?) ?? const []).map((x) => x.toString()).toList();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  InfoRow('Crop', p['crop']?.toString()),
                  InfoRow('Planted', fmtDate(e.occurredAt)),
                  InfoRow('Area', p['area_ha'] != null ? fmtHa((p['area_ha'] as num).toDouble()) : 'Whole plot'),
                  InfoRow('GPS', p['lat'] != null ? '${(p['lat'] as num).toStringAsFixed(5)}, ${(p['lon'] as num).toStringAsFixed(5)}${acc != null ? ' (±$acc m)' : ''}' : 'No fix recorded'),
                  InfoRow('Standard', p['protocol_name']?.toString() ?? 'None'),
                ]),
              ),
            ),
            if (confirmed.isNotEmpty) ...[
              Gaps.l,
              Section('Requirements you confirmed', children: [
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final c in confirmed) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [const Icon(Icons.check_circle, size: 20, color: C.leaf600), Gaps.s, Expanded(child: Text(c))]))]))),
              ]),
            ],
          ]);
        },
      ),
    );
  }
}

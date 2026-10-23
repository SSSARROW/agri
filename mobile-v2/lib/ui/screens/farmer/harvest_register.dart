import 'package:flutter/material.dart';

import '../../../core/constants.dart';
import '../../../core/device.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'batch_screens.dart';

/// Registering the batch *is* the harvest: it issues the code and QR label.
class HarvestRegisterScreen extends StatefulWidget {
  const HarvestRegisterScreen({super.key, required this.plot});
  final Plot plot;
  @override
  State<HarvestRegisterScreen> createState() => _HarvestRegisterScreenState();
}

enum _Phase { form, creating, uploading, uploadFailed }

class _HarvestRegisterScreenState extends State<HarvestRegisterScreen> {
  late String _crop = widget.plot.plantings.isNotEmpty ? widget.plot.plantings.first.crop : 'Tea';
  final _weight = TextEditingController();
  final _grade = TextEditingController();

  List<ProtocolSummary> _protocols = [];
  String? _protocolId;
  bool _loadingProtocols = false;
  String? _protocolError;

  _Phase _phase = _Phase.form;
  String? _error;
  String? _photoPath;
  Batch? _batch;
  Fix? _fix;

  String? get _committedId => widget.plot.plantings.where((p) => p.crop.toLowerCase() == _crop.toLowerCase()).firstOrNull?.protocolId;
  String? get _committedName => widget.plot.plantings.where((p) => p.crop.toLowerCase() == _crop.toLowerCase()).firstOrNull?.protocolName;

  @override
  void initState() {
    super.initState();
    _loadProtocols();
  }

  Future<void> _loadProtocols() async {
    setState(() {
      _protocols = [];
      _protocolId = null;
      _protocolError = null;
    });
    if (!knownCrops.contains(_crop)) return;
    setState(() => _loadingProtocols = true);
    try {
      final ps = await Services.repo.protocols(_crop);
      if (!mounted) return;
      setState(() {
        _protocols = ps;
        // The standard confirmed at planting for this crop is preselected.
        _protocolId = ps.any((p) => p.id == _committedId) ? _committedId : null;
      });
    } catch (e) {
      if (mounted) setState(() => _protocolError = errText(e));
    } finally {
      if (mounted) setState(() => _loadingProtocols = false);
    }
  }

  String? get _weightError {
    if (_weight.text.trim().isEmpty) return null;
    final w = parseNum(_weight.text);
    return (w == null || w <= 0) ? 'Enter a weight like 42.5' : null;
  }

  String? get _mismatch {
    final committed = _committedId;
    if (committed == null || committed == _protocolId) return null;
    final chosen = _protocols.where((p) => p.id == _protocolId).firstOrNull?.name;
    return chosen == null
        ? 'This crop\'s planting was confirmed against $_committedName, so this batch won\'t claim that standard.'
        : 'This crop\'s planting was confirmed against $_committedName, not $chosen. The batch may not verify.';
  }

  Future<void> _start() async {
    if (_weightError != null) {
      setState(() {});
      return;
    }
    // Photo first, so nothing is created that can't be proven.
    String? path = _photoPath;
    while (path == null) {
      path = await Device.takePhoto();
      if (path == null) {
        if (!mounted) return;
        final retry = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Photo required'),
            content: const Text('A photo of the batch is part of the proof. Take it now, or cancel this registration.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel registration')),
              FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(130, 48)), onPressed: () => Navigator.pop(c, true), child: const Text('Take photo')),
            ],
          ),
        );
        if (retry != true) return;
      }
    }
    _photoPath = path;
    Device.tryFix().then((f) => _fix = f);
    await _create();
  }

  Future<void> _create() async {
    setState(() {
      _phase = _Phase.creating;
      _error = null;
    });
    try {
      _batch ??= await Services.repo.createBatch(plotId: widget.plot.id, crop: _crop.trim(), protocolId: _protocolId);
      await _upload();
    } catch (e) {
      // Keep the photo: retry must not make anyone retake it.
      setState(() {
        _phase = _Phase.form;
        _error = '${errText(e)} Your photo is kept. Try again when you have signal.';
      });
    }
  }

  Future<void> _upload() async {
    setState(() => _phase = _Phase.uploading);
    try {
      await Services.repo.uploadPhoto(filePath: _photoPath!, plotId: widget.plot.id, eventType: 'batch_photo', batchId: _batch!.id, lat: _fix?.lat, lon: _fix?.lon);
      await _finish();
    } catch (e) {
      setState(() {
        _phase = _Phase.uploadFailed;
        _error = errText(e);
      });
    }
  }

  Future<void> _finish() async {
    final b = _batch!;
    await Services.repo.record(eventType: 'collect', batchId: b.id, plotId: widget.plot.id, payload: {});
    final w = parseNum(_weight.text);
    if (w != null && w > 0) await Services.repo.record(eventType: 'weigh', batchId: b.id, plotId: widget.plot.id, payload: {'weight_kg': w});
    if (_grade.text.trim().isNotEmpty) await Services.repo.record(eventType: 'grade', batchId: b.id, plotId: widget.plot.id, payload: {'grade': _grade.text.trim()});
    Services.sync.syncNow();
    if (!mounted) return;
    await Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => BatchQrScreen(batch: b, justRegistered: true)));
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final busy = _phase == _Phase.creating || _phase == _Phase.uploading;
    return PopScope(
      canPop: !busy && _phase != _Phase.uploadFailed,
      child: Scaffold(
        appBar: AppBar(title: const Text('Register harvest')),
        body: switch (_phase) {
          _Phase.creating || _Phase.uploading => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const CircularProgressIndicator(color: C.leaf600), Gaps.m, Text(_phase == _Phase.creating ? 'Creating your batch…' : 'Uploading the batch photo…', style: t.titleMedium)])),
          _Phase.uploadFailed => Padding(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.cloud_off, size: 52, color: C.danger),
                Gaps.m,
                Text('Batch ${_batch!.code} was created', style: t.titleLarge, textAlign: TextAlign.center),
                Gaps.s,
                Text('but the photo did not upload: $_error', style: t.bodyMedium, textAlign: TextAlign.center),
                Gaps.l,
                FilledButton(onPressed: _upload, child: const Text('Retry upload')),
                Gaps.s,
                TextButton(onPressed: _finish, child: const Text('Continue without the photo')),
              ]),
            ),
          _Phase.form => ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
              Text('From ${widget.plot.displayName}', style: t.bodySmall),
              Gaps.m,
              CropPicker(initial: _crop, onChanged: (c) {
                if (c != _crop) {
                  _crop = c;
                  _loadProtocols();
                }
                setState(() {});
              }),
              Gaps.l,
              TextField(controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimalOnly, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: 'Harvested weight, kg (optional)', errorText: _weightError)),
              Gaps.m,
              TextField(controller: _grade, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Grade (optional)', hintText: 'e.g. BOPF')),
              Gaps.l,
              if (knownCrops.contains(_crop))
                Section('Quality standard', subtitle: 'Optional. The batch will be checked against it.', children: [
                  if (_loadingProtocols) const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: C.leaf600)))
                  else if (_protocolError != null) ErrorPanel(message: _protocolError!, onRetry: _loadProtocols)
                  else ...[
                    ChoiceTile(title: 'No standard', selected: _protocolId == null, onTap: () => setState(() => _protocolId = null)),
                    for (final p in _protocols)
                      Padding(padding: const EdgeInsets.only(top: 10), child: ChoiceTile(title: p.name, subtitle: p.id == _committedId ? 'You confirmed this at planting' : p.source, selected: _protocolId == p.id, onTap: () => setState(() => _protocolId = p.id))),
                  ],
                  if (_mismatch != null) Padding(padding: const EdgeInsets.only(top: 12), child: Banner2(tone: Tone.warn, title: 'Standard mismatch', body: _mismatch)),
                ])
              else
                const Banner2(tone: Tone.info, title: 'No standard for this crop'),
              if (_error != null) ...[Gaps.m, Banner2(tone: Tone.bad, title: _error!)],
              Gaps.l,
              BusyButton(label: _photoPath != null ? 'Register batch' : 'Take batch photo & register', icon: Icons.photo_camera, onPressed: _start),
              Gaps.s,
              Text('A photo of the harvested produce is required. It is taken first so nothing is created without proof.', style: t.bodySmall, textAlign: TextAlign.center),
            ]),
        },
      ),
    );
  }
}

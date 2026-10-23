import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;

import '../../../core/constants.dart';
import '../../../core/device.dart';
import '../../../core/format.dart';
import '../../../core/geo.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'location_gate.dart';

/// Register a plot in three steps: describe → mark the boundary → take the registration photo.
class PlotRegisterScreen extends StatefulWidget {
  const PlotRegisterScreen({super.key});
  @override
  State<PlotRegisterScreen> createState() => _PlotRegisterScreenState();
}

enum _Method { walk, trace }

class _PlotRegisterScreenState extends State<PlotRegisterScreen> {
  int _step = 0;

  final _name = TextEditingController();
  String _type = 'open_field';
  String? _district;
  final _dsd = TextEditingController();
  final _gn = TextEditingController();

  _Method _method = _Method.walk;
  final List<PendingCorner> _walked = [];
  final List<LatLon> _traced = [];
  bool _pinning = false;
  Fix? _lastFix;
  String? _fixMsg;

  bool _saving = false;
  String? _error;
  Plot? _plot;

  @override
  void initState() {
    super.initState();
    // Prefill from the person's own profile rather than a regional default.
    Services.repo.me().then((u) {
      if (!mounted) return;
      setState(() {
        _district ??= districts.contains(u.district) ? u.district : null;
        if (_dsd.text.isEmpty) _dsd.text = u.dsd ?? '';
        if (_gn.text.isEmpty) _gn.text = u.gnDivision ?? '';
      });
    }).catchError((_) {});
  }

  List<LatLon> get _points => _method == _Method.walk ? _walked.map((c) => c.point).toList() : _traced;
  double get _area => polygonAreaHa(_points);
  double get _min => _method == _Method.walk ? walkedMinHa : tracedMinHa;
  bool get _boundaryOk => _points.length >= 3 && _area >= _min;

  Future<void> _drop() async {
    setState(() {
      _pinning = true;
      _fixMsg = null;
    });
    final fix = await Device.tryFix();
    if (!mounted) return;
    if (fix == null) {
      setState(() {
        _pinning = false;
        _fixMsg = 'Could not get a GPS fix. Move somewhere with a clearer view of the sky and try again.';
      });
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() {
      _walked.add(PendingCorner(fix.point, fix.accuracyM));
      _lastFix = fix;
      _pinning = false;
      _fixMsg = fix.weak ? 'Weak signal (±${fix.accuracyM.round()} m). The pin is saved, but a clearer spot gives a better boundary.' : null;
    });
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final p = await Services.repo.createPlot(
        name: _name.text,
        plotType: _type,
        district: _district!,
        dsd: _dsd.text,
        gn: _gn.text,
        source: _method == _Method.walk ? 'walked' : 'traced',
        points: _points,
      );
      setState(() {
        _plot = p;
        _step = 2;
      });
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final steps = ['Describe', 'Boundary', 'Photo'];
    return PopScope(
      canPop: _step != 2,
      child: Scaffold(
        appBar: AppBar(title: const Text('Register a plot'), automaticallyImplyLeading: _step != 2),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(children: [
              for (var i = 0; i < 3; i++) ...[
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(height: 5, decoration: BoxDecoration(color: i <= _step ? C.leaf600 : C.line, borderRadius: BorderRadius.circular(3))),
                    const SizedBox(height: 6),
                    Text('${i + 1}. ${steps[i]}', style: TextStyle(fontSize: 13, fontWeight: i == _step ? FontWeight.w700 : FontWeight.w500, color: i <= _step ? C.ink : C.inkMute)),
                  ]),
                ),
                if (i < 2) const SizedBox(width: 8),
              ],
            ]),
          ),
          Expanded(child: switch (_step) { 0 => _describe(), 1 => _boundary(), _ => _photo() }),
        ]),
      ),
    );
  }

  /* ── Step 1 ── */
  Widget _describe() {
    final ready = _district != null;
    return ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 32), children: [
      TextField(controller: _name, maxLength: 60, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Plot name (optional)', hintText: 'e.g. Lower field')),
      Gaps.m,
      Text('Growing environment', style: Theme.of(context).textTheme.titleMedium),
      Gaps.s,
      Wrap(spacing: 10, runSpacing: 10, children: [
        for (final e in plotTypes.entries) ChoiceChip(label: Text(e.value, style: const TextStyle(fontSize: 16)), selected: _type == e.key, showCheckmark: false, onSelected: (_) => setState(() => _type = e.key)),
      ]),
      Gaps.l,
      DistrictField(value: _district, onChanged: (v) => setState(() => _district = v)),
      Gaps.m,
      TextField(controller: _dsd, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'DSD (optional)')),
      Gaps.m,
      TextField(controller: _gn, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'GN division (optional)')),
      Gaps.l,
      FilledButton(onPressed: ready ? () => setState(() => _step = 1) : null, child: const Text('Next: mark the boundary')),
      if (!ready) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Choose the district first.', style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center)),
    ]);
  }

  /* ── Step 2 ── */
  Widget _boundary() {
    final t = Theme.of(context).textTheme;
    return LocationGate(
      child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 32), children: [
        SegmentedButton<_Method>(
          segments: const [
            ButtonSegment(value: _Method.walk, icon: Icon(Icons.directions_walk), label: Text('Walk it')),
            ButtonSegment(value: _Method.trace, icon: Icon(Icons.satellite_alt_outlined), label: Text('Trace on map')),
          ],
          selected: {_method},
          showSelectedIcon: false,
          style: ButtonStyle(minimumSize: WidgetStateProperty.all(const Size(0, 52))),
          onSelectionChanged: (s) async {
            final next = s.first;
            if (next == _method) return;
            final hasOther = _points.isNotEmpty;
            if (hasOther && !await confirmDialog(context, title: 'Switch method?', body: 'The corners you marked with the other method will be discarded.', confirm: 'Switch')) return;
            setState(() {
              _method = next;
              _walked.clear();
              _traced.clear();
              _fixMsg = null;
            });
          },
        ),
        Gaps.m,
        if (_method == _Method.walk) ..._walkUi(t) else ..._traceUi(t),
        Gaps.m,
        _areaCard(),
        if (_error != null) ...[Gaps.m, Banner2(tone: Tone.bad, title: _error!)],
        Gaps.m,
        BusyButton(label: 'Save plot', busy: _saving, onPressed: _boundaryOk ? _submit : null),
        Gaps.s,
        OutlinedButton(onPressed: _saving ? null : () => setState(() => _step = 0), child: const Text('Back')),
      ]),
    );
  }

  List<Widget> _walkUi(TextTheme t) => [
        Text('Stand at each corner of the plot and drop a pin. Go around once, in order.', style: t.bodyMedium),
        Gaps.m,
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(64), backgroundColor: C.bark600),
          onPressed: _pinning ? null : _drop,
          icon: _pinning ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white)) : const Icon(Icons.add_location_alt_outlined, size: 26),
          label: Text(_pinning ? 'Finding your position…' : 'Drop pin at this corner (${_walked.length + 1})'),
        ),
        if (_fixMsg != null) Padding(padding: const EdgeInsets.only(top: 12), child: Banner2(tone: Tone.warn, title: _fixMsg!)),
        if (_walked.isNotEmpty) ...[
          Gaps.m,
          Row(children: [
            Expanded(child: Text('${_walked.length} pin${_walked.length == 1 ? '' : 's'} dropped${_lastFix != null ? ' · last ±${_lastFix!.accuracyM.round()} m' : ''}', style: t.titleMedium)),
            TextButton.icon(onPressed: () => setState(() => _walked.removeLast()), icon: const Icon(Icons.undo), label: const Text('Undo')),
          ]),
        ],
      ];

  List<Widget> _traceUi(TextTheme t) => [
        Text('Tap each real corner of the plot on the satellite image. Zoom in for accuracy.', style: t.bodyMedium),
        Gaps.m,
        SizedBox(
          height: 360,
          child: ClipRRect(borderRadius: BorderRadius.circular(16), child: _TraceMap(points: _traced, onChanged: () => setState(() {}))),
        ),
        Gaps.s,
        Row(children: [
          Expanded(child: Text('${_traced.length} corner${_traced.length == 1 ? '' : 's'} marked', style: t.titleMedium)),
          TextButton.icon(onPressed: _traced.isEmpty ? null : () => setState(() => _traced.removeLast()), icon: const Icon(Icons.undo), label: const Text('Undo')),
        ]),
      ];

  Widget _areaCard() {
    final pts = _points;
    final t = Theme.of(context).textTheme;
    String line;
    Tone tone = Tone.neutral;
    if (pts.length < 3) {
      line = 'Mark at least 3 corners (${pts.length} so far).';
    } else if (_method == _Method.walk && maxSpreadM(pts) < 3) {
      line = 'Walk to each corner before dropping its pin.';
      tone = Tone.warn;
    } else if (_area < _min) {
      line = 'Estimated ${fmtHa(_area)}. That is below the minimum of ${fmtHa(_min)} for this method.';
      tone = Tone.warn;
    } else {
      line = 'Estimated area ${fmtHa(_area)}';
      tone = Tone.good;
    }
    final c = toneColors(tone);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Icon(tone == Tone.good ? Icons.check_circle : Icons.straighten, color: c.fg),
        Gaps.s,
        Expanded(child: Text(line, style: t.titleMedium?.copyWith(color: c.fg))),
      ]),
    );
  }

  /* ── Step 3 ── */
  Widget _photo() => _RegistrationPhoto(plot: _plot!);
}


class _TraceMap extends StatefulWidget {
  const _TraceMap({required this.points, required this.onChanged});
  final List<LatLon> points;
  final VoidCallback onChanged;
  @override
  State<_TraceMap> createState() => _TraceMapState();
}

class _TraceMapState extends State<_TraceMap> {
  final _ctl = MapController();
  ll.LatLng _center = const ll.LatLng(6.9497, 80.7891); // Nuwara Eliya, until we have a fix
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    Device.tryFix().then((f) {
      if (!mounted) return;
      setState(() {
        if (f != null) _center = ll.LatLng(f.lat, f.lon);
        _ready = true;
      });
      if (f != null) _ctl.move(_center, 18);
    });
  }

  @override
  Widget build(BuildContext context) {
    final pts = widget.points.map((p) => ll.LatLng(p.lat, p.lon)).toList();
    return Stack(children: [
      FlutterMap(
        mapController: _ctl,
        options: MapOptions(
          initialCenter: _center,
          initialZoom: 17,
          minZoom: 1,
          maxZoom: 21,
          onTap: (_, p) {
            widget.points.add(LatLon(p.latitude, p.longitude));
            widget.onChanged();
          },
        ),
        children: [
          TileLayer(urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxNativeZoom: 19, maxZoom: 21, userAgentPackageName: 'lk.origo.origo_field'),
          if (pts.length >= 3) PolygonLayer(polygons: [Polygon(points: pts, color: C.leaf500.withValues(alpha: 0.3), borderColor: Colors.white, borderStrokeWidth: 3)]),
          if (pts.length == 2) PolylineLayer(polylines: [Polyline(points: pts, color: Colors.white, strokeWidth: 3)]),
          MarkerLayer(markers: [
            for (var i = 0; i < pts.length; i++)
              Marker(point: pts[i], width: 30, height: 30, child: Container(alignment: Alignment.center, decoration: BoxDecoration(color: C.bark600, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)), child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)))),
          ]),
        ],
      ),
      Positioned(
        right: 8,
        top: 8,
        child: Column(children: [
          _MapBtn(Icons.add, () => _ctl.move(_ctl.camera.center, (_ctl.camera.zoom + 1).clamp(1, 21))),
          const SizedBox(height: 6),
          _MapBtn(Icons.remove, () => _ctl.move(_ctl.camera.center, (_ctl.camera.zoom - 1).clamp(1, 21))),
          const SizedBox(height: 6),
          _MapBtn(Icons.my_location, () async {
            final f = await Device.tryFix();
            if (f != null) _ctl.move(ll.LatLng(f.lat, f.lon), 18);
          }),
        ]),
      ),
      const Positioned(left: 8, bottom: 6, child: Text('Imagery © Esri, Maxar, Earthstar Geographics', style: TextStyle(color: Colors.white, fontSize: 10.5, shadows: [Shadow(blurRadius: 3)]))),
      if (!_ready) const Positioned.fill(child: ColoredBox(color: Color(0x66000000), child: Center(child: CircularProgressIndicator(color: Colors.white)))),
    ]);
  }
}

class _MapBtn extends StatelessWidget {
  const _MapBtn(this.icon, this.onTap);
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 2,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(borderRadius: BorderRadius.circular(12), onTap: onTap, child: SizedBox(width: 48, height: 48, child: Icon(icon, color: C.ink))),
      );
}

/// The plot exists on the server now; leaving without a registration photo is not allowed.
class _RegistrationPhoto extends StatefulWidget {
  const _RegistrationPhoto({required this.plot});
  final Plot plot;
  @override
  State<_RegistrationPhoto> createState() => _RegistrationPhotoState();
}

class _RegistrationPhotoState extends State<_RegistrationPhoto> {
  bool _busy = false;
  String? _error, _result;
  bool _done = false;

  Future<void> _shoot() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final path = await Device.takePhoto();
      if (path == null) {
        setState(() => _busy = false);
        return;
      }
      final fix = await Device.tryFix();
      final ev = await Services.repo.uploadPhoto(filePath: path, plotId: widget.plot.id, eventType: 'plot_photo', lat: fix?.lat, lon: fix?.lon);
      setState(() {
        _done = true;
        _result = ev.flagged ? 'Saved, but it was taken ${ev.distanceM?.round() ?? '?'} m from the plot centre. Retake later from the plot page if needed.' : 'Photo saved.';
      });
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 32), children: [
      Banner2(tone: Tone.good, title: 'Plot saved · ${fmtHa(widget.plot.areaHa)}', body: widget.plot.location.isEmpty ? null : widget.plot.location),
      Gaps.l,
      Icon(_done ? Icons.check_circle : Icons.photo_camera_outlined, size: 56, color: _done ? C.leaf600 : C.bark600),
      Gaps.m,
      Text(_done ? 'Plot registered' : 'One last step: a photo of the plot', style: t.titleLarge, textAlign: TextAlign.center),
      Gaps.s,
      Text(_done ? (_result ?? '') : 'Stand in the plot and take one clear photo. It proves the plot exists where you marked it. You cannot finish without it.', style: t.bodyMedium, textAlign: TextAlign.center),
      if (_error != null) ...[Gaps.m, Banner2(tone: Tone.bad, title: 'Photo could not be uploaded', body: _error)],
      Gaps.l,
      if (_done) FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Done')) else BusyButton(label: _error != null ? 'Try again' : 'Take photo', icon: Icons.photo_camera, busy: _busy, onPressed: _shoot),
    ]);
  }
}

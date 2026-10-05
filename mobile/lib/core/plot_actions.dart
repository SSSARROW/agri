import 'package:flutter/material.dart';

import '../models/plot.dart';
import '../models/protocol.dart';
import '../widgets/batch_qr_dialog.dart';
import 'auth_service.dart';
import 'event_queue.dart';
import 'farm_service.dart';
import 'location_service.dart';
import 'photo_capture.dart';
import 'plot_area.dart';
import 'sync_service.dart';

/// The three things a farmer does to a specific plot — recording planting,
/// registering a batch, adding a progress photo — pulled out of farm_page.dart
/// so both the plot list and the plot detail page can trigger them with
/// their own BuildContext instead of duplicating ~350 lines of dialog logic
/// in two places. `onDone` lets the caller refresh whatever it's showing
/// (a plot's photo schedule, its batch list) after a successful action.

// Above this accuracy (metres), warn the farmer rather than silently
// recording a fix that's not trustworthy at plot scale (M-06).
const _poorAccuracyMeters = 50.0;

String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

// A clean number to prefill the area field with (no trailing ".000", no
// unit suffix — this feeds a parsed double, not a label like formatArea's).
String _trimTrailingZeros(double v) {
  var s = v.toStringAsFixed(3);
  if (s.contains('.')) {
    s = s.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  }
  return s;
}

// Crops with a real quality standard seeded (see api/app/seed_protocols.py)
// — each entry here is a sourced, verifiable standard, not an invented one.
// "Other" stays free text rather than a long guessed-at crop list, since a
// crop with no seeded protocol just shows no quality-standard section below,
// same as today.
const kCropOptions = ['Tea', 'Cinnamon'];
const _otherCropLabel = 'Other';

/// A crop dropdown (plus a free-text field when "Other" is picked) shared by
/// recordPlanting and registerBatchForPlot. Only fires [onSelected] for the
/// three dropdown choices, not per keystroke in the "Other" field — nothing
/// is seeded for an arbitrary typed crop, so there's no protocol list to
/// fetch for it anyway.
class _CropField extends StatefulWidget {
  final String initialCrop;
  final ValueChanged<String> onSelected;
  const _CropField({required this.initialCrop, required this.onSelected});

  @override
  State<_CropField> createState() => _CropFieldState();
}

class _CropFieldState extends State<_CropField> {
  late String _choice = kCropOptions.contains(widget.initialCrop)
      ? widget.initialCrop
      : _otherCropLabel;
  late final _otherController = TextEditingController(
    text: _choice == _otherCropLabel ? widget.initialCrop : '',
  );

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _choice,
          decoration: const InputDecoration(labelText: 'Crop'),
          items: [
            for (final c in kCropOptions)
              DropdownMenuItem(value: c, child: Text(c)),
            const DropdownMenuItem(
              value: _otherCropLabel,
              child: Text(_otherCropLabel),
            ),
          ],
          onChanged: (v) {
            if (v == null) return;
            setState(() => _choice = v);
            widget.onSelected(
              v == _otherCropLabel ? _otherController.text.trim() : v,
            );
          },
        ),
        if (_choice == _otherCropLabel) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _otherController,
            decoration: const InputDecoration(labelText: 'Crop name'),
            onChanged: widget.onSelected,
          ),
        ],
      ],
    );
  }
}

Future<void> recordPlanting(
  BuildContext context,
  Plot plot, {
  VoidCallback? onDone,
}) async {
  // Kick off location capture in the background while the farmer is still
  // filling in the dialog, so it's usually already resolved by the time
  // they hit Save instead of adding its own visible wait afterward.
  final positionFuture = LocationService.getCurrentPosition();

  String crop = 'Tea';
  DateTime plantedDate = DateTime.now();
  // Defaults to the whole plot — a farmer who intercrops lowers this to
  // however much of the plot this particular crop actually covers, since
  // buyer-allocation capacity and a replanted crop's protocol schedule both
  // key off this rather than assuming one crop per plot (see
  // tier_evaluation.get_planted_at and commitments.allocation_proposal).
  final areaController = TextEditingController(
    text: plot.areaHa != null ? _trimTrailingZeros(plot.areaHa!) : '',
  );

  // Public endpoint, best-effort — planting still records with no quality
  // standard attached if this fails or nothing's seeded for the crop.
  var protocolsResult = await FarmService.protocolsForCrop(crop);
  var protocols = protocolsResult.isOk
      ? (protocolsResult.data ?? [])
      : <ProtocolSummary>[];
  if (!context.mounted) return;

  ProtocolSummary? selectedProtocol;
  ProtocolDetail? selectedProtocolDetail;
  bool loadingDetail = false;
  final confirmedSequences = <int>{};

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) {
        final allConfirmed =
            selectedProtocol == null ||
            (selectedProtocolDetail != null &&
                confirmedSequences.length ==
                    selectedProtocolDetail!.stages.length);
        return AlertDialog(
          title: const Text('Record planting'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CropField(
                  initialCrop: crop,
                  onSelected: (newCrop) async {
                    setDialogState(() {
                      crop = newCrop;
                      selectedProtocol = null;
                      selectedProtocolDetail = null;
                      confirmedSequences.clear();
                      protocols = [];
                    });
                    if (newCrop.isEmpty) return;
                    final r = await FarmService.protocolsForCrop(newCrop);
                    if (r.isOk) setDialogState(() => protocols = r.data ?? []);
                  },
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Planted on ${_formatDate(plantedDate)}',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: plantedDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now(),
                        );
                        if (picked != null) {
                          setDialogState(() => plantedDate = picked);
                        }
                      },
                      child: const Text('Change'),
                    ),
                  ],
                ),
                TextField(
                  controller: areaController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: 'Area planted with this crop (ha)',
                    helperText: plot.areaHa != null
                        ? 'Plot is ${formatArea(plot.areaHa)} total — lower this if intercropping.'
                        : null,
                  ),
                ),
                if (protocols.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Growing to a quality standard? (optional)',
                    style: TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                  DropdownButton<ProtocolSummary?>(
                    isExpanded: true,
                    value: selectedProtocol,
                    hint: const Text('No specific standard'),
                    items: [
                      const DropdownMenuItem<ProtocolSummary?>(
                        value: null,
                        child: Text('No specific standard'),
                      ),
                      for (final p in protocols)
                        DropdownMenuItem<ProtocolSummary?>(
                          value: p,
                          child: Text(p.name),
                        ),
                    ],
                    onChanged: (p) async {
                      setDialogState(() {
                        selectedProtocol = p;
                        selectedProtocolDetail = null;
                        confirmedSequences.clear();
                        loadingDetail = p != null;
                      });
                      if (p == null) return;
                      final detailResult = await FarmService.protocolDetail(
                        p.id,
                      );
                      setDialogState(() {
                        loadingDetail = false;
                        if (detailResult.isOk) {
                          selectedProtocolDetail = detailResult.data;
                        }
                      });
                    },
                  ),
                ],
                if (loadingDetail) ...[
                  const SizedBox(height: 16),
                  const Center(child: CircularProgressIndicator()),
                ],
                if (selectedProtocolDetail != null) ...[
                  const SizedBox(height: 12),
                  const Text(
                    "Confirm you'll follow every requirement below — this "
                    "is what the batch will be checked against later.",
                    style: TextStyle(
                      color: Colors.black54,
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  for (final stage in selectedProtocolDetail!.stages)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      dense: true,
                      title: Text(
                        stage.title,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        stage.instructions,
                        style: const TextStyle(fontSize: 12),
                      ),
                      value: confirmedSequences.contains(stage.sequence),
                      onChanged: (checked) => setDialogState(() {
                        if (checked == true) {
                          confirmedSequences.add(stage.sequence);
                        } else {
                          confirmedSequences.remove(stage.sequence);
                        }
                      }),
                    ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: allConfirmed
                  ? () => Navigator.of(context).pop(true)
                  : null,
              child: const Text('Save'),
            ),
          ],
        );
      },
    ),
  );
  if (confirmed != true) return;

  // GPS is supplementary provenance data here, not a requirement — a
  // planting record must still save even with no fix (indoors, permission
  // denied, this emulator's flaky GPS simulator, etc).
  final position = (await positionFuture).position;
  final payload = <String, dynamic>{'crop': crop};
  // Optional and best-effort, same spirit as GPS — an unparsable or blank
  // area just means "the whole plot", same as before this field existed,
  // rather than blocking the save over it.
  final enteredArea = double.tryParse(areaController.text.trim());
  if (enteredArea != null && enteredArea > 0) {
    payload['area_ha'] = enteredArea;
  }
  if (position != null) {
    payload['lat'] = position.latitude;
    payload['lon'] = position.longitude;
    payload['accuracy_m'] = position.accuracy;
  }
  // Self-reported by the farmer at planting time, not independently
  // verified — a collector/inspector co-sign is a real gap, not something
  // this checklist claims to solve.
  if (selectedProtocol != null) {
    payload['protocol_id'] = selectedProtocol!.id;
    payload['protocol_name'] = selectedProtocol!.name;
    payload['confirmed_stages'] = confirmedSequences.toList()..sort();
  }

  await EventQueue.add(
    eventType: 'planted',
    payload: payload,
    userId: AuthService.instance.userId,
    plotId: plot.id,
    occurredAt: plantedDate,
  );
  SyncService.instance.syncNow();
  if (!context.mounted) return;

  // Photo evidence is prompted but not required — the planting record
  // above is already safely queued offline, and unlike that record a
  // photo upload needs connectivity right now (there's no offline queue
  // for binary files), so skipping the camera or a failed upload must
  // never look like the planting itself didn't save.
  final photoFile = await PhotoCapture.takePhoto();
  var photoNote = '';
  if (photoFile != null) {
    final photoResult = await FarmService.uploadPlotPhoto(
      plotId: plot.id,
      eventType: 'planting_photo',
      imageFile: photoFile,
      lat: position?.latitude,
      lon: position?.longitude,
    );
    photoNote = photoResult.isOk
        ? ' Photo attached.'
        : ' Photo could not be uploaded: ${photoResult.error}';
  }
  onDone?.call();
  if (!context.mounted) return;

  final message = position == null
      ? 'Planting recorded (no GPS fix) — queued for sync.$photoNote'
      : position.accuracy > _poorAccuracyMeters
      ? 'Planting recorded — queued for sync. GPS accuracy was low (±${position.accuracy.round()}m).$photoNote'
      : 'Planting recorded — queued for sync.$photoNote';
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

// A periodic photo during the growing cycle (unlike the one-time photo
// offered right after registering the plot) — evidence of progress and
// condition over time, not just a single point-in-time snapshot.
Future<void> addProgressPhoto(
  BuildContext context,
  Plot plot, {
  VoidCallback? onDone,
}) async {
  // Captured alongside the photo, not required for it — GPS is best-effort
  // provenance here (M-06), so a missing fix never blocks the photo.
  final positionFuture = LocationService.getCurrentPosition();
  final file = await PhotoCapture.takePhoto();
  if (file == null || !context.mounted) return;

  final captionController = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Add progress photo'),
      content: TextField(
        controller: captionController,
        decoration: const InputDecoration(labelText: 'Note (optional)'),
        autofocus: true,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Upload'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final position = (await positionFuture).position;
  final result = await FarmService.uploadPlotPhoto(
    plotId: plot.id,
    eventType: 'progress_photo',
    imageFile: file,
    caption: captionController.text.trim(),
    lat: position?.latitude,
    lon: position?.longitude,
  );
  if (result.isOk) onDone?.call();
  if (!context.mounted) return;
  final message = !result.isOk
      ? 'Could not upload photo: ${result.error}'
      : result.data!.locationFlagged
      ? 'Progress photo uploaded — but it was taken '
            '${result.data!.distanceFromPlotM!.round()}m from this plot.'
      : 'Progress photo uploaded.';
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

Future<void> _showProtocolInstructions(
  BuildContext context,
  ProtocolSummary protocol,
) async {
  final result = await FarmService.protocolDetail(protocol.id);
  if (!context.mounted) return;
  if (!result.isOk || result.data == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Could not load instructions: ${result.error}')),
    );
    return;
  }
  final detail = result.data!;
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(detail.name),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              detail.source,
              style: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
            const SizedBox(height: 16),
            for (final stage in detail.stages) ...[
              Text(
                stage.title,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(stage.instructions),
              const SizedBox(height: 16),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

Future<void> registerBatchForPlot(
  BuildContext context,
  Plot plot, {
  VoidCallback? onDone,
}) async {
  String crop = 'Tea';

  // Public endpoint, best-effort — a farmer can still register a batch with
  // no quality standard attached if this fails or nothing's seeded.
  var protocolsResult = await FarmService.protocolsForCrop(crop);
  var protocols = protocolsResult.isOk
      ? (protocolsResult.data ?? [])
      : <ProtocolSummary>[];
  if (!context.mounted) return;

  // What the farmer confirmed adherence to at planting time for *this*
  // crop specifically (see recordPlanting's checklist) — a plot can grow
  // more than one crop at once (intercropping), so this must be looked up
  // per crop, not once for the plot as a whole.
  PlotPlanting? committedPlanting = plot.plantingFor(crop);
  ProtocolSummary? selectedProtocol = protocols
      .cast<ProtocolSummary?>()
      .firstWhere((p) => p?.id == committedPlanting?.protocolId, orElse: () => null);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) {
        final mismatch =
            committedPlanting?.protocolId != null &&
            selectedProtocol?.id != committedPlanting?.protocolId;
        return AlertDialog(
          title: const Text('Register a batch'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CropField(
                  initialCrop: crop,
                  onSelected: (newCrop) async {
                    setDialogState(() {
                      crop = newCrop;
                      committedPlanting = plot.plantingFor(newCrop);
                      selectedProtocol = null;
                      protocols = [];
                    });
                    if (newCrop.isEmpty) return;
                    final r = await FarmService.protocolsForCrop(newCrop);
                    if (!r.isOk) return;
                    setDialogState(() {
                      protocols = r.data ?? [];
                      selectedProtocol = protocols
                          .cast<ProtocolSummary?>()
                          .firstWhere(
                            (p) => p?.id == committedPlanting?.protocolId,
                            orElse: () => null,
                          );
                    });
                  },
                ),
                if (protocols.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Grow to a quality standard? (optional)',
                    style: TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                  DropdownButton<ProtocolSummary?>(
                    isExpanded: true,
                    value: selectedProtocol,
                    hint: const Text('No specific standard'),
                    items: [
                      const DropdownMenuItem<ProtocolSummary?>(
                        value: null,
                        child: Text('No specific standard'),
                      ),
                      for (final p in protocols)
                        DropdownMenuItem<ProtocolSummary?>(
                          value: p,
                          child: Text(p.name),
                        ),
                    ],
                    onChanged: (p) =>
                        setDialogState(() => selectedProtocol = p),
                  ),
                  if (selectedProtocol != null)
                    TextButton(
                      onPressed: () =>
                          _showProtocolInstructions(context, selectedProtocol!),
                      child: const Text('View planting instructions'),
                    ),
                  if (mismatch) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        selectedProtocol == null
                            ? "This crop's planting was confirmed against "
                                  "${committedPlanting?.protocolName} — this "
                                  "batch won't claim that standard."
                            : "This crop's planting was confirmed against "
                                  "${committedPlanting?.protocolName}, not "
                                  "${selectedProtocol!.name}.",
                        style: const TextStyle(
                          color: Color(0xFF9A6B00),
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Register'),
            ),
          ],
        );
      },
    ),
  );
  if (confirmed != true || !context.mounted) return;

  // Unlike a planting record, a batch code is issued by the server — it
  // can't be queued offline the way events can, since there's nothing
  // meaningful to show the farmer until the server hands back a real code.
  final result = await FarmService.createBatch(
    plotId: plot.id,
    crop: crop,
    protocolId: selectedProtocol?.id,
  );
  if (!context.mounted) return;

  if (!result.isOk || result.data == null) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('Failed: ${result.error}')));
    return;
  }

  onDone?.call();
  final code = result.data!.code;
  if (!context.mounted) return;
  await showBatchQrDialog(
    context,
    code,
    subtitle: result.data!.commitmentId != null
        ? 'Matched to an open buyer order for this quality standard.'
        : null,
  );
}

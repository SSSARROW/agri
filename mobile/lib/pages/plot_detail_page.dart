import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../core/plot_area.dart';
import '../core/plot_actions.dart';
import '../models/batch.dart';
import '../models/photo_schedule.dart';
import '../models/plot.dart';
import '../models/plot_photo.dart';
import '../widgets/batch_qr_dialog.dart';
import 'batch_schedule_page.dart';

const _plotTypeLabels = {
  'open_field': 'Open field',
  'greenhouse': 'Greenhouse',
  'shade_house': 'Shade house',
  'hydroponic': 'Hydroponic',
};

/// Everything about one plot in one place — area, boundary and photo
/// evidence, its growing-cycle photo schedule, every photo taken of it, and
/// the batches it's produced. Previously this all lived as three action
/// buttons crammed onto the plot's list card with nowhere to actually see
/// any of it.
class PlotDetailPage extends StatefulWidget {
  final Plot plot;
  const PlotDetailPage({super.key, required this.plot});

  @override
  State<PlotDetailPage> createState() => _PlotDetailPageState();
}

class _PlotDetailPageState extends State<PlotDetailPage> {
  late Plot _plot = widget.plot;
  PlotPhotoSchedule? _schedule;
  List<PlotPhoto>? _photos;
  List<Batch>? _batches;
  // Distinct from "still loading" (null) — a failed fetch (a stale session,
  // most often) should stop spinning and say so, not spin forever.
  String? _scheduleError;
  String? _photosError;
  String? _batchesError;

  @override
  void initState() {
    super.initState();
    _loadSchedule();
    _loadPhotos();
    _loadBatches();
  }

  // A stale session is the overwhelmingly common cause of a failed fetch
  // here — say so plainly rather than surfacing "Invalid or expired token."
  static String _loadErrorMessage(FarmResult<Object?> result) =>
      result.statusCode == 401
      ? 'Your session needs refreshing — log out and log back in to see this.'
      : (result.error ?? 'Could not load.');

  Future<void> _loadSchedule() async {
    final result = await FarmService.plotPhotoSchedule(widget.plot.id);
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _schedule = result.data;
        _scheduleError = null;
      } else {
        _scheduleError = _loadErrorMessage(result);
      }
    });
  }

  Future<void> _loadPhotos() async {
    final result = await FarmService.plotPhotos(widget.plot.id);
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _photos = result.data;
        _photosError = null;
      } else {
        _photosError = _loadErrorMessage(result);
      }
    });
  }

  Future<void> _loadBatches() async {
    final result = await FarmService.myBatches();
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _batches = (result.data ?? [])
            .where((b) => b.plotId == widget.plot.id)
            .toList();
        _batchesError = null;
      } else {
        _batchesError = _loadErrorMessage(result);
      }
    });
  }

  void _onActionDone() {
    _loadSchedule();
    _loadPhotos();
    _loadBatches();
  }

  String _formatDate(DateTime date) => '${date.day}/${date.month}/${date.year}';

  void _openPhoto(PlotPhoto photo) {
    showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              child: Image.network(photo.photoUrl, fit: BoxFit.contain),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _rename() async {
    final controller = TextEditingController(text: _plot.name ?? '');
    final newName = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Name this plot'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 60,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(hintText: 'e.g. Lower field'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (newName == null || !mounted) return;
    final result = await FarmService.renamePlot(
      _plot.id,
      newName.isEmpty ? null : newName,
    );
    if (!mounted) return;
    if (result.isOk) {
      setState(() => _plot = result.data!);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Could not rename the plot.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final plot = _plot;
    return Scaffold(
      appBar: AppBar(
        title: Text(plot.title, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Rename plot',
            onPressed: _rename,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.grass,
                        size: 20,
                        color: Color(0xFF1B5E20),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatArea(plot.areaHa),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(width: 8),
                      _Badge(
                        text: _plotTypeLabels[plot.plotType] ?? plot.plotType,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (plot.location.isNotEmpty) ...[
                    Text(plot.location, style: const TextStyle(fontSize: 14)),
                    const SizedBox(height: 4),
                  ],
                  Text(
                    '${plot.centerLat.toStringAsFixed(5)}, ${plot.centerLon.toStringAsFixed(5)}',
                    style: const TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    plot.boundaryLabel,
                    style: TextStyle(
                      color: plot.boundaryMeasured
                          ? const Color(0xFF1B5E20)
                          : const Color(0xFF9A6B00),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (plot.committedProtocolName != null) ...[
                    const Divider(height: 24),
                    Row(
                      children: [
                        const Icon(Icons.verified_outlined, size: 18),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Committed to ${plot.committedProtocolName} at planting',
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Photo evidence',
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontSize: 15),
            ),
            const SizedBox(height: 8),
            if (_schedule == null && _scheduleError == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_schedule == null)
              Text(
                _scheduleError!,
                style: const TextStyle(color: Colors.black54, fontSize: 13),
              )
            else
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _StatusLine(
                      ok: _schedule!.hasRegistrationPhoto,
                      text: _schedule!.hasRegistrationPhoto
                          ? 'Registration photo on file'
                          : 'No registration photo on file',
                    ),
                    for (final c in _schedule!.checkpoints) ...[
                      const SizedBox(height: 6),
                      _StatusLine(
                        ok: c.status == 'done',
                        warn: c.status == 'overdue',
                        text: c.status == 'done'
                            ? 'Progress check ${c.sequence} done'
                            : c.status == 'overdue'
                            ? 'Progress check ${c.sequence} overdue since ${_formatDate(c.dueDate)}'
                            : 'Progress check ${c.sequence} due ${_formatDate(c.dueDate)}',
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 20),
            Text(
              'Photos',
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontSize: 15),
            ),
            const SizedBox(height: 8),
            if (_photos == null && _photosError == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_photos == null)
              Text(
                _photosError!,
                style: const TextStyle(color: Colors.black54, fontSize: 13),
              )
            else if (_photos!.isEmpty)
              const Text(
                'No photos yet.',
                style: TextStyle(color: Colors.black54),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _photos!.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemBuilder: (context, i) {
                  final photo = _photos![i];
                  return GestureDetector(
                    onTap: () => _openPhoto(photo),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            photo.photoUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) =>
                                Container(
                                  color: const Color(0xFFF5F5F5),
                                  child: const Icon(Icons.broken_image),
                                ),
                          ),
                        ),
                        if (photo.locationFlagged)
                          const Positioned(
                            top: 4,
                            right: 4,
                            child: Icon(
                              Icons.warning_amber_rounded,
                              color: Colors.orange,
                              size: 18,
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            const SizedBox(height: 20),
            Text(
              'Batches from this plot',
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontSize: 15),
            ),
            const SizedBox(height: 8),
            if (_batches == null && _batchesError == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_batches == null)
              Text(
                _batchesError!,
                style: const TextStyle(color: Colors.black54, fontSize: 13),
              )
            else if (_batches!.isEmpty)
              const Text(
                'No batches registered from this plot yet.',
                style: TextStyle(color: Colors.black54),
              )
            else
              Column(
                children: [
                  for (final batch in _batches!) ...[
                    _SectionCard(
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          batch.code,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text(
                          batch.protocolName != null
                              ? '${batch.crop} · ${batch.protocolName}'
                              : batch.crop,
                        ),
                        trailing: batch.protocolId != null
                            ? IconButton(
                                icon: const Icon(Icons.checklist_outlined),
                                tooltip: 'View quality standard progress',
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => BatchSchedulePage(
                                      batchId: batch.id,
                                      batchCode: batch.code,
                                    ),
                                  ),
                                ),
                              )
                            : null,
                        onTap: () => showBatchQrDialog(
                          context,
                          batch.code,
                          subtitle: batch.protocolName != null
                              ? '${batch.crop} · ${batch.protocolName}'
                              : batch.crop,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: () =>
                      recordPlanting(context, plot, onDone: _onActionDone),
                  icon: const Icon(Icons.eco_outlined, size: 18),
                  label: const Text('Record planting'),
                ),
                OutlinedButton.icon(
                  onPressed: () => registerBatchForPlot(
                    context,
                    plot,
                    onDone: _onActionDone,
                  ),
                  icon: const Icon(Icons.inventory_2_outlined, size: 18),
                  label: const Text('Register batch'),
                ),
                OutlinedButton.icon(
                  onPressed: () =>
                      addProgressPhoto(context, plot, onDone: _onActionDone),
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: const Text('Add photo'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final Widget child;
  const _SectionCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(padding: const EdgeInsets.all(14), child: child),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  const _Badge({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF7EE),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  final bool ok;
  final bool warn;
  final String text;
  const _StatusLine({required this.ok, this.warn = false, required this.text});

  @override
  Widget build(BuildContext context) {
    final color = ok
        ? const Color(0xFF1B5E20)
        : warn
        ? const Color(0xFFB71C1C)
        : Colors.black54;
    final icon = ok
        ? Icons.check_circle
        : warn
        ? Icons.error_outline
        : Icons.schedule;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text, style: TextStyle(color: color, fontSize: 13)),
        ),
      ],
    );
  }
}

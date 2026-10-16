import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../core/plot_area.dart';
import '../core/plot_actions.dart';
import '../models/batch.dart';
import '../models/photo_schedule.dart';
import '../models/plot.dart';
import '../models/plot_photo.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';
import 'batch_detail_page.dart';
import 'batch_schedule_page.dart';

// A plot's "Photos" grid mixes four different event types (registration,
// planting, periodic progress, and harvest/batch) with nothing telling them
// apart beyond the picture itself — a farmer looking back couldn't tell a
// progress check-in from the one-time registration photo, or when either
// was actually taken.
const _photoTypeLabels = {
  'plot_photo': 'Registration',
  'planting_photo': 'Planting',
  'progress_photo': 'Progress',
  'batch_photo': 'Batch',
};

String _photoTypeLabel(String eventType) =>
    _photoTypeLabels[eventType] ?? eventType.replaceAll('_', ' ');

String _formatPhotoDate(DateTime d) {
  final local = d.toLocal();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${local.day} ${months[local.month - 1]}';
}

String _formatPhotoDateTime(DateTime d) {
  final local = d.toLocal();
  final h = local.hour.toString().padLeft(2, '0');
  final m = local.minute.toString().padLeft(2, '0');
  return '${_formatPhotoDate(d)} ${local.year}, $h:$m';
}

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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
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
            // The grid thumbnail only has room for a date; the full view is
            // where the rest of what makes this photo *evidence* — which
            // check-in it is, exactly when, the farmer's own note — actually
            // fits.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(
                        _photoTypeLabel(photo.eventType),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _formatPhotoDateTime(photo.occurredAt),
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  if (photo.caption != null && photo.caption!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      photo.caption!,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                  if (photo.locationFlagged) ...[
                    const SizedBox(height: 6),
                    const Row(
                      children: [
                        Icon(
                          Icons.warning_amber_rounded,
                          color: Colors.orange,
                          size: 16,
                        ),
                        SizedBox(width: 6),
                        Text(
                          'Taken far from this plot',
                          style: TextStyle(color: Colors.orange, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
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
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
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
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatArea(plot.areaHa),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(width: 8),
                      StatusPill(
                        _plotTypeLabels[plot.plotType] ?? plot.plotType,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (plot.location.isNotEmpty) ...[
                    Text(
                      plot.location,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 4),
                  ],
                  Text(
                    '${plot.centerLat.toStringAsFixed(5)}, ${plot.centerLon.toStringAsFixed(5)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  StatusPill(
                    plot.boundaryLabel,
                    level: plot.boundaryMeasured
                        ? StatusLevel.success
                        : StatusLevel.warning,
                  ),
                  if (plot.plantings.isNotEmpty) ...[
                    const Divider(height: 28),
                    // More than one entry means this plot is intercropped —
                    // each crop gets its own line since they can be on
                    // different quality standards (or none at all).
                    for (final planting in plot.plantings)
                      InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () =>
                            showPlantingDetails(context, plot, planting),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.verified_outlined,
                                size: 18,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  [
                                    planting.areaHa != null
                                        ? '${planting.crop} (${formatArea(planting.areaHa)})'
                                        : planting.crop,
                                    planting.protocolName != null
                                        ? 'committed to ${planting.protocolName}'
                                        : 'no specific standard',
                                  ].join(' — '),
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: Colors.black38,
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionHeader('Photo evidence'),
            if (_schedule == null && _scheduleError == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_schedule == null)
              Text(
                _scheduleError!,
                style: Theme.of(context).textTheme.bodySmall,
              )
            else
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatusRow(
                      _schedule!.hasRegistrationPhoto
                          ? 'Registration photo on file'
                          : 'No registration photo on file',
                      level: _schedule!.hasRegistrationPhoto
                          ? StatusLevel.success
                          : StatusLevel.danger,
                    ),
                    for (final c in _schedule!.checkpoints) ...[
                      const SizedBox(height: 8),
                      StatusRow(
                        c.status == 'done'
                            ? 'Progress check ${c.sequence} done'
                            : c.status == 'overdue'
                            ? 'Progress check ${c.sequence} overdue since ${_formatDate(c.dueDate)}'
                            : 'Progress check ${c.sequence} due ${_formatDate(c.dueDate)}',
                        level: c.status == 'done'
                            ? StatusLevel.success
                            : c.status == 'overdue'
                            ? StatusLevel.danger
                            : StatusLevel.neutral,
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 24),
            const SectionHeader('Photos'),
            if (_photos == null && _photosError == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_photos == null)
              Text(_photosError!, style: Theme.of(context).textTheme.bodySmall)
            else if (_photos!.isEmpty)
              Text(
                'No photos yet.',
                style: Theme.of(context).textTheme.bodySmall,
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
                          borderRadius: BorderRadius.circular(12),
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
                        // A gradient strip rather than plain text on the raw
                        // photo — keeps the type/date readable over any
                        // background without needing a solid backing chip
                        // that would eat into the already-small thumbnail.
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                              bottom: Radius.circular(12),
                            ),
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(6, 14, 6, 4),
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [Colors.transparent, Colors.black54],
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _photoTypeLabel(photo.eventType),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    _formatPhotoDate(photo.occurredAt),
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 9,
                                    ),
                                  ),
                                ],
                              ),
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
            const SizedBox(height: 24),
            const SectionHeader('Batches from this plot'),
            if (_batches == null && _batchesError == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_batches == null)
              Text(_batchesError!, style: Theme.of(context).textTheme.bodySmall)
            else if (_batches!.isEmpty)
              Text(
                'No batches registered from this plot yet.',
                style: Theme.of(context).textTheme.bodySmall,
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
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => BatchDetailPage(
                              batch: batch,
                              plotName: _plot.title,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ),
          ],
        ),
      ),
      // A persistent bar rather than buttons at the end of the scroll —
      // these three actions are the entire reason a farmer opens a plot,
      // so they should never be a scroll away (Fitts's law: keep the most-
      // used controls reachable in a fixed place, not buried in content).
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              top: BorderSide(
                color: Theme.of(context).colorScheme.outlineVariant
                    .withValues(alpha: 0.5),
              ),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: _PlotActionButton(
                  icon: Icons.eco_outlined,
                  label: 'Plant',
                  tooltip: 'Record planting',
                  onPressed: () =>
                      recordPlanting(context, plot, onDone: _onActionDone),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _PlotActionButton(
                  icon: Icons.inventory_2_outlined,
                  label: 'Batch',
                  tooltip: 'Register batch',
                  onPressed: () => registerBatchForPlot(
                    context,
                    plot,
                    onDone: _onActionDone,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _PlotActionButton(
                  icon: Icons.camera_alt_outlined,
                  label: 'Photo',
                  tooltip: 'Add photo',
                  onPressed: () =>
                      addProgressPhoto(context, plot, onDone: _onActionDone),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlotActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback onPressed;
  const _PlotActionButton({
    required this.icon,
    required this.label,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: FilledButton.tonalIcon(
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
        label: Text(label),
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
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}

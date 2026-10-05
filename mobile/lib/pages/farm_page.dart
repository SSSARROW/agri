import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../core/plot_area.dart';
import '../models/commitment.dart';
import '../models/photo_schedule.dart';
import '../models/plot.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';
import 'plot_boundary_walk_page.dart';
import 'plot_detail_page.dart';

class FarmPage extends StatefulWidget {
  const FarmPage({super.key});

  @override
  State<FarmPage> createState() => _FarmPageState();
}

class _FarmPageState extends State<FarmPage> {
  List<Plot>? _plots;
  String? _error;
  List<Commitment>? _commitments;
  final Map<String, PlotPhotoSchedule> _photoSchedules = {};

  @override
  void initState() {
    super.initState();
    _load();
    _loadCommitments();
  }

  // Best-effort and silent on failure — this is informational (what buyers
  // want right now), not core farm data, so it should never show an error
  // banner or block the rest of the page from loading.
  //
  // No crop filter: this used to always ask for Tea specifically, so a
  // cinnamon (or any non-Tea) farmer never saw a buyer order relevant to
  // them. Each card already shows its own crop, so showing every open
  // commitment here is correct, not just a Tea-shaped stopgap.
  Future<void> _loadCommitments() async {
    final result = await FarmService.openCommitments();
    if (!mounted || !result.isOk) return;
    setState(() => _commitments = result.data);
  }

  Future<void> _load() async {
    final result = await FarmService.myPlots();
    if (!mounted) return;
    // A 401 here means the server won't honor this token right now — not
    // that the farmer is logged out. Forcing a full re-login would defeat
    // the entire point of the PIN unlock (M-07): a device with no signal
    // for days must still open straight into a usable, offline-capable app.
    setState(() {
      if (result.isOk) {
        _plots = result.data;
        _error = null;
      } else {
        _plots = _plots ?? [];
        _error = result.statusCode == 401
            ? 'Your session needs refreshing — reconnect and log in again to sync new plots. Anything already recorded is safe.'
            : result.error;
      }
    });
    if (result.isOk) await _loadPhotoSchedules(result.data ?? []);
  }

  // Best-effort per plot — a schedule failing to load just means that
  // plot's card skips the reminder, not that the whole page breaks.
  Future<void> _loadPhotoSchedules(List<Plot> plots) async {
    for (final plot in plots) {
      final result = await FarmService.plotPhotoSchedule(plot.id);
      if (!mounted) return;
      if (result.isOk && result.data != null) {
        setState(() => _photoSchedules[plot.id] = result.data!);
      }
    }
  }

  String _formatDate(DateTime date) => '${date.day}/${date.month}/${date.year}';

  // The most urgent thing to tell the farmer about this plot's photo
  // evidence — a missing mandatory registration photo takes priority over
  // any progress-photo checkpoint, since it should never actually be
  // missing (the registration flow requires one) unless something failed.
  String? _photoStatusText(Plot plot) {
    final schedule = _photoSchedules[plot.id];
    if (schedule == null) return null;
    if (!schedule.hasRegistrationPhoto) {
      return 'No registration photo on file';
    }
    final overdue = schedule.checkpoints
        .where((c) => c.status == 'overdue')
        .toList();
    if (overdue.isNotEmpty) {
      return 'Progress photo overdue since ${_formatDate(overdue.first.dueDate)}';
    }
    final upcoming = schedule.checkpoints
        .where((c) => c.status == 'upcoming')
        .toList();
    if (upcoming.isNotEmpty) {
      return 'Next progress photo due ${_formatDate(upcoming.first.dueDate)}';
    }
    return null;
  }

  bool _photoStatusIsUrgent(Plot plot) {
    final schedule = _photoSchedules[plot.id];
    if (schedule == null) return false;
    if (!schedule.hasRegistrationPhoto) return true;
    return schedule.checkpoints.any((c) => c.status == 'overdue');
  }

  static const _plotTypeLabels = {
    'open_field': 'Open field',
    'greenhouse': 'Greenhouse',
    'shade_house': 'Shade house',
    'hydroponic': 'Hydroponic',
  };

  Future<void> _registerPlot() async {
    final districtController = TextEditingController(text: 'Nuwara Eliya');
    final dsdController = TextEditingController(text: 'Nuwara Eliya DSD');
    final gnController = TextEditingController(text: 'Kandapola');
    String plotType = 'open_field';
    final nameController = TextEditingController();

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Register a plot',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              const Text(
                "You'll walk the edge of the plot next and drop a pin at each corner.",
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                maxLength: 60,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Plot name (optional)',
                  hintText: 'e.g. Lower field',
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Growing environment',
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
              DropdownButton<String>(
                isExpanded: true,
                value: plotType,
                items: [
                  for (final entry in _plotTypeLabels.entries)
                    DropdownMenuItem(
                      value: entry.key,
                      child: Text(entry.value),
                    ),
                ],
                onChanged: (v) =>
                    setSheetState(() => plotType = v ?? 'open_field'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: districtController,
                decoration: const InputDecoration(labelText: 'District'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dsdController,
                decoration: const InputDecoration(labelText: 'DSD'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: gnController,
                decoration: const InputDecoration(labelText: 'GN Division'),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 48),
                ),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Continue to boundary walk'),
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    final registered = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PlotBoundaryWalkPage(
          district: districtController.text.trim(),
          dsd: dsdController.text.trim(),
          gnDivision: gnController.text.trim(),
          plotType: plotType,
          name: nameController.text.trim().isEmpty
              ? null
              : nameController.text.trim(),
        ),
      ),
    );
    if (registered == true) await _load();
  }

  Future<void> _openPlot(Plot plot) async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => PlotDetailPage(plot: plot)));
    // Cheap to always refresh — the detail page's actions (planting, a new
    // batch, a photo) can all change what this list needs to show.
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final plots = _plots;
    // A load failure means "we don't know how many plots this farmer has",
    // not "they have none" — showing the big first-time CTA in that case
    // (as opposed to the smaller "Add another plot" link) would wrongly
    // suggest to a farmer who already has plots that they need to register
    // one, right when we can't even confirm what they already recorded.
    final showBigRegisterCta =
        _error == null && (plots == null || plots.isEmpty);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('My Farm', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            const Text(
              'Your registered plots.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            // A farmer with plots already has no reason to see a shouty
            // full-width "register a plot" button every time they open the
            // app — that CTA earns its size only when there's nothing yet.
            // Once there's at least one plot, adding another is a smaller,
            // secondary action instead of the first thing on the page.
            if (!showBigRegisterCta)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _registerPlot,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add another plot'),
                ),
              )
            else
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _registerPlot,
                icon: const Icon(Icons.add_location_alt_outlined),
                label: const Text(
                  'Register a plot here',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            if (_commitments != null && _commitments!.isNotEmpty) ...[
              const SizedBox(height: 24),
              const SectionHeader('Buyers looking right now'),
              SizedBox(
                height: 112,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _commitments!.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, i) {
                    final c = _commitments![i];
                    return SizedBox(
                      width: 220,
                      child: Card(
                        color: AppColors.successBg,
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.storefront_outlined,
                                    size: 15,
                                    color: AppColors.primary,
                                  ),
                                  const SizedBox(width: 5),
                                  Expanded(
                                    child: Text(
                                      c.protocolName ??
                                          '${c.crop} — any standard',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${c.remainingKg.toStringAsFixed(0)} kg wanted',
                                style: const TextStyle(
                                  color: Colors.black87,
                                  fontSize: 12,
                                ),
                              ),
                              if (c.indicativePriceLkrPerKg != null)
                                Text(
                                  'LKR ${c.indicativePriceLkrPerKg!.toStringAsFixed(0)}/kg',
                                  style: const TextStyle(
                                    color: Colors.black54,
                                    fontSize: 12,
                                  ),
                                ),
                              const Spacer(),
                              Text(
                                'By ${_formatDate(c.deliveryWindowEnd)}',
                                style: const TextStyle(
                                  color: Colors.black54,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            Expanded(
              child: plots == null
                  ? const Center(child: CircularProgressIndicator())
                  : plots.isEmpty
                  ? const Center(
                      child: Text(
                        'No plots yet.',
                        style: TextStyle(color: Colors.black54),
                      ),
                    )
                  // A single plot doesn't need list chrome (scroll physics,
                  // separators) — it's just shown directly. Multiple plots
                  // get the scrollable list.
                  : plots.length == 1
                  ? RefreshIndicator(
                      onRefresh: _load,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: _PlotCard(
                          plot: plots.first,
                          plotTypeLabels: _plotTypeLabels,
                          statusText: _photoStatusText(plots.first),
                          statusIsUrgent: _photoStatusIsUrgent(plots.first),
                          onTap: () => _openPlot(plots.first),
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        itemCount: plots.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final plot = plots[i];
                          return _PlotCard(
                            plot: plot,
                            plotTypeLabels: _plotTypeLabels,
                            statusText: _photoStatusText(plot),
                            statusIsUrgent: _photoStatusIsUrgent(plot),
                            onTap: () => _openPlot(plot),
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlotCard extends StatelessWidget {
  final Plot plot;
  final Map<String, String> plotTypeLabels;
  final String? statusText;
  final bool statusIsUrgent;
  final VoidCallback onTap;

  const _PlotCard({
    required this.plot,
    required this.plotTypeLabels,
    required this.statusText,
    required this.statusIsUrgent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // A visual anchor for the card — every row used to open with
              // the same small inline icon, which gave the list nothing to
              // tell cards apart by at a glance besides their text.
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.grass,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            plot.title,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right,
                          color: Colors.black38,
                          size: 20,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.place_outlined,
                          size: 14,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            '${plot.location.isEmpty ? 'Unknown area' : plot.location}'
                            '${plot.plotType != 'open_field' ? ' · ${plotTypeLabels[plot.plotType] ?? plot.plotType}' : ''}',
                            style: const TextStyle(
                              color: Colors.black54,
                              fontSize: 13,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.straighten,
                          size: 14,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          formatArea(plot.areaHa),
                          style: const TextStyle(
                            color: Colors.black54,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    // What's actually growing here — previously invisible
                    // until you opened the plot, even though it's usually
                    // the first thing a farmer wants to know scanning a
                    // list of their own plots.
                    if (plot.plantings.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final p in plot.plantings) StatusPill(p.crop),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        StatusPill(
                          plot.boundaryLabel,
                          level: plot.boundaryMeasured
                              ? StatusLevel.success
                              : StatusLevel.warning,
                        ),
                        if (statusText != null)
                          StatusPill(
                            statusText!,
                            level: statusIsUrgent
                                ? StatusLevel.danger
                                : StatusLevel.neutral,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

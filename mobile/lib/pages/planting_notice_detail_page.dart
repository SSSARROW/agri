import 'package:flutter/material.dart';

import '../core/planting_notices_service.dart';
import '../models/planting_notice.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';

class PlantingNoticeDetailPage extends StatefulWidget {
  final String noticeId;
  const PlantingNoticeDetailPage({super.key, required this.noticeId});

  @override
  State<PlantingNoticeDetailPage> createState() =>
      _PlantingNoticeDetailPageState();
}

class _PlantingNoticeDetailPageState extends State<PlantingNoticeDetailPage> {
  PlantingNoticeDetail? _detail;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await PlantingNoticesService.noticeDetail(widget.noticeId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res.isOk && res.data != null) {
        _detail = res.data;
        _error = null;
      } else {
        _error = res.error;
      }
    });
  }

  Future<void> _onReplyCannot() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Can't this season?"),
        content: const Text(
          'Confirm that you cannot participate in this planting request. '
          'Any plot previously bound for this notice will be released.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text("Confirm Can't"),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _submitting = true);
    final res = await PlantingNoticesService.respondToNotice(
      id: widget.noticeId,
      response: 'cannot',
    );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (res.isOk) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.data?.message ?? "Response recorded: Can't this season."),
        ),
      );
      _load();
    } else {
      _showErrorDialog(res.error ?? "Failed to submit response. Please try again.");
    }
  }

  Future<void> _onReplyReady() async {
    // 1. Fetch plots first
    setState(() => _submitting = true);
    final plotsRes =
        await PlantingNoticesService.noticePlots(widget.noticeId);
    if (!mounted) return;
    setState(() => _submitting = false);

    if (!plotsRes.isOk) {
      _showErrorDialog(
        plotsRes.error ?? "Couldn't load your plots. Check your connection and try again.",
      );
      return;
    }

    final plots = plotsRes.data ?? [];
    if (plots.isEmpty) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('No plots available'),
          content: const Text(
            'You do not have any registered plots yet. Please register a plot in My Farm before replying Ready to a planting notice.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    // 2. Open reply bottom sheet
    if (!mounted) return;
    String? selectedPlotId = _detail?.currentPlotId;
    if (selectedPlotId == null || !plots.any((p) => p.id == selectedPlotId)) {
      selectedPlotId = plots.first.id;
    }

    final volumeController = TextEditingController(
      text: _detail?.currentExpectedVolumeKg != null
          ? _detail!.currentExpectedVolumeKg!.toStringAsFixed(0)
          : '',
    );

    String? sheetError;

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) {
          return Padding(
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
                  'Respond Ready',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Select the plot you will cultivate and enter your expected yield.',
                  style: TextStyle(color: Colors.black54, fontSize: 13),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Select plot',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: selectedPlotId,
                  decoration: const InputDecoration(
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  items: plots.map((p) {
                    final areaStr = p.areaHa > 0
                        ? ' · ${p.areaHa.toStringAsFixed(2)} ha'
                        : '';
                    return DropdownMenuItem(
                      value: p.id,
                      child: Text(
                        '${p.name}$areaStr',
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setSheetState(() => selectedPlotId = val);
                    }
                  },
                ),
                const SizedBox(height: 16),
                const Text(
                  'Expected volume (kg)',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: volumeController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    hintText: 'e.g. 500',
                    suffixText: 'kg',
                  ),
                ),
                if (sheetError != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    sheetError!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () async {
                    final text = volumeController.text.trim();
                    final vol = double.tryParse(text);
                    if (vol == null || vol <= 0) {
                      setSheetState(() {
                        sheetError = 'Please enter a valid volume greater than 0 kg.';
                      });
                      return;
                    }
                    if (selectedPlotId == null) {
                      setSheetState(() {
                        sheetError = 'Please select a plot.';
                      });
                      return;
                    }

                    setSheetState(() => sheetError = null);
                    final replyRes =
                        await PlantingNoticesService.respondToNotice(
                      id: widget.noticeId,
                      response: 'ready',
                      expectedVolumeKg: vol,
                      plotId: selectedPlotId,
                    );

                    if (replyRes.isOk) {
                      if (context.mounted) Navigator.of(context).pop(true);
                    } else {
                      setSheetState(() {
                        sheetError = replyRes.error ??
                            'Failed to submit response. Please try again.';
                      });
                    }
                  },
                  child: const Text('Confirm Ready'),
                ),
              ],
            ),
          );
        },
      ),
    );

    if (submitted == true) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Response recorded. Your plot has been bound for this season.'),
        ),
      );
      _load();
    }
  }

  void _showErrorDialog(String message) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Notice'),
        content: Text(message),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Planting notice'),
      ),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading && _detail == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _detail == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const IconCircle(
                Icons.error_outline,
                size: 56,
                color: AppColors.danger,
              ),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.danger),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _load,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final detail = _detail!;
    final isLocked = detail.isLocked;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 1. Exporter Public Profile Card (No contact info)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        if (detail.exporterLogoUrl != null &&
                            detail.exporterLogoUrl!.isNotEmpty)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              detail.exporterLogoUrl!,
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const IconCircle(
                                Icons.business_outlined,
                                size: 44,
                              ),
                            ),
                          )
                        else
                          const IconCircle(Icons.business_outlined, size: 44),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                detail.exporterCompanyName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Approved partner exporter',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.black54,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // 2. Notice Title, Crop & Volume Header
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            StatusPill(
                              detail.crop.toUpperCase(),
                              level: StatusLevel.neutral,
                              background:
                                  AppColors.primary.withValues(alpha: 0.12),
                              color: AppColors.primary,
                            ),
                            const Spacer(),
                            Text(
                              'Target: ${detail.formattedMonth}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: Colors.black87,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          detail.title,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(
                              Icons.scale_outlined,
                              size: 16,
                              color: Colors.black54,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Total volume needed: ${detail.volumeNeededKg.toStringAsFixed(0)} kg',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Colors.black87,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        if (detail.message.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          const Divider(height: 1),
                          const SizedBox(height: 12),
                          Text(
                            detail.message,
                            style: const TextStyle(
                              fontSize: 14,
                              height: 1.4,
                              color: Colors.black87,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // 3. Current Response Banner
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader('Your response'),
                        Row(
                          children: [
                            if (detail.isReady)
                              const StatusPill(
                                'READY TO SUPPLY',
                                level: StatusLevel.success,
                              )
                            else if (detail.isCannot)
                              const StatusPill(
                                "CAN'T THIS SEASON",
                                level: StatusLevel.neutral,
                              )
                            else
                              const StatusPill(
                                'AWAITING YOUR RESPONSE',
                                level: StatusLevel.warning,
                              ),
                            const Spacer(),
                            if (detail.isReady &&
                                detail.currentExpectedVolumeKg != null)
                              Text(
                                '${detail.currentExpectedVolumeKg!.toStringAsFixed(0)} kg committed',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                          ],
                        ),
                        if (isLocked) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.warningBg,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.lock_clock_outlined,
                                  size: 16,
                                  color: AppColors.warning,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Replies are locked because the target planting month (${detail.formattedMonth}) has already started.',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.warning,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                // 4. Linked Quality Standard Stages (Read-only)
                SectionHeader(
                  'Quality standard: ${detail.standardName} (v${detail.standardVersionNumber})',
                ),
                const SizedBox(height: 6),
                if (detail.stages.isEmpty)
                  const Text(
                    'No stage details specified for this standard.',
                    style: TextStyle(fontSize: 13, color: Colors.black54),
                  )
                else
                  for (final stage in detail.stages)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const IconCircle(Icons.eco_outlined, size: 34),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      '${stage.stageOrder}. ${stage.name}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                  if (stage.rulesCount > 0)
                                    StatusPill(
                                      '${stage.rulesCount} rule${stage.rulesCount == 1 ? '' : 's'}',
                                      level: StatusLevel.neutral,
                                    ),
                                ],
                              ),
                              if (stage.description.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  stage.description,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Colors.black87,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),

        // Bottom Action Bar for Reply
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 6,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor:
                        isLocked ? Colors.black38 : AppColors.danger,
                    side: BorderSide(
                      color: isLocked
                          ? Colors.black26
                          : AppColors.danger.withValues(alpha: 0.5),
                    ),
                  ),
                  onPressed: (isLocked || _submitting) ? null : _onReplyCannot,
                  child: const Text("Can't this season"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: (isLocked || _submitting) ? null : _onReplyReady,
                  child: const Text('Ready'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

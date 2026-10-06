import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/auth_service.dart';
import '../core/event_queue.dart';
import '../core/farm_service.dart';
import '../core/sync_service.dart';
import '../models/batch.dart';
import '../theme/app_colors.dart';
import '../widgets/batch_qr_dialog.dart';

class _BasketItem {
  final Batch batch;
  final double weightKg;
  final String condition;
  _BasketItem(this.batch, this.weightKg, this.condition);
}

class _WeighAndCondition {
  final double weightKg;
  final String condition;
  final String? note;
  _WeighAndCondition(this.weightKg, this.condition, this.note);
}

/// The collector's field workflow (B-14): scan a farmer's own batch QR,
/// record how much leaf was taken from them, add it to a running basket for
/// this collection round, then combine the whole basket into one downstream
/// batch once it's full — a single smallholder's harvest is too small to
/// ship on its own, but a collector's combined round is.
class CollectorHomePage extends StatefulWidget {
  const CollectorHomePage({super.key});

  @override
  State<CollectorHomePage> createState() => _CollectorHomePageState();
}

class _CollectorHomePageState extends State<CollectorHomePage> {
  final MobileScannerController _controller = MobileScannerController(
    formats: [BarcodeFormat.qrCode],
  );
  final List<_BasketItem> _basket = [];
  bool _busy = false;
  bool _scanning = false;
  String? _lastCode;
  DateTime? _lastScanAt;

  String _extractCode(String scanned) {
    final uri = Uri.tryParse(scanned);
    if (uri != null && uri.pathSegments.isNotEmpty) {
      return uri.pathSegments.last;
    }
    return scanned;
  }

  double get _totalKg => _basket.fold(0, (sum, item) => sum + item.weightKg);

  void _onDetect(BarcodeCapture capture) {
    if (_busy) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    final code = _extractCode(raw);

    final now = DateTime.now();
    if (_lastCode == code &&
        _lastScanAt != null &&
        now.difference(_lastScanAt!) < const Duration(seconds: 3)) {
      return;
    }
    _lastCode = code;
    _lastScanAt = now;

    HapticFeedback.mediumImpact();
    _resolveAndWeigh(code);
  }

  Future<void> _resolveAndWeigh(String code) async {
    setState(() => _busy = true);
    final result = await FarmService.batchByCode(code);
    if (!mounted) {
      _busy = false;
      return;
    }
    if (!result.isOk || result.data == null) {
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not look up "$code": ${result.error}')),
      );
      return;
    }
    final batch = result.data!;
    if (_basket.any((item) => item.batch.id == batch.id)) {
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${batch.code} is already in this round.')),
      );
      return;
    }
    setState(() => _scanning = false);
    final weighResult = await _promptWeightAndCondition(batch);
    if (weighResult != null) {
      await EventQueue.add(
        eventType: 'weigh',
        payload: {'weight_kg': weighResult.weightKg},
        userId: AuthService.instance.userId,
        batchId: batch.id,
      );
      // A second, independently-sourced signal on this batch — the
      // collector's own check, not the farmer's self-report — recorded
      // separately from the weigh event so it shows up as its own line in
      // the public provenance timeline.
      await EventQueue.add(
        eventType: 'collector_attestation',
        payload: {
          'condition': weighResult.condition,
          if (weighResult.note != null && weighResult.note!.isNotEmpty)
            'note': weighResult.note,
        },
        userId: AuthService.instance.userId,
        batchId: batch.id,
      );
      SyncService.instance.syncNow();
      setState(
        () => _basket.add(
          _BasketItem(batch, weighResult.weightKg, weighResult.condition),
        ),
      );
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<_WeighAndCondition?> _promptWeightAndCondition(Batch batch) async {
    final weightController = TextEditingController();
    final noteController = TextEditingController();
    String condition = 'good';

    return showDialog<_WeighAndCondition>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('${batch.crop} — ${batch.code}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: weightController,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Weight taken (kg)',
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  "Your own check of this batch's condition",
                  style: TextStyle(color: Colors.black54, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final option in const ['good', 'fair', 'poor'])
                      ChoiceChip(
                        label: Text(
                          option[0].toUpperCase() + option.substring(1),
                        ),
                        selected: condition == option,
                        onSelected: (_) =>
                            setDialogState(() => condition = option),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteController,
                  decoration: const InputDecoration(
                    labelText: 'Note (optional)',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final weight = double.tryParse(weightController.text.trim());
                if (weight == null) return;
                Navigator.of(context).pop(
                  _WeighAndCondition(
                    weight,
                    condition,
                    noteController.text.trim(),
                  ),
                );
              },
              child: const Text('Add to round'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createCollectionBatch() async {
    if (_basket.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add at least two farmer batches before combining.'),
        ),
      );
      return;
    }
    final crop = _basket.first.batch.crop;
    setState(() => _busy = true);
    final result = await FarmService.mergeBatches(
      parentBatchIds: _basket.map((item) => item.batch.id).toList(),
      crop: crop,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (!result.isOk || result.data == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not create collection batch: ${result.error}'),
        ),
      );
      return;
    }
    setState(() => _basket.clear());
    if (!mounted) return;
    await showBatchQrDialog(
      context,
      result.data!.code,
      subtitle:
          'New collection batch — combined from ${result.data!.code}\'s round.',
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Collection round',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Scan each farmer\'s batch QR, record the weight taken, then combine the round into one outgoing batch.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            if (_scanning)
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: SizedBox(
                  height: 300,
                  child: MobileScanner(
                    controller: _controller,
                    onDetect: _onDetect,
                  ),
                ),
              )
            else
              OutlinedButton.icon(
                onPressed: _busy
                    ? null
                    : () => setState(() => _scanning = true),
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scan a farmer\'s batch'),
              ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${_basket.length} batches in this round',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  '${_totalKg.toStringAsFixed(1)} kg total',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _basket.isEmpty
                  ? Center(
                      child: Text(
                        'No batches scanned yet this round.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    )
                  : ListView.separated(
                      itemCount: _basket.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final item = _basket[i];
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${item.batch.code} · ${item.batch.crop}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      'Condition: ${item.condition}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: item.condition == 'poor'
                                            ? AppColors.danger
                                            : Colors.black54,
                                      ),
                                    ),
                                  ],
                                ),
                                Text('${item.weightKg.toStringAsFixed(1)} kg'),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: (_busy || _basket.length < 2)
                  ? null
                  : _createCollectionBatch,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Create collection batch',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

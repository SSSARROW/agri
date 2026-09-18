import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/auth_service.dart';
import '../core/event_queue.dart';
import '../core/farm_service.dart';
import '../core/pipeline_stages.dart';
import '../core/sync_service.dart';
import '../models/batch.dart';

class ScanPage extends StatefulWidget {
  const ScanPage({super.key});

  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> {
  final MobileScannerController _controller = MobileScannerController(
    formats: [BarcodeFormat.qrCode],
  );
  final List<String> _recent = [];
  String? _lastCode;
  DateTime? _lastScanAt;
  // Ignore further detections while a batch dialog is up — otherwise the
  // same label re-triggers the resolve-and-record flow underneath it.
  bool _busy = false;

  void _onDetect(BarcodeCapture capture) {
    if (_busy) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null) return;

    final now = DateTime.now();
    if (_lastCode == code &&
        _lastScanAt != null &&
        now.difference(_lastScanAt!) < const Duration(seconds: 3)) {
      return;
    }
    _lastCode = code;
    _lastScanAt = now;

    HapticFeedback.mediumImpact();
    _resolveAndRecord(code);
  }

  Future<void> _resolveAndRecord(String code) async {
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

    setState(() => _recent.insert(0, code));
    await _showStagePicker(result.data!);
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _showStagePicker(Batch batch) async {
    final stage = await showDialog<StageConfig>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(batch.code),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              batch.protocolName != null
                  ? '${batch.crop} · ${batch.protocolName}'
                  : batch.crop,
              style: const TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 4),
            Text(
              'Currently: ${batch.latestStatus}',
              style: const TextStyle(color: Colors.black54, fontSize: 13),
            ),
            const SizedBox(height: 16),
            const Text(
              'Record a stage:',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in pipelineStages)
                  ActionChip(
                    label: Text(s.label),
                    onPressed: () => Navigator.of(context).pop(s),
                  ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
    if (stage == null || !mounted) return;
    await _recordStage(batch, stage);
  }

  Future<void> _recordStage(Batch batch, StageConfig stage) async {
    final controllers = {
      for (final f in stage.fields) f.key: TextEditingController(),
    };

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${stage.label} — ${batch.code}'),
        content: stage.fields.isEmpty
            ? const Text('Record this stage now?')
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final f in stage.fields)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: TextField(
                        controller: controllers[f.key],
                        keyboardType: f.numeric
                            ? TextInputType.number
                            : TextInputType.text,
                        inputFormatters: f.numeric
                            ? [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'[0-9.]'),
                                ),
                              ]
                            : null,
                        decoration: InputDecoration(labelText: f.label),
                        autofocus: true,
                      ),
                    ),
                ],
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Record'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final payload = <String, dynamic>{};
    for (final f in stage.fields) {
      final text = controllers[f.key]!.text.trim();
      if (text.isEmpty) continue;
      payload[f.key] = f.numeric ? num.tryParse(text) ?? text : text;
    }

    await EventQueue.add(
      eventType: stage.eventType,
      payload: payload,
      userId: AuthService.instance.userId,
      batchId: batch.id,
    );
    SyncService.instance.syncNow();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${stage.label} recorded for ${batch.code} — queued for sync.',
        ),
      ),
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
            Text('Scan', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            const Text(
              'Point the camera at a batch QR label to record the next stage — collect, weigh, process, grade or pack.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 20),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 360,
                child: MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '${_recent.length} scanned this session',
              style: const TextStyle(color: Colors.black54, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.separated(
                itemCount: _recent.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) => Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _recent[i],
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

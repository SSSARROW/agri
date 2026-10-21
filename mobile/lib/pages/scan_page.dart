import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/farm_service.dart';
import '../widgets/stage_picker.dart';

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

  // The QR now encodes a full URL to the public provenance page (so a
  // consumer's plain camera app can open it directly) — our own scanner
  // needs the bare code back out of that to look the batch up by code.
  String _extractCode(String scanned) {
    final uri = Uri.tryParse(scanned);
    if (uri != null && uri.pathSegments.isNotEmpty) {
      return uri.pathSegments.last;
    }
    return scanned;
  }

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
    await recordNextStage(context, result.data!);
    if (mounted) setState(() => _busy = false);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // A Scaffold of its own, not just a SafeArea: this page used to be a
    // tab body, which got its Scaffold (and its height bound) for free from
    // RootShell. Now it's only ever reached by pushing it from the Batches
    // FAB, so without this it had no back button and the recent-scans list
    // overflowed — nothing above was giving it a bounded height.
    return Scaffold(
      appBar: AppBar(title: const Text('Scan')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Point the camera at a batch QR label to record the next stage — collect, weigh, process, grade or pack.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 20),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
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
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.separated(
                itemCount: _recent.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) => Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text(
                      _recent[i],
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
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

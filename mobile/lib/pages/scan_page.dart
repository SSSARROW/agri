import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/event_queue.dart';

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

  void _onDetect(BarcodeCapture capture) {
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null) return;

    final now = DateTime.now();
    if (_lastCode == code &&
        _lastScanAt != null &&
        now.difference(_lastScanAt!) < const Duration(milliseconds: 1500)) {
      return;
    }
    _lastCode = code;
    _lastScanAt = now;

    HapticFeedback.mediumImpact();
    setState(() => _recent.insert(0, code));
    EventQueue.add(eventType: 'scan', payload: {'code': code});
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
              'Point the camera at a batch or plot QR label. Scanning continues automatically.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 20),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 360,
                child: MobileScanner(controller: _controller, onDetect: _onDetect),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '${_recent.length} scanned this session · queued for sync',
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
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3CD),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'NEW',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF7C5C00)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_recent[i], style: const TextStyle(fontWeight: FontWeight.bold))),
                    ],
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

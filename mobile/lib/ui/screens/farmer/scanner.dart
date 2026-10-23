import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/theme.dart';
import '../../widgets/common.dart';

/// Extracts the batch code from a full QR address or a bare code.
String codeFromScan(String raw) {
  final s = raw.trim();
  final uri = Uri.tryParse(s);
  if (uri != null && uri.hasScheme && uri.pathSegments.isNotEmpty) {
    return uri.pathSegments.where((p) => p.isNotEmpty).last.toUpperCase();
  }
  return s.toUpperCase();
}

/// QR-only camera. Repeated reads of the same code within 3 s are ignored.
class QrScannerView extends StatefulWidget {
  const QrScannerView({super.key, required this.onCode, this.paused = false, this.hint = 'Point at a batch QR code'});
  final Future<void> Function(String code) onCode;
  final bool paused;
  final String hint;
  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> {
  final _ctl = MobileScannerController(formats: const [BarcodeFormat.qrCode], detectionSpeed: DetectionSpeed.noDuplicates);
  String? _last;
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool _handling = false;
  bool _torch = false;

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  Future<void> _detect(BarcodeCapture cap) async {
    if (_handling || widget.paused) return;
    final raw = cap.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (raw == null) return;
    final code = codeFromScan(raw);
    if (code.isEmpty) return;
    final now = DateTime.now();
    if (code == _last && now.difference(_lastAt) < const Duration(seconds: 3)) return;
    _last = code;
    _lastAt = now;
    _handling = true;
    HapticFeedback.mediumImpact();
    try {
      await widget.onCode(code);
    } finally {
      _handling = false;
      _lastAt = DateTime.now();
    }
  }

  Future<void> _typeCode() async {
    final ctl = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Type the batch code'),
        content: TextField(controller: ctl, autofocus: true, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Code under the QR', hintText: 'e.g. 7KQ2M9X')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(100, 48)), onPressed: () => Navigator.pop(c, ctl.text), child: const Text('Look up')),
        ],
      ),
    );
    final clean = codeFromScan(code ?? '');
    if (clean.isEmpty || _handling) return;
    _handling = true;
    try {
      await widget.onCode(clean);
    } finally {
      _handling = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      MobileScanner(controller: _ctl, onDetect: _detect, errorBuilder: (c, e) => Container(color: Colors.black, alignment: Alignment.center, padding: const EdgeInsets.all(24), child: Text(e.errorCode == MobileScannerErrorCode.permissionDenied ? 'Camera permission is off. Allow it in settings to scan.' : 'The camera could not start.', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 17)))),
      IgnorePointer(
        child: Center(
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(24)),
          ),
        ),
      ),
      Positioned(
        left: 0,
        right: 0,
        top: 20,
        child: Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10), decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(999)), child: Text(widget.hint, style: const TextStyle(color: Colors.white, fontSize: 15.5)))),
      ),
      Positioned(
        left: 20,
        right: 20,
        bottom: 24,
        child: SafeArea(
          child: FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: C.ink, minimumSize: const Size.fromHeight(54)),
            onPressed: _typeCode,
            icon: const Icon(Icons.keyboard_alt_outlined),
            label: const Text('Type the code instead'),
          ),
        ),
      ),
      Positioned(
        right: 14,
        top: 14,
        child: IconButton.filled(
          style: IconButton.styleFrom(backgroundColor: Colors.black54, minimumSize: const Size(52, 52)),
          onPressed: () async {
            await _ctl.toggleTorch();
            setState(() => _torch = !_torch);
          },
          icon: Icon(_torch ? Icons.flash_on : Icons.flash_off, color: Colors.white),
        ),
      ),
    ]);
  }
}

Widget scannerFrame(Widget child) => Container(color: C.ink, child: child);

/// Farmer scan: look up a batch, then record the next stage on it.
class ScanBatchScreen extends StatefulWidget {
  const ScanBatchScreen({super.key, required this.onBatch});
  final Future<void> Function(String code) onBatch;
  @override
  State<ScanBatchScreen> createState() => _ScanBatchScreenState();
}

class _ScanBatchScreenState extends State<ScanBatchScreen> {
  final List<String> _seen = [];
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan a batch QR')),
      body: Column(children: [
        Expanded(
          child: QrScannerView(onCode: (code) async {
            if (!_seen.contains(code)) setState(() => _seen.add(code));
            try {
              await widget.onBatch(code);
            } catch (e) {
              if (mounted) snack(context, 'Could not look up "$code": ${errText(e)}');
            }
          }),
        ),
        if (_seen.isNotEmpty)
          Container(
            width: double.infinity,
            color: C.surface,
            padding: const EdgeInsets.all(16),
            child: Text('${_seen.length} scanned this session: ${_seen.join(', ')}', style: Theme.of(context).textTheme.bodyMedium),
          ),
      ]),
    );
  }
}

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api_client.dart';

/// Shared by farm_page.dart (right after registering a batch) and
/// batches_page.dart (viewing an existing one) so there's one QR rendering
/// to keep in sync, not two — the label a collector scans in the field must
/// match what a farmer sees on screen.
///
/// The QR encodes a full URL to the public provenance page (P-01), not the
/// bare code — a consumer's generic camera app needs something it can open
/// directly. scan_page.dart's own scanner still works on this, since it
/// extracts the trailing code segment when the scanned text is a URL.
///
/// Renders to a static PNG once rather than using QrImageView's live
/// CustomPainter directly in the dialog tree — the painter re-running on
/// every frame of the dialog's entrance transition was enough repeated
/// canvas work in a debug build to stall the UI thread into an ANR.
Future<Uint8List> _renderQrPng(String data, int size) async {
  final painter = QrPainter(
    data: data,
    version: QrVersions.auto,
    gapless: true,
  );
  final image = await painter.toImage(size.toDouble());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return bytes!.buffer.asUint8List();
}

Future<void> showBatchQrDialog(
  BuildContext context,
  String code, {
  String? subtitle,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(code, style: const TextStyle(letterSpacing: 2)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (subtitle != null) ...[
            Text(subtitle, style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 16),
          ],
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            width: 224,
            height: 224,
            child: FutureBuilder<Uint8List>(
              future: _renderQrPng('${ApiClient.baseUrl}/p/$code', 200),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                return Image.memory(snapshot.data!, width: 200, height: 200);
              },
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Print this on the batch label. Scanned in this app it records the next stage; scanned with any camera it opens this batch\'s public history.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.black54, fontSize: 12),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: code));
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('Code copied.')));
          },
          child: const Text('Copy code'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Done'),
        ),
      ],
    ),
  );
}

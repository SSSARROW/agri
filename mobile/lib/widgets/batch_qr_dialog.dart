import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api_client.dart';
import '../models/batch.dart';
import '../theme/app_colors.dart';

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

String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

Future<void> showBatchQrDialog(
  BuildContext context,
  String code, {
  String? subtitle,
  // The buyer order this batch auto-matched at registration (B-50), if
  // any — shown as its own card so "matched to an open buyer order" means
  // something concrete (how much, for how much, by when) right away
  // instead of sending the farmer to Market to find out.
  MatchedCommitment? matchedCommitment,
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
          if (matchedCommitment != null) ...[
            Card(
              color: AppColors.successBg,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.storefront,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Matched to an open buyer order',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        '${matchedCommitment.remainingKg.toStringAsFixed(0)} kg wanted',
                        if (matchedCommitment.indicativePriceLkrPerKg != null)
                          'LKR ${matchedCommitment.indicativePriceLkrPerKg!.toStringAsFixed(0)}/kg',
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12.5),
                    ),
                    Text(
                      'Deliver by ${_formatDate(matchedCommitment.deliveryWindowEnd)}',
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
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

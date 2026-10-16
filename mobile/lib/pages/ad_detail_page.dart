import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/ads_service.dart';
import '../models/ad.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';

String _formatDate(DateTime d) {
  final local = d.toLocal();
  return '${local.day}/${local.month}/${local.year}';
}

/// Full detail for one exporter ad — the exporter's own commercial terms
/// plus their quality standard's stages (what growing-to-this-order actually
/// requires), and the Apply action. The standard shown here is the
/// exporter's own custom standard (web/backend), not the generic protocols
/// a farmer picks at batch registration — intentionally separate systems
/// that happen to share one farmer identity.
class AdDetailPage extends StatefulWidget {
  final String adId;
  const AdDetailPage({super.key, required this.adId});

  @override
  State<AdDetailPage> createState() => _AdDetailPageState();
}

class _AdDetailPageState extends State<AdDetailPage> {
  AdDetail? _ad;
  String? _error;
  bool _applying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await AdsService.adDetail(widget.adId);
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _ad = result.data;
        _error = null;
      } else {
        _error = result.error;
      }
    });
  }

  Future<void> _apply() async {
    final ad = _ad;
    if (ad == null) return;
    final controller = TextEditingController();
    final quantity = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Apply to supply ${ad.crop}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${ad.remainingKg.toStringAsFixed(0)} kg still wanted at ${ad.priceLabel}.',
              style: const TextStyle(color: Colors.black54, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              decoration: const InputDecoration(
                labelText: 'How much can you supply (kg)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final value = double.tryParse(controller.text.trim());
              if (value == null || value <= 0) return;
              Navigator.of(context).pop(value);
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
    if (quantity == null || !mounted) return;

    setState(() => _applying = true);
    final result = await AdsService.acceptAd(
      adId: ad.id,
      adVersionId: ad.adVersionId,
      supplyQuantityKg: quantity,
    );
    if (!mounted) return;
    setState(() => _applying = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result.isOk ? result.data! : (result.error ?? 'Could not apply.'),
        ),
        backgroundColor: result.isOk ? AppColors.success : AppColors.danger,
      ),
    );
    if (result.isOk && mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    return Scaffold(
      appBar: AppBar(title: const Text('Buyer order')),
      body: SafeArea(
        child: _error != null
            ? Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.danger),
                ),
              )
            : ad == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const IconCircle(Icons.storefront, size: 48),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${ad.crop} · ${ad.gradeTier}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                            Text(
                              ad.exporter.companyName,
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (ad.title.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      ad.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ],
                  if (ad.description.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(ad.description, style: const TextStyle(fontSize: 14)),
                  ],
                  const SizedBox(height: 16),
                  Card(
                    color: AppColors.successBg,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                ad.priceLabel,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              Text(
                                '${ad.remainingKg.toStringAsFixed(0)} / ${ad.quantityKg.toStringAsFixed(0)} kg left',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _InfoRow(
                            icon: Icons.event_outlined,
                            label:
                                'Collect ${_formatDate(ad.collectionWindowStart)} – ${_formatDate(ad.collectionWindowEnd)}',
                          ),
                          if (ad.pickupLocation != null)
                            _InfoRow(
                              icon: Icons.place_outlined,
                              label: ad.pickupLocation!,
                            ),
                          if (ad.eligibleDistricts.isNotEmpty)
                            _InfoRow(
                              icon: Icons.map_outlined,
                              label: ad.eligibleDistricts.join(', '),
                            ),
                          _InfoRow(
                            icon: Icons.hourglass_bottom,
                            label: 'Offer expires ${_formatDate(ad.expiresAt)}',
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (ad.paymentTiming != null ||
                      ad.rejectionHandling != null) ...[
                    const SizedBox(height: 16),
                    const SectionHeader('Terms'),
                    if (ad.paymentTiming != null)
                      Text(
                        'Payment: ${ad.paymentTiming}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    if (ad.rejectionHandling != null)
                      Text(
                        'If rejected: ${ad.rejectionHandling}',
                        style: const TextStyle(fontSize: 13),
                      ),
                  ],
                  const SizedBox(height: 20),
                  SectionHeader('Quality standard: ${ad.standardName}'),
                  Text(
                    'What this exporter requires you to do and record to supply this order.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  for (final stage in ad.standardStages)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${stage.position}. ${stage.name}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              stage.instructions,
                              style: const TextStyle(fontSize: 13),
                            ),
                            if (stage.requiredPhotoCount > 0) ...[
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.camera_alt_outlined,
                                    size: 14,
                                    color: Colors.black45,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${stage.requiredPhotoCount} photo${stage.requiredPhotoCount == 1 ? '' : 's'} required as proof',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.black45,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if (stage.dos.isNotEmpty || stage.donts.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    for (final d in stage.dos)
                                      Text(
                                        '✓ $d',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.success,
                                        ),
                                      ),
                                    for (final d in stage.donts)
                                      Text(
                                        '✕ $d',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.danger,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 20),
                  if (ad.computedStatus == 'live')
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: _applying ? null : _apply,
                      child: _applying
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Apply to supply this order',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                    )
                  else
                    Text(
                      'This order is no longer open.',
                      style: const TextStyle(color: AppColors.danger),
                    ),
                ],
              ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoRow({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 15, color: Colors.black54),
          const SizedBox(width: 6),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../core/ads_service.dart';
import '../core/exporter_link_service.dart';
import '../models/ad.dart';
import '../models/exporter_link.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';
import 'ad_detail_page.dart';
import 'stage_proofs_page.dart';

String _formatDate(DateTime d) {
  final local = d.toLocal();
  return '${local.day}/${local.month}/${local.year}';
}

/// Every open exporter order a farmer can actually apply to (farmer/ads on
/// web/backend) — replaces the old read-only Commitment list with a real
/// apply-and-track flow: browse live orders, apply with a supply quantity,
/// then watch the application move from pending to approved/declined here.
class MarketPage extends StatefulWidget {
  const MarketPage({super.key});

  @override
  State<MarketPage> createState() => _MarketPageState();
}

enum _MarketTab { open, mine, exporters }

class _MarketPageState extends State<MarketPage> {
  _MarketTab _tab = _MarketTab.open;
  List<AdListItem>? _ads;
  List<MyAdAcceptance>? _mine;
  // null = loaded, no active link. Stays unset (not yet loaded) only while
  // _link below is itself still null AND no load has completed — tracked
  // via _exportersLoaded instead of a separate loading flag.
  FarmerExporterLink? _link;
  List<VerifiedExporter>? _exporters;
  bool _exportersLoaded = false;
  String? _error;
  bool _requesting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      AdsService.openAds(),
      AdsService.myAcceptances(),
      ExporterLinkService.currentLink(),
    ]);
    if (!mounted) return;
    final adsResult = results[0] as dynamic;
    final mineResult = results[1] as dynamic;
    final linkResult = results[2] as dynamic;
    setState(() {
      if (adsResult.isOk) _ads = adsResult.data;
      if (mineResult.isOk) _mine = mineResult.data;
      if (linkResult.isOk) _link = linkResult.data;
      _error = (!adsResult.isOk && !mineResult.isOk)
          ? (adsResult.error ?? mineResult.error)
          : null;
    });
    // Only fetch the full exporter directory when there's no active link to
    // show instead — a farmer who already has one doesn't need the list.
    if (linkResult.isOk && linkResult.data == null && !_exportersLoaded) {
      final exportersResult = await ExporterLinkService.verifiedExporters();
      if (!mounted) return;
      setState(() {
        _exportersLoaded = true;
        if (exportersResult.isOk) _exporters = exportersResult.data;
      });
    }
  }

  Future<void> _requestLink(VerifiedExporter exporter) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Follow ${exporter.companyName}\'s standard?'),
        content: const Text(
          'You can only follow one exporter at a time. They\'ll see your '
          'request and decide whether to accept you.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Send request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _requesting = true);
    final result = await ExporterLinkService.requestLink(exporter.id);
    if (!mounted) return;
    setState(() => _requesting = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result.isOk
              ? 'Request sent to ${exporter.companyName}.'
              : result.error ?? 'Could not send request.',
        ),
      ),
    );
    if (result.isOk) _load();
  }

  Future<void> _cancelLinkRequest() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel request?'),
        content: Text(
          'This cancels your pending request to ${_link?.exporterCompanyName ?? 'this exporter'}.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep it'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Cancel request',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final result = await ExporterLinkService.cancelRequest();
    if (!mounted) return;
    if (result.isOk) _load();
  }

  Future<void> _openAd(String id) async {
    final applied = await Navigator.of(
      context,
    ).push<bool>(MaterialPageRoute(builder: (_) => AdDetailPage(adId: id)));
    if (applied == true) _load();
  }

  Future<void> _withdraw(MyAdAcceptance acceptance) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Withdraw application?'),
        content: Text(
          'This cancels your application to supply ${acceptance.crop} to ${acceptance.exporterName}.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep it'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Withdraw',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final result = await AdsService.withdrawAcceptance(acceptance.adId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.isOk ? 'Application withdrawn.' : result.error!),
      ),
    );
    if (result.isOk) _load();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Market', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            Text(
              'Apply to supply buyer orders and track where each application stands.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SegmentedButton<_MarketTab>(
                segments: const [
                  ButtonSegment(
                    value: _MarketTab.open,
                    label: Text('Open orders'),
                    icon: Icon(Icons.storefront_outlined),
                  ),
                  ButtonSegment(
                    value: _MarketTab.mine,
                    label: Text('Applications'),
                    icon: Icon(Icons.assignment_outlined),
                  ),
                  ButtonSegment(
                    value: _MarketTab.exporters,
                    label: Text('My exporter'),
                    icon: Icon(Icons.handshake_outlined),
                  ),
                ],
                selected: {_tab},
                onSelectionChanged: (s) => setState(() => _tab = s.first),
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: switch (_tab) {
                  _MarketTab.open => _buildOpen(),
                  _MarketTab.mine => _buildMine(),
                  _MarketTab.exporters => _buildExporters(),
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOpen() {
    final ads = _ads;
    if (ads == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (ads.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 60),
          EmptyState(
            icon: Icons.storefront_outlined,
            title: 'No open buyer orders right now',
            subtitle: 'Check back soon — exporters post new orders regularly.',
          ),
        ],
      );
    }
    return ListView.separated(
      itemCount: ads.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final ad = ads[i];
        return Card(
          color: AppColors.successBg,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => _openAd(ad.id),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const IconCircle(Icons.storefront, color: AppColors.primary),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${ad.crop} · ${ad.gradeTier}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 17,
                                ),
                              ),
                            ),
                            Text(
                              ad.priceLabel,
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          ad.exporter.companyName,
                          style: const TextStyle(
                            color: Colors.black54,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(
                              Icons.scale_outlined,
                              size: 15,
                              color: Colors.black54,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              '${ad.remainingKg.toStringAsFixed(0)} kg wanted',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.event_outlined,
                              size: 15,
                              color: Colors.black54,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              '${_formatDate(ad.collectionWindowStart)} – ${_formatDate(ad.collectionWindowEnd)}',
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.black38),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMine() {
    final mine = _mine;
    if (mine == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (mine.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 60),
          EmptyState(
            icon: Icons.assignment_outlined,
            title: 'No applications yet',
            subtitle: 'Apply to an open order and it\'ll show up here.',
          ),
        ],
      );
    }
    return ListView.separated(
      itemCount: mine.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final a = mine[i];
        final level = switch (a.derivedStatus) {
          'approved' => StatusLevel.success,
          'declined' || 'removed' => StatusLevel.danger,
          'withdrawn' => StatusLevel.neutral,
          _ => StatusLevel.warning,
        };
        return Card(
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => _openAd(a.adId),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${a.crop} · ${a.gradeTier}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      StatusPill(a.derivedStatus.toUpperCase(), level: level),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    a.exporterName,
                    style: const TextStyle(color: Colors.black54, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${a.supplyQuantityKg.toStringAsFixed(0)} kg · ${a.priceLabel}',
                    style: const TextStyle(fontSize: 13),
                  ),
                  Text(
                    'Collect ${_formatDate(a.collectionWindowStart)} – ${_formatDate(a.collectionWindowEnd)}',
                    style: const TextStyle(color: Colors.black54, fontSize: 12),
                  ),
                  if (a.derivedStatus == 'pending') ...[
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => _withdraw(a),
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.danger,
                        ),
                        child: const Text('Withdraw'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildExporters() {
    final link = _link;
    if (link != null) {
      final level = switch (link.status) {
        'approved' => StatusLevel.success,
        'declined' || 'removed' => StatusLevel.danger,
        _ => StatusLevel.warning,
      };
      return ListView(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const IconCircle(Icons.handshake, size: 40),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              link.exporterCompanyName ?? 'Exporter',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              'Requested ${_formatDate(link.requestedAt)}',
                              style: const TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      StatusPill(link.status.toUpperCase(), level: level),
                    ],
                  ),
                  if (link.status == 'approved') ...[
                    const SizedBox(height: 12),
                    const Text(
                      'You\'re following this exporter\'s quality standard. '
                      'Keep your plot\'s planting and progress records up to '
                      'date — this is who sees them.',
                      style: TextStyle(fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const StageProofsPage(),
                          ),
                        ),
                        icon: const Icon(Icons.fact_check_outlined),
                        label: const Text('View standard & submit proof'),
                      ),
                    ),
                  ],
                  if (link.status == 'declined' &&
                      link.decisionReason != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Reason: ${link.decisionReason}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.danger,
                      ),
                    ),
                  ],
                  if (link.status == 'requested') ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _cancelLinkRequest,
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.danger,
                        ),
                        child: const Text('Cancel request'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      );
    }

    final exporters = _exporters;
    if (!_exportersLoaded || exporters == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (exporters.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 60),
          EmptyState(
            icon: Icons.handshake_outlined,
            title: 'No verified exporters yet',
            subtitle: 'Check back soon.',
          ),
        ],
      );
    }
    return ListView.separated(
      itemCount: exporters.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final exporter = exporters[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const IconCircle(Icons.storefront, size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        exporter.companyName,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ],
                ),
                if (exporter.description != null &&
                    exporter.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    exporter.description!,
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
                if (exporter.cropsBought.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final crop in exporter.cropsBought)
                        StatusPill(crop),
                    ],
                  ),
                ],
                if (exporter.districtsServed.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.map_outlined,
                        size: 14,
                        color: Colors.black45,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          exporter.districtsServed.join(', '),
                          style: const TextStyle(
                            color: Colors.black54,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    onPressed: _requesting ? null : () => _requestLink(exporter),
                    child: const Text('Request to follow their standard'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

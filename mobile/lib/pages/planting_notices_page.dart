import 'package:flutter/material.dart';

import '../core/planting_notices_service.dart';
import '../models/planting_notice.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';
import 'planting_notice_detail_page.dart';

class PlantingNoticesPage extends StatefulWidget {
  const PlantingNoticesPage({super.key});

  @override
  State<PlantingNoticesPage> createState() => _PlantingNoticesPageState();
}

class _PlantingNoticesPageState extends State<PlantingNoticesPage> {
  List<PlantingNoticeSummary>? _items;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await PlantingNoticesService.listNotices(page: 1, pageSize: 50);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res.isOk && res.data != null) {
        _items = res.data!.items;
        _error = null;
      } else {
        _error = res.error;
      }
    });
  }

  Future<void> _openDetail(PlantingNoticeSummary item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PlantingNoticeDetailPage(noticeId: item.id),
      ),
    );
    if (mounted) {
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Planting notices'),
      ),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading && _items == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && (_items == null || _items!.isEmpty)) {
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

    final items = _items ?? [];
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 100),
            EmptyState(
              icon: Icons.calendar_month_outlined,
              title: 'No planting notices yet',
              subtitle:
                  'When your approved exporter opens a planting season request for your district, it will appear here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = items[index];

          final (statusLabel, statusLevel) = switch (item.farmerResponse) {
            'ready' => ('READY', StatusLevel.success),
            'cannot' => ("CAN'T", StatusLevel.neutral),
            _ => ('NO RESPONSE YET', StatusLevel.warning),
          };

          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () => _openDetail(item),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        StatusPill(
                          item.crop.toUpperCase(),
                          level: StatusLevel.neutral,
                          background: AppColors.primary.withValues(alpha: 0.12),
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        StatusPill(statusLabel, level: statusLevel),
                        const Spacer(),
                        Text(
                          item.formattedMonth,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      item.title.isNotEmpty ? item.title : 'Planting Notice',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.exporterName,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.black54,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Needed: ${item.volumeNeededKg.toStringAsFixed(0)} kg',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.black87,
                          ),
                        ),
                        const Row(
                          children: [
                            Text(
                              'View details',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                            Icon(
                              Icons.chevron_right,
                              size: 16,
                              color: AppColors.primary,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

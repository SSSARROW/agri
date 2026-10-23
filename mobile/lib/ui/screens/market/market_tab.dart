import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import 'notices_screens.dart';
import 'order_screens.dart';

/// Orders to browse, applications to follow, and seasonal planting requests.
class MarketTab extends StatelessWidget {
  const MarketTab({super.key});
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(children: [
        const TabBar(
          labelColor: C.leaf700,
          unselectedLabelColor: C.inkMute,
          indicatorColor: C.leaf600,
          labelStyle: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          unselectedLabelStyle: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
          tabs: [Tab(text: 'Orders'), Tab(text: 'Applied'), Tab(text: 'Seasons')],
        ),
        const Expanded(child: TabBarView(children: [_OrdersList(), ApplicationsList(), NoticesList()])),
      ]),
    );
  }
}

class _OrdersList extends StatelessWidget {
  const _OrdersList();
  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Order>>(
      load: () => Services.repo.orders(),
      builder: (context, orders, reload) {
        if (orders.isEmpty) {
          return const EmptyPanel(icon: Icons.storefront_outlined, title: 'No open orders right now', body: 'Exporters\' buy requests for your district appear here. Pull down to check again.');
        }
        return Column(children: [
          for (final o in orders)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: OrderCard(order: o, onTap: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o.id)));
                reload();
              }),
            ),
        ]);
      },
    );
  }
}

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final pct = order.quantityKg == 0 ? 0.0 : (1 - order.remainingKg / order.quantityKg).clamp(0.0, 1.0);
    return Tappable(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Pill('${order.crop}${order.gradeTier.isNotEmpty ? ' · ${order.gradeTier}' : ''}', tone: Tone.good),
          const Spacer(),
          Text(order.priceLine, style: t.titleMedium?.copyWith(color: C.bark700)),
        ]),
        Gaps.s,
        Text(order.title.isEmpty ? 'Buy request' : order.title, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
        Text(order.exporter.companyName, style: t.bodyMedium),
        Gaps.s,
        ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: pct, minHeight: 8, backgroundColor: C.sunken, color: C.leaf500)),
        const SizedBox(height: 6),
        Text('${fmtKg(order.remainingKg)} still wanted of ${fmtKg(order.quantityKg)}', style: t.bodySmall),
        Gaps.xs,
        Row(children: [
          const Icon(Icons.event_outlined, size: 16, color: C.inkMute),
          const SizedBox(width: 6),
          Expanded(child: Text('Collect ${fmtDate(order.windowStart)} – ${fmtDate(order.windowEnd)} · offer ends ${fmtDate(order.expiresAt)}', style: t.bodySmall)),
        ]),
      ]),
    );
  }
}

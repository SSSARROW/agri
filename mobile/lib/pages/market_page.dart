import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../models/commitment.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';

/// Every open buyer order (B-50) — pulled out of the Farm tab into its own
/// place rather than a carousel squeezed above the plot list, since it's a
/// genuinely separate concern from "my plots" (what buyers want vs. what I
/// have) and deserves its own room to show the full delivery window and
/// standard, not just what fits in a 220px-wide card.
class MarketPage extends StatefulWidget {
  const MarketPage({super.key});

  @override
  State<MarketPage> createState() => _MarketPageState();
}

class _MarketPageState extends State<MarketPage> {
  List<Commitment>? _commitments;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await FarmService.openCommitments();
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _commitments = result.data;
        _error = null;
      } else {
        _commitments = _commitments ?? [];
        _error = result.statusCode == 401
            ? 'Your session needs refreshing — reconnect and log in again to see current buyer orders.'
            : result.error;
      }
    });
  }

  String _formatDate(DateTime date) => '${date.day}/${date.month}/${date.year}';

  @override
  Widget build(BuildContext context) {
    final commitments = _commitments;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Market', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            Text(
              'Buyers currently looking for crops, across every quality standard.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            Expanded(
              child: commitments == null
                  ? const Center(child: CircularProgressIndicator())
                  : commitments.isEmpty
                  ? Center(
                      child: Text(
                        'No open buyer orders right now.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        itemCount: commitments.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final c = commitments[i];
                          return Card(
                            color: AppColors.successBg,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.storefront_outlined,
                                        size: 18,
                                        color: AppColors.primary,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          c.crop,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ),
                                      if (c.indicativePriceLkrPerKg != null)
                                        Text(
                                          'LKR ${c.indicativePriceLkrPerKg!.toStringAsFixed(0)}/kg',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  StatusPill(c.protocolName ?? 'Any standard'),
                                  const SizedBox(height: 12),
                                  Text(
                                    '${c.remainingKg.toStringAsFixed(0)} kg wanted',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Delivery ${_formatDate(c.deliveryWindowStart)} – ${_formatDate(c.deliveryWindowEnd)}',
                                    style: const TextStyle(
                                      color: Colors.black54,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

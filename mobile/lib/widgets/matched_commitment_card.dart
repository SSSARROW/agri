import 'package:flutter/material.dart';

import '../models/batch.dart';
import '../theme/app_colors.dart';

String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

/// The buyer order a batch auto-matched at registration (B-50) — shown
/// wherever a farmer looks at a batch (the post-registration QR dialog, the
/// batch detail page) so "matched to an open buyer order" means something
/// concrete: how much, for how much, by when.
class MatchedCommitmentCard extends StatelessWidget {
  final MatchedCommitment commitment;
  const MatchedCommitmentCard(this.commitment, {super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.successBg,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.storefront, size: 16, color: AppColors.primary),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Matched to an open buyer order',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              [
                '${commitment.remainingKg.toStringAsFixed(0)} kg wanted',
                if (commitment.indicativePriceLkrPerKg != null)
                  'LKR ${commitment.indicativePriceLkrPerKg!.toStringAsFixed(0)}/kg',
              ].join(' · '),
              style: const TextStyle(fontSize: 12.5),
            ),
            Text(
              'Deliver by ${_formatDate(commitment.deliveryWindowEnd)}',
              style: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';

class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Buyer order')),
      body: AsyncView<OrderDetail>(
        load: () => Services.repo.order(orderId),
        builder: (context, o, reload) {
          final t = Theme.of(context).textTheme;
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, runSpacing: 8, children: [
              Pill('${o.crop}${o.gradeTier.isNotEmpty ? ' · ${o.gradeTier}' : ''}', tone: Tone.good),
              for (final c in o.exporter.certifications) Pill(c, tone: Tone.info, icon: Icons.verified_outlined),
            ]),
            Gaps.s,
            Text(o.title.isEmpty ? 'Buy request' : o.title, style: t.headlineMedium),
            Text(o.exporter.companyName, style: t.titleMedium?.copyWith(color: C.inkSoft)),
            Gaps.m,
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: C.bark50, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.bark100)),
              child: Row(children: [
                Expanded(flex: 3, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Price', style: t.bodySmall), Text(o.priceLine, style: t.titleMedium?.copyWith(color: C.bark700, fontWeight: FontWeight.w700))])),
                Expanded(flex: 2, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Still wanted', style: t.bodySmall), Text(fmtKg(o.remainingKg), style: t.titleLarge)])),
              ]),
            ),
            if (o.description.isNotEmpty) ...[Gaps.m, Text(o.description, style: t.bodyLarge)],
            Gaps.l,
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  InfoRow('Collection', '${fmtDate(o.windowStart)} – ${fmtDate(o.windowEnd)}'),
                  InfoRow('Pickup', o.pickup),
                  InfoRow('Offer ends', fmtDate(o.expiresAt)),
                  InfoRow('Districts', o.districts.isEmpty ? 'All districts' : o.districts.join(', ')),
                  if (o.paymentTiming.isNotEmpty) InfoRow('Payment', o.paymentTiming),
                  if (o.rejectionHandling.isNotEmpty) InfoRow('If rejected', o.rejectionHandling),
                  if (o.otherTerms.isNotEmpty) InfoRow('Other terms', o.otherTerms),
                ]),
              ),
            ),
            if (o.stages.isNotEmpty) ...[
              Gaps.l,
              Section('Quality standard', subtitle: '${o.standardName} · v${o.standardVersion}. You follow this if you supply.', children: [
                for (final s in o.stages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: ExpansionTile(
                        shape: const Border(),
                        collapsedShape: const Border(),
                        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                        leading: CircleAvatar(radius: 16, backgroundColor: C.leaf100, child: Text('${s.position}', style: const TextStyle(fontWeight: FontWeight.w700, color: C.leaf700))),
                        title: Text(s.name, style: t.titleMedium),
                        subtitle: Text(s.timing == 'recurring' ? 'Repeats · from day ${s.startOffset}' : 'Day ${s.startOffset}', style: t.bodySmall),
                        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        expandedCrossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (s.instructions.isNotEmpty) Text(s.instructions, style: t.bodyMedium),
                          for (final d in s.dos) Padding(padding: const EdgeInsets.only(top: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.check, size: 20, color: C.leaf600), Gaps.s, Expanded(child: Text(d))])),
                          for (final d in s.donts) Padding(padding: const EdgeInsets.only(top: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.close, size: 20, color: C.danger), Gaps.s, Expanded(child: Text(d))])),
                          if (s.allowedInputs.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Allowed: ${s.allowedInputs.join(', ')}', style: t.bodySmall)),
                          if (s.photoCount > 0) Padding(padding: const EdgeInsets.only(top: 8), child: Pill('${s.photoCount} proof photo${s.photoCount > 1 ? 's' : ''} required', tone: Tone.bark, icon: Icons.photo_camera_outlined)),
                        ],
                      ),
                    ),
                  ),
              ]),
            ],
            Gaps.l,
            if (o.isOpen)
              FilledButton.icon(onPressed: () => _apply(context, o), icon: const Icon(Icons.send_rounded), label: const Text('Apply to supply'))
            else
              const Banner2(tone: Tone.neutral, title: 'This order is no longer open', icon: Icons.lock_outline),
          ]);
        },
      ),
    );
  }

  Future<void> _apply(BuildContext context, OrderDetail o) async {
    final done = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => _ApplySheet(order: o));
    if (done == true && context.mounted) Navigator.pop(context);
  }
}

class _ApplySheet extends StatefulWidget {
  const _ApplySheet({required this.order});
  final OrderDetail order;
  @override
  State<_ApplySheet> createState() => _ApplySheetState();
}

class _ApplySheetState extends State<_ApplySheet> {
  final _kg = TextEditingController();
  bool _busy = false;
  String? _err;

  Future<void> _send() async {
    final kg = parseNum(_kg.text);
    if (kg == null || kg <= 0) return setState(() => _err = 'Enter how many kg you can supply.');
    if (kg > widget.order.quantityKg) return setState(() => _err = 'That is more than the whole order (${fmtKg(widget.order.quantityKg)}).');
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final msg = await Services.repo.apply(widget.order.id, widget.order.adVersionId, kg);
      if (!mounted) return;
      snack(context, msg);
      Navigator.pop(context, true);
    } catch (e) {
      setState(() => _err = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('How much can you supply?', style: t.titleLarge),
        Gaps.xs,
        Text('${widget.order.exporter.companyName} will review your offer. If approved they can call you.', style: t.bodyMedium),
        Gaps.m,
        TextField(controller: _kg, autofocus: true, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimalOnly, decoration: InputDecoration(labelText: 'Quantity (kg)', errorText: _err)),
        Gaps.s,
        Text('You will be bound to the terms and standard you just read. Applying also asks to follow this exporter.', style: t.bodySmall),
        Gaps.m,
        BusyButton(label: 'Send application', busy: _busy, onPressed: _send),
      ]),
    );
  }
}

class ApplicationsList extends StatelessWidget {
  const ApplicationsList({super.key});
  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Application>>(
      load: Services.repo.applications,
      builder: (context, apps, reload) {
        if (apps.isEmpty) return const EmptyPanel(icon: Icons.assignment_outlined, title: 'No applications yet', body: 'When you apply to a buyer order it shows up here with its status.');
        final t = Theme.of(context).textTheme;
        return Column(children: [
          for (final a in apps)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(a.adTitle.isEmpty ? '${a.crop} order' : a.adTitle, style: t.titleMedium)),
                      Pill(titleCase(a.status), tone: statusTone(a.status)),
                    ]),
                    Text(a.exporter, style: t.bodyMedium),
                    Gaps.s,
                    Text('You offered ${fmtKg(a.supplyKg)} · ${a.priceLine}', style: t.bodyLarge),
                    Text('Collect ${fmtDate(a.windowStart)} – ${fmtDate(a.windowEnd)}', style: t.bodySmall),
                    Text('Applied ${fmtDate(a.acceptedAt)}', style: t.bodySmall),
                    if (a.status == 'approved') const Padding(padding: EdgeInsets.only(top: 8), child: Text('Approved. Contact the exporter to arrange collection or to ask for removal.', style: TextStyle(color: C.leaf700, fontSize: 14.5))),
                    if (a.status == 'pending')
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () async {
                            final ok = await confirmDialog(context, title: 'Withdraw this application?', body: 'You may not be able to apply to this order again.', confirm: 'Withdraw', danger: true);
                            if (!ok) return;
                            try {
                              await Services.repo.withdraw(a.adId);
                              if (context.mounted) snack(context, 'Application withdrawn.');
                              reload();
                            } catch (e) {
                              if (context.mounted) snack(context, errText(e));
                            }
                          },
                          child: const Text('Withdraw', style: TextStyle(color: C.danger)),
                        ),
                      ),
                  ]),
                ),
              ),
            ),
        ]);
      },
    );
  }
}

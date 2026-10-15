import 'package:flutter/material.dart';

import '../core/farm_service.dart';
import '../models/batch.dart';
import '../models/plot_event.dart';
import '../theme/app_colors.dart';
import '../widgets/batch_qr_dialog.dart';
import '../widgets/matched_commitment_card.dart';
import '../widgets/ui_kit.dart';
import 'batch_schedule_page.dart';

const _eventIcons = <String, IconData>{
  'collect': Icons.shopping_basket_outlined,
  'collector_attestation': Icons.verified_outlined,
  'weigh': Icons.scale_outlined,
  'process': Icons.science_outlined,
  'grade': Icons.workspace_premium_outlined,
  'pack': Icons.inventory_2_outlined,
  'scan': Icons.qr_code_scanner,
  'batch_photo': Icons.photo_camera_outlined,
};

// Shown inline under a timeline item's title — raw coordinates and the
// photo/caption fields (rendered their own way below) would just be noise
// here.
const _hiddenPayloadKeys = {
  'photo_url',
  'caption',
  'location_flagged',
  'distance_from_plot_m',
  'lat',
  'lon',
};

String _formatDateTime(DateTime d) {
  final local = d.toLocal();
  final h = local.hour.toString().padLeft(2, '0');
  final m = local.minute.toString().padLeft(2, '0');
  return '${local.day}/${local.month}/${local.year}, $h:$m';
}

String _titleCase(String raw) => raw
    .split('_')
    .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');

/// Everything about one batch past the QR code — the matched buyer order (if
/// any), its quality-standard progress, and the full harvest/pipeline
/// timeline (collect, weigh, process, grade, pack, photos). Previously
/// tapping a batch only ever opened the QR dialog, with no way to look back
/// at what had actually happened to it.
class BatchDetailPage extends StatefulWidget {
  final Batch batch;
  final String? plotName;
  const BatchDetailPage({super.key, required this.batch, this.plotName});

  @override
  State<BatchDetailPage> createState() => _BatchDetailPageState();
}

class _BatchDetailPageState extends State<BatchDetailPage> {
  List<PlotEvent>? _events;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await FarmService.batchEvents(widget.batch.id);
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _events = result.data;
        _error = null;
      } else {
        _error = result.statusCode == 401
            ? 'Your session needs refreshing — log out and log back in to see this.'
            : (result.error ?? 'Could not load.');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final batch = widget.batch;
    return Scaffold(
      appBar: AppBar(
        title: Text(batch.code, style: const TextStyle(letterSpacing: 1)),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code),
            tooltip: 'View / share QR',
            onPressed: () => showBatchQrDialog(
              context,
              batch.code,
              subtitle: batch.protocolName != null
                  ? '${batch.crop} · ${batch.protocolName}'
                  : batch.crop,
              matchedCommitment: batch.commitment,
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const IconCircle(Icons.inventory_2, size: 48),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          batch.protocolName != null
                              ? '${batch.crop} · ${batch.protocolName}'
                              : batch.crop,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        if (widget.plotName != null)
                          Text(
                            widget.plotName!,
                            style: const TextStyle(
                              color: Colors.black54,
                              fontSize: 13,
                            ),
                          ),
                        const SizedBox(height: 6),
                        StatusPill(batch.latestStatus.toUpperCase()),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (batch.commitment != null) ...[
                MatchedCommitmentCard(batch.commitment!),
                const SizedBox(height: 16),
              ],
              if (batch.protocolId != null) ...[
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.checklist_outlined),
                    title: const Text('Quality standard progress'),
                    subtitle: Text(batch.protocolName ?? ''),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => BatchSchedulePage(
                          batchId: batch.id,
                          batchCode: batch.code,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              const SectionHeader('Timeline'),
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const IconCircle(Icons.flag_outlined, size: 36),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Registered',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            _formatDateTime(batch.createdAt),
                            style: const TextStyle(
                              color: Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (_events == null && _error == null)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                Text(_error!, style: const TextStyle(color: AppColors.danger))
              else
                for (final event in _events!) _TimelineItem(event: event),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final PlotEvent event;
  const _TimelineItem({required this.event});

  @override
  Widget build(BuildContext context) {
    final payload = event.payload;
    final fields = payload.entries
        .where((e) => !_hiddenPayloadKeys.contains(e.key))
        .toList();
    final photoUrl = payload['photo_url'] as String?;
    final caption = payload['caption'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconCircle(
            _eventIcons[event.eventType] ?? Icons.circle_outlined,
            size: 36,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _titleCase(event.eventType),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  _formatDateTime(event.occurredAt),
                  style: const TextStyle(color: Colors.black54, fontSize: 12),
                ),
                if (fields.isNotEmpty)
                  Text(
                    fields
                        .map((e) => '${_titleCase(e.key)}: ${e.value}')
                        .join(' · '),
                    style: const TextStyle(fontSize: 13),
                  ),
                if (caption != null) ...[
                  const SizedBox(height: 4),
                  Text(caption, style: const TextStyle(fontSize: 13)),
                ],
                if (photoUrl != null) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      photoUrl,
                      height: 160,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        height: 160,
                        color: const Color(0xFFF5F5F5),
                        child: const Icon(Icons.broken_image),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

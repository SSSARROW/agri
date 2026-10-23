import 'package:flutter/material.dart';

import '../../../core/constants.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/status_strip.dart';
import '../market/market_tab.dart';
import '../settings/me_screen.dart';
import 'batch_screens.dart';
import 'evidence.dart';
import 'plot_detail.dart';
import 'plot_register.dart';
import 'scanner.dart';

/// The farmer's app: Farm · Batches · Market · Me.
class FarmHome extends StatefulWidget {
  const FarmHome({super.key});
  @override
  State<FarmHome> createState() => _FarmHomeState();
}

class _FarmHomeState extends State<FarmHome> {
  int _tab = 0;
  final Set<int> _visited = {0};
  int _unread = 0;
  int _rev = 0;

  @override
  void initState() {
    super.initState();
    _loadUnread();
    Services.sync.start();
  }

  Future<void> _loadUnread() async {
    final n = await Services.repo.unreadCount();
    if (mounted) setState(() => _unread = n);
  }

  Future<void> _scan() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (ctx) => ScanBatchScreen(onBatch: (code) async {
          final b = await Services.repo.batchByCode(code);
          if (!ctx.mounted) return;
          await Navigator.push(ctx, MaterialPageRoute(builder: (_) => RecordStageScreen(batch: b)));
        }),
      ),
    );
    setState(() => _rev++);
  }

  @override
  Widget build(BuildContext context) {
    const titles = ['My farm', 'Batches', 'Market', 'Me'];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_tab]),
        actions: [
          if (_tab == 1) IconButton(onPressed: _scan, icon: const Icon(Icons.qr_code_scanner, size: 28), tooltip: 'Scan a batch QR'),
          if (_tab != 3)
            Stack(alignment: Alignment.center, children: [
              IconButton(
                onPressed: () => setState(() {
                  _tab = 3;
                  _visited.add(3);
                }),
                icon: const Icon(Icons.notifications_none_rounded, size: 28),
                tooltip: 'Notifications',
              ),
              if (_unread > 0) Positioned(right: 8, top: 8, child: Container(padding: const EdgeInsets.all(4), decoration: const BoxDecoration(color: C.bark500, shape: BoxShape.circle), child: Text('$_unread', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)))),
            ]),
        ],
      ),
      body: Column(children: [
        const StatusStrip(),
        Expanded(
          // Tabs load the first time they are opened, so launching offline isn't a wall of errors.
          child: IndexedStack(index: _tab, children: [
            _FarmTab(key: ValueKey('farm$_rev'), unread: _unread, onGoNotifications: () => setState(() {
              _tab = 3;
              _visited.add(3);
            })),
            if (_visited.contains(1)) BatchesTab(key: ValueKey('b$_rev')) else const SizedBox.shrink(),
            if (_visited.contains(2)) const MarketTab() else const SizedBox.shrink(),
            if (_visited.contains(3)) MeScreen(unread: _unread, onUnreadChanged: _loadUnread) else const SizedBox.shrink(),
          ]),
        ),
      ]),
      floatingActionButton: _tab == 1
          ? FloatingActionButton.extended(onPressed: _scan, backgroundColor: C.bark600, foregroundColor: Colors.white, icon: const Icon(Icons.qr_code_scanner), label: const Text('Scan QR', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)))
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) {
          setState(() {
            _tab = i;
            _visited.add(i);
          });
          if (i == 0 || i == 3) _loadUnread();
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.landscape_outlined), selectedIcon: Icon(Icons.landscape), label: 'Farm'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Batches'),
          NavigationDestination(icon: Icon(Icons.storefront_outlined), selectedIcon: Icon(Icons.storefront), label: 'Market'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Me'),
        ],
      ),
    );
  }
}

/* ── Farm tab ─────────────────────────────────────────────────────────────── */

class _FarmTab extends StatelessWidget {
  const _FarmTab({super.key, required this.unread, required this.onGoNotifications});
  final int unread;
  final VoidCallback onGoNotifications;

  Future<(List<Plot>, Map<String, PhotoSchedule?>)> _load() async {
    final plots = await Services.repo.myPlots();
    final sched = <String, PhotoSchedule?>{};
    await Future.wait(plots.map((p) async {
      try {
        sched[p.id] = await Services.repo.photoSchedule(p.id);
      } catch (_) {
        sched[p.id] = null; // a failed status only hides that plot's status line
      }
    }));
    return (plots, sched);
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<(List<Plot>, Map<String, PhotoSchedule?>)>(
      load: _load,
      builder: (context, data, reload) {
        final (plots, sched) = data;
        final t = Theme.of(context).textTheme;

        Future<void> register() async {
          final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const PlotRegisterScreen()));
          if (ok == true) reload();
        }

        if (plots.isEmpty) {
          return Column(children: [
            const SizedBox(height: 24),
            Container(width: 96, height: 96, decoration: const BoxDecoration(color: C.leaf50, shape: BoxShape.circle), child: const Icon(Icons.add_location_alt_outlined, size: 46, color: C.leaf600)),
            Gaps.l,
            Text('Start with your first plot', style: t.headlineMedium, textAlign: TextAlign.center),
            Gaps.s,
            Text('Walk its corners or trace them on a satellite map. Everything else (plantings, harvests, QR labels) builds on this.', style: t.bodyLarge, textAlign: TextAlign.center),
            Gaps.l,
            FilledButton.icon(onPressed: register, icon: const Icon(Icons.add), label: const Text('Register a plot')),
          ]);
        }

        final alerts = <Widget>[];
        for (final p in plots) {
          final s = evidenceStatus(sched[p.id]);
          if (s != null && s.tone == Tone.bad) {
            alerts.add(Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Banner2(tone: Tone.bad, title: '${p.displayName}: ${s.text}', action: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlotDetailScreen(plot: p))).then((_) => reload()), actionLabel: 'Open plot'),
            ));
          }
        }
        if (unread > 0) {
          alerts.add(Padding(padding: const EdgeInsets.only(bottom: 10), child: Banner2(tone: Tone.info, title: '$unread new notification${unread == 1 ? '' : 's'}', action: onGoNotifications, actionLabel: 'Read', icon: Icons.notifications_active_outlined)));
        }

        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ...alerts,
          Section(
            'Your plots',
            subtitle: '${plots.length} plot${plots.length == 1 ? '' : 's'}',
            action: FilledButton.tonalIcon(onPressed: register, style: FilledButton.styleFrom(minimumSize: const Size(0, 44)), icon: const Icon(Icons.add), label: const Text('Add')),
            children: [
              for (final p in plots)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _PlotCard(plot: p, status: evidenceStatus(sched[p.id]), onTap: () async {
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => PlotDetailScreen(plot: p)));
                    reload();
                  }),
                ),
            ],
          ),
        ]);
      },
    );
  }
}

class _PlotCard extends StatelessWidget {
  const _PlotCard({required this.plot, required this.status, required this.onTap});
  final Plot plot;
  final ({String text, Tone tone})? status;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Tappable(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(plot.displayName, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis)),
          Text(fmtHa(plot.areaHa), style: t.titleMedium?.copyWith(color: C.leaf700)),
        ]),
        if (plot.location.isNotEmpty) Text(plot.location, style: t.bodySmall),
        Gaps.s,
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (plot.plotType != 'open_field') Pill(plotTypes[plot.plotType] ?? titleCase(plot.plotType), tone: Tone.neutral),
          Pill(plot.measured ? 'Measured' : 'Estimated', tone: plot.measured ? Tone.good : Tone.warn, icon: plot.measured ? Icons.straighten : Icons.help_outline),
          for (final p in plot.plantings) Pill(p.crop, tone: Tone.bark, icon: Icons.eco_outlined),
        ]),
        if (status != null) ...[
          Gaps.s,
          Row(children: [
            Icon(status!.tone == Tone.bad ? Icons.error_outline : Icons.photo_camera_outlined, size: 18, color: toneColors(status!.tone).fg),
            Gaps.xs,
            Expanded(child: Text(status!.text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: toneColors(status!.tone).fg))),
          ]),
        ],
      ]),
    );
  }
}

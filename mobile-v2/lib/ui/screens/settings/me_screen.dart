import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/config.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../auth/auth_screens.dart';
import '../market/exporter_screens.dart';
import '../market/notifications_screen.dart';
import 'sync_screen.dart';

class MeScreen extends StatefulWidget {
  const MeScreen({super.key, this.unread = 0, this.onUnreadChanged});
  final int unread;
  final VoidCallback? onUnreadChanged;
  @override
  State<MeScreen> createState() => _MeScreenState();
}

class _MeScreenState extends State<MeScreen> {
  String _version = '';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((p) {
      if (mounted) setState(() => _version = '${p.version} (${p.buildNumber})');
    });
  }

  Future<void> _logout() async {
    final ok = await confirmDialog(
      context,
      title: 'Log out?',
      body: 'Anything already recorded stays saved on this phone and on the server. You will need your email and password to sign back in.',
      confirm: 'Log out',
      danger: true,
    );
    if (!ok) return;
    // Screens pushed above the home (e.g. the collector's Me page) must not outlive the session.
    if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    await Services.session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final farmer = Services.session.isFarmer;
    return AsyncView<UserProfile>(
      load: Services.repo.me,
      builder: (context, u, reload) {
        final t = Theme.of(context).textTheme;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(radius: 32, backgroundColor: C.leaf100, child: Text(((u.name ?? u.email).isEmpty ? '?' : (u.name ?? u.email)[0]).toUpperCase(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: C.leaf700))),
            Gaps.m,
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(u.name ?? u.email, style: t.titleLarge),
                Gaps.xs,
                Pill(u.role == 'collector' ? 'Collector' : 'Farmer', tone: Tone.good),
              ]),
            ),
          ]),
          Gaps.l,
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                InfoRow('Email', u.email),
                InfoRow('Phone', u.phone),
                InfoRow('Location', u.location),
                const Divider(),
                Padding(padding: const EdgeInsets.only(top: 8), child: Text('Your account type and location are set at sign-up. Contact support to change them.', style: t.bodySmall)),
              ]),
            ),
          ),
          Gaps.l,
          if (farmer) ...[
            _Tile(
              icon: Icons.notifications_none_rounded,
              title: 'Notifications',
              trailing: widget.unread > 0 ? Pill('${widget.unread} new', tone: Tone.bark) : null,
              onTap: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                widget.onUnreadChanged?.call();
              },
            ),
            _Tile(icon: Icons.handshake_outlined, title: 'My exporter', onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExporterScreen()))),
          ],
          ListenableBuilder(
            listenable: Services.queue,
            builder: (_, _) => _Tile(
              icon: Icons.sync,
              title: 'Sync',
              trailing: Pill(Services.queue.pendingCount == 0 ? 'All synced' : '${Services.queue.pendingCount} pending', tone: Services.queue.pendingCount == 0 ? Tone.good : Tone.warn),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SyncScreen())),
            ),
          ),
          _Tile(icon: Icons.pin_outlined, title: 'Change PIN', onTap: () async {
            final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const PinSetupScreen(changing: true)));
            if (ok == true && context.mounted) snack(context, 'PIN updated.');
          }),
          Gaps.l,
          OutlinedButton.icon(onPressed: _logout, icon: const Icon(Icons.logout), label: const Text('Log out')),
          Gaps.l,
          Center(child: Text('Origo Field $_version', style: t.bodySmall)),
          if (!Config.qrIsPublic)
            Padding(padding: const EdgeInsets.only(top: 12), child: Banner2(tone: Tone.warn, title: 'Test server build', body: 'QR labels from this build point to ${Config.fieldApi}, which buyers cannot open. Do not print them.')),
        ]);
      },
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.onTap, this.trailing});
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Tappable(
        onTap: onTap,
        child: Row(children: [
          Icon(icon, color: C.leaf600, size: 26),
          Gaps.m,
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
          if (trailing != null) ...[trailing!, Gaps.s],
          const Icon(Icons.chevron_right, color: C.inkMute),
        ]),
      ),
    );
  }
}

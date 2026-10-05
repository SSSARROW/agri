import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../core/auth_service.dart';
import '../core/event_queue.dart';
import '../core/farm_service.dart';
import '../models/user_profile.dart';
import '../theme/app_colors.dart';
import '../widgets/ui_kit.dart';
import 'pin_setup_page.dart';
import 'queue_page.dart';

const _roleLabels = {
  'farmer': 'Farmer',
  'collector': 'Collector',
  'admin': 'Admin',
  'exporter': 'Exporter',
};

/// One place for account info, PIN management and logout — previously
/// scattered as a bare logout icon on whichever tab happened to be open,
/// with no way to see who you were signed in as or manage the PIN after
/// initial setup.
class SettingsPage extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const SettingsPage({super.key, required this.onLoggedOut});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  UserProfile? _profile;
  String? _error;
  String _version = '';

  @override
  void initState() {
    super.initState();
    _load();
    _loadVersion();
  }

  Future<void> _load() async {
    final result = await FarmService.myProfile();
    if (!mounted) return;
    setState(() {
      if (result.isOk) {
        _profile = result.data;
      } else {
        _error = result.statusCode == 401
            ? 'Your session needs refreshing — log out and log back in to see your account details.'
            : result.error;
      }
    });
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (!mounted) return;
    setState(() => _version = '${info.version} (${info.buildNumber})');
  }

  Future<void> _changePin() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PinSetupPage(onDone: () => Navigator.of(context).pop()),
      ),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('PIN updated.')));
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text(
          "Anything already recorded stays saved on this device and on the "
          "server. You'll need your email and password to sign back in.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await AuthService.instance.logout();
    widget.onLoggedOut();
  }

  @override
  Widget build(BuildContext context) {
    final role = AuthService.instance.role;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Settings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _profile == null
                  ? SizedBox(
                      height: 60,
                      child: Center(
                        child: _error != null
                            ? Text(
                                _error!,
                                style: const TextStyle(color: Colors.black54),
                                textAlign: TextAlign.center,
                              )
                            : const CircularProgressIndicator(),
                      ),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 26,
                              backgroundColor: AppColors.primary,
                              child: Text(
                                (_profile!.name?.isNotEmpty == true
                                        ? _profile!.name![0]
                                        : _profile!.email[0])
                                    .toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _profile!.name ?? _profile!.email,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _roleLabels[_profile!.role] ??
                                        _profile!.role,
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
                        const Divider(height: 28),
                        _InfoRow(label: 'Email', value: _profile!.email),
                        if (_profile!.phone != null)
                          _InfoRow(label: 'Phone', value: _profile!.phone!),
                        if (_profile!.district != null)
                          _InfoRow(
                            label: 'Location',
                            value: [
                              _profile!.gnDivision,
                              _profile!.dsd,
                              _profile!.district,
                            ].whereType<String>().join(', '),
                          ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 24),
          const SectionHeader('Security'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.pin_outlined),
                  title: Text(
                    AuthService.instance.hasPin ? 'Change PIN' : 'Set up a PIN',
                  ),
                  subtitle: const Text(
                    'Used to open the app without a network connection',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _changePin,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const SectionHeader('Sync'),
          Card(
            child: ValueListenableBuilder<Box<Map>>(
              valueListenable: EventQueue.listenable(),
              builder: (context, box, _) {
                final pending = EventQueue.pendingCount();
                return ListTile(
                  leading: Icon(
                    pending == 0
                        ? Icons.cloud_done_outlined
                        : Icons.cloud_sync_outlined,
                  ),
                  title: Text(
                    pending == 0 ? 'All synced' : '$pending pending sync',
                  ),
                  subtitle: const Text(
                    'What you record is saved on this device first, then sent when there\'s a connection',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(
                    context,
                  ).push(MaterialPageRoute(builder: (_) => const QueuePage())),
                );
              },
            ),
          ),
          if (role != null) ...[
            const SizedBox(height: 24),
            const SectionHeader('Account type'),
            Card(
              child: ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text(_roleLabels[role] ?? role),
                subtitle: const Text(
                  'Set at signup — contact support to change roles',
                ),
              ),
            ),
          ],
          const SizedBox(height: 32),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
              minimumSize: const Size(double.infinity, 50),
            ),
            onPressed: _confirmLogout,
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              _version.isEmpty ? 'Agri Field' : 'Agri Field · v$_version',
              style: const TextStyle(color: Colors.black38, fontSize: 12),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(color: Colors.black54, fontSize: 13),
            ),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}

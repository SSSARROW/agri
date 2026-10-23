import 'package:flutter/material.dart';

import '../../../core/device.dart';
import '../../../core/theme.dart';
import '../../widgets/common.dart';

/// Wraps a task that is impossible without GPS (walking a boundary). Re-checks
/// automatically when the person returns from settings or switches location back on.
class LocationGate extends StatefulWidget {
  const LocationGate({super.key, required this.child});
  final Widget child;
  @override
  State<LocationGate> createState() => _LocationGateState();
}

class _LocationGateState extends State<LocationGate> with WidgetsBindingObserver {
  LocationBlock? _block;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    final b = await Device.locationStatus();
    if (mounted) setState(() => _block = b);
  }

  @override
  Widget build(BuildContext context) {
    final b = _block;
    if (b == null) return const Center(child: CircularProgressIndicator(color: C.leaf600));
    if (b == LocationBlock.none) return widget.child;

    final (icon, title, body, label, action) = switch (b) {
      LocationBlock.serviceOff => (Icons.location_off_outlined, 'Turn on location', 'Your phone\'s location is off. Marking a boundary needs GPS so the plot is recorded exactly where it is.', 'Open location settings', () => Device.openLocationSettings()),
      LocationBlock.denied => (Icons.location_searching, 'Allow location', 'Origo needs your location while you mark the boundary. It is only used to record this plot.', 'Allow location', () async {
          await Device.requestPermission();
          _check();
        }),
      _ => (Icons.lock_outline, 'Location is blocked', 'Location permission was turned off for this app. Open settings and allow it, then come back.', 'Open app settings', () => Device.openAppSettings()),
    };
    return EmptyPanel(icon: icon, title: title, body: body, action: () => action(), actionLabel: label);
  }
}

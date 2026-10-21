import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../theme/app_colors.dart';

/// Blocks [child] behind a full-screen "turn location on" prompt until the
/// device's location service AND permission are both actually granted.
///
/// A plot boundary — walked pins or corners traced on satellite imagery —
/// is the one piece of evidence the platform has that a plot is where the
/// farmer says it is. With location off, either flow can be completed from
/// anywhere with nothing to show it wasn't. Used at the top of both
/// PlotBoundaryWalkPage and PlotMapTracePage so that's required before
/// marking starts, not just reactively failing partway through.
///
/// Keeps watching `Geolocator.getServiceStatusStream()` for as long as
/// [child] is showing, too — if location gets switched off mid-task (the
/// farmer pulls down the quick-settings shade without ever backgrounding
/// the app), this falls back to the blocking prompt immediately rather than
/// only catching it on the next GPS-dependent action.
class LocationRequiredGate extends StatefulWidget {
  final Widget child;
  // Fires once, the first time the gate turns ready. [child]'s own
  // initState already runs as soon as its page is pushed - before the gate
  // has had a chance to show its explanation - so anything that would
  // itself trigger a system permission prompt (a GPS fix request) belongs
  // here instead of in [child]'s initState, or the OS dialog can appear
  // before the farmer ever sees why.
  final VoidCallback? onReady;
  const LocationRequiredGate({super.key, required this.child, this.onReady});

  @override
  State<LocationRequiredGate> createState() => _LocationRequiredGateState();
}

class _LocationRequiredGateState extends State<LocationRequiredGate>
    with WidgetsBindingObserver {
  bool? _serviceOn; // null = still checking
  bool? _permissionOk;
  bool _busy = false;
  bool _firedReady = false;
  StreamSubscription<ServiceStatus>? _serviceSub;

  bool get _ready => _serviceOn == true && _permissionOk == true;

  // Fires widget.onReady exactly once, the first time both checks pass -
  // call after any setState that could flip readiness.
  void _maybeFireReady() {
    if (_ready && !_firedReady) {
      _firedReady = true;
      widget.onReady?.call();
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
    // Service status changes are pushed live by the OS - catches the
    // quick-settings-toggle case that app-resume alone would miss.
    _serviceSub = Geolocator.getServiceStatusStream().listen((status) {
      if (!mounted) return;
      setState(() => _serviceOn = status == ServiceStatus.enabled);
      _maybeFireReady();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _serviceSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Catches coming back from the device's location/app-settings screen.
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    bool serviceOn;
    try {
      serviceOn = await Geolocator.isLocationServiceEnabled();
    } catch (_) {
      serviceOn = false;
    }
    LocationPermission permission;
    try {
      permission = await Geolocator.checkPermission();
    } catch (_) {
      permission = LocationPermission.denied;
    }
    if (!mounted) return;
    setState(() {
      _serviceOn = serviceOn;
      _permissionOk =
          permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
    });
    _maybeFireReady();
  }

  Future<void> _requestPermission() async {
    setState(() => _busy = true);
    LocationPermission permission = LocationPermission.denied;
    try {
      permission = await Geolocator.requestPermission();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _busy = false;
      _permissionOk =
          permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
    });
    _maybeFireReady();
    if (permission == LocationPermission.deniedForever) {
      await Geolocator.openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_ready) return widget.child;
    if (_serviceOn == null || _permissionOk == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final needsService = _serviceOn != true;
    final title = needsService
        ? 'Turn on location'
        : 'Allow location access';
    final explanation = needsService
        ? 'Marking a plot boundary needs your device\'s location switched '
              'on — whether you walk it or trace it on the map, this is '
              'what confirms the boundary was recorded at the real plot.'
        : 'Paramparā needs permission to use your location to mark a plot '
              'boundary — this confirms the boundary was recorded at the '
              'real plot.';

    return Scaffold(
      appBar: AppBar(title: const Text('Location required')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.location_off_outlined,
                size: 56,
                color: AppColors.warning,
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                explanation,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy
                      ? null
                      : () => needsService
                            ? Geolocator.openLocationSettings()
                            : _requestPermission(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 48),
                  ),
                  child: _busy
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          needsService
                              ? 'Turn on location'
                              : 'Grant permission',
                        ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: _check,
                child: const Text('I\'ve done this — check again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import 'core/auth_service.dart';
import 'core/event_queue.dart';
import 'core/sync_service.dart';
import 'pages/batches_page.dart';
import 'pages/farm_page.dart';
import 'pages/login_page.dart';
import 'pages/queue_page.dart';
import 'pages/scan_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EventQueue.init();
  await AuthService.instance.restore();
  SyncService.instance.start();
  runApp(const AgriFieldApp());
}

class AgriFieldApp extends StatelessWidget {
  const AgriFieldApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Agri Field',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF1B5E20),
        scaffoldBackgroundColor: Colors.white,
        textTheme: const TextTheme(
          headlineMedium: TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  Widget build(BuildContext context) {
    if (!AuthService.instance.isLoggedIn) {
      return LoginPage(onLoggedIn: () => setState(() {}));
    }
    return RootShell(onLoggedOut: () => setState(() {}));
  }
}

class RootShell extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const RootShell({super.key, required this.onLoggedOut});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    // Built on demand (not an IndexedStack) so the Scan tab's camera only
    // initializes once the user actually opens it, and releases it on leaving.
    final page = switch (_index) {
      0 => FarmPage(onLoggedOut: widget.onLoggedOut),
      1 => const BatchesPage(),
      2 => const ScanPage(),
      _ => const QueuePage(),
    };

    return Scaffold(
      body: page,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        height: 64,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.grass_outlined), selectedIcon: Icon(Icons.grass), label: 'Farm'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Batches'),
          NavigationDestination(
              icon: Icon(Icons.qr_code_scanner_outlined), selectedIcon: Icon(Icons.qr_code_scanner), label: 'Scan'),
          NavigationDestination(
              icon: Icon(Icons.inbox_outlined), selectedIcon: Icon(Icons.inbox), label: 'Queue'),
        ],
      ),
    );
  }
}

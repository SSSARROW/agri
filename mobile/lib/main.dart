import 'package:flutter/material.dart';

import 'core/event_queue.dart';
import 'pages/home_page.dart';
import 'pages/queue_page.dart';
import 'pages/scan_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EventQueue.init();
  runApp(const AgriFieldApp());
}

class AgriFieldApp extends StatelessWidget {
  const AgriFieldApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Agri Field Capture',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF1B5E20),
        scaffoldBackgroundColor: Colors.white,
        textTheme: const TextTheme(
          headlineMedium: TextStyle(fontWeight: FontWeight.bold, fontSize: 28),
        ),
      ),
      home: const RootShell(),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});

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
      0 => const HomePage(),
      1 => const ScanPage(),
      _ => const QueuePage(),
    };

    return Scaffold(
      body: page,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        height: 64,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.qr_code_scanner_outlined), selectedIcon: Icon(Icons.qr_code_scanner), label: 'Scan'),
          NavigationDestination(
              icon: Icon(Icons.inbox_outlined), selectedIcon: Icon(Icons.inbox), label: 'Queue'),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import 'core/auth_service.dart';
import 'core/event_queue.dart';
import 'core/sync_service.dart';
import 'pages/batches_page.dart';
import 'pages/collector_home_page.dart';
import 'pages/farm_page.dart';
import 'pages/login_page.dart';
import 'pages/market_page.dart';
import 'pages/pin_setup_page.dart';
import 'pages/pin_unlock_page.dart';
import 'pages/scan_page.dart';
import 'pages/settings_page.dart';
import 'theme/app_colors.dart';

// One seed color drives the whole app's palette (kept — it was already
// "fine," per feedback; what needed work was consistency, not the hue).
const _seedColor = AppColors.primary;

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
    final colorScheme = ColorScheme.fromSeed(seedColor: _seedColor);
    return MaterialApp(
      title: 'Agri Field',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: colorScheme,
        scaffoldBackgroundColor: const Color(0xFFFAFAF7),
        textTheme: const TextTheme(
          headlineMedium: TextStyle(fontWeight: FontWeight.bold, fontSize: 26),
          titleLarge: TextStyle(fontWeight: FontWeight.w700, fontSize: 19),
          titleMedium: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          // SectionHeader's style — one consistent "small heading above a
          // group of cards" everywhere, instead of each page dimming
          // titleLarge down by a different amount.
          titleSmall: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: Colors.black87,
          ),
          bodyMedium: TextStyle(fontSize: 14, color: Colors.black87),
          bodySmall: TextStyle(fontSize: 13, color: Colors.black54),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFFAFAF7),
          foregroundColor: Colors.black87,
          elevation: 0,
          centerTitle: false,
          surfaceTintColor: Colors.transparent,
        ),
        // Flat, tonal, borderless — a soft fill tells a card apart from the
        // page background without the "outlined box" look a line-drawn
        // border gives it. No shadow either: on a field app read in bright
        // sunlight, a hairline border was often invisible anyway, so the
        // tonal fill is also the more reliable signal.
        cardTheme: CardThemeData(
          elevation: 0,
          color: const Color(0xFFF3F4F0),
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        chipTheme: ChipThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: colorScheme.outlineVariant),
          ),
          selectedColor: _seedColor,
          labelStyle: const TextStyle(color: Colors.black87),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: colorScheme.outlineVariant),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: colorScheme.outlineVariant),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: _seedColor, width: 2),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _seedColor,
            foregroundColor: Colors.white,
            disabledBackgroundColor: _seedColor.withValues(alpha: 0.35),
            minimumSize: const Size(0, 50),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _seedColor,
            minimumSize: const Size(0, 46),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            side: BorderSide(color: colorScheme.outlineVariant),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(foregroundColor: _seedColor),
        ),
        dialogTheme: DialogThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        bottomSheetTheme: const BottomSheetThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: _seedColor.withValues(alpha: 0.15),
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => TextStyle(
              fontSize: 12,
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w700
                  : FontWeight.w500,
              color: states.contains(WidgetState.selected)
                  ? _seedColor
                  : Colors.black54,
            ),
          ),
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
  // Whether the PIN (or a fresh network login) has already proven identity
  // for this app process — resets to false on every cold start, which is
  // exactly the point: a stored token alone should never skip the PIN.
  bool _unlockedThisLaunch = false;

  @override
  Widget build(BuildContext context) {
    final auth = AuthService.instance;

    if (!auth.isLoggedIn) {
      return LoginPage(onLoggedIn: () => setState(() {}));
    }
    // _unlockedThisLaunch must win over hasPin here — "Skip for now" proves
    // identity for this launch without setting a PIN, so checking hasPin
    // first would loop the farmer straight back into PinSetupPage forever.
    if (!auth.hasPin && !_unlockedThisLaunch) {
      return PinSetupPage(
        onDone: () => setState(() => _unlockedThisLaunch = true),
      );
    }
    if (!_unlockedThisLaunch) {
      return PinUnlockPage(
        onUnlocked: () => setState(() => _unlockedThisLaunch = true),
        onUseEmailInstead: () => setState(() {}),
      );
    }
    return RootShell(
      onLoggedOut: () => setState(() => _unlockedThisLaunch = false),
    );
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
    // Collectors get a single-purpose scan-and-merge screen plus Settings,
    // not the farmer's Farm/Batches/Scan/Queue nav — the two roles do
    // genuinely different field work, not just a filtered view of the same
    // one.
    if (AuthService.instance.role == 'collector') {
      final page = _index == 0
          ? const CollectorHomePage()
          : SettingsPage(onLoggedOut: widget.onLoggedOut);
      return Scaffold(
        body: page,
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          height: 64,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.qr_code_scanner_outlined),
              selectedIcon: Icon(Icons.qr_code_scanner),
              label: 'Round',
            ),
            NavigationDestination(
              icon: Icon(Icons.settings_outlined),
              selectedIcon: Icon(Icons.settings),
              label: 'Settings',
            ),
          ],
        ),
      );
    }

    // Four tabs, not five: Scan and Queue aren't destinations a farmer
    // navigates to as a task in their own right — Scan is an action taken
    // from Batches (where its result shows up), and Queue is sync status,
    // surfaced as a small indicator on Settings instead. Market is its own
    // tab rather than a carousel bolted onto Farm — "what buyers want" and
    // "what I have" are different questions, and Market needs room to show
    // a full delivery window and standard, not just what fits in a
    // 220px-wide card.
    final page = switch (_index) {
      0 => const FarmPage(),
      1 => const MarketPage(),
      2 => const BatchesPage(),
      _ => SettingsPage(onLoggedOut: widget.onLoggedOut),
    };

    return Scaffold(
      body: page,
      floatingActionButton: _index == 2
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const ScanPage())),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        height: 64,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.grass_outlined),
            selectedIcon: Icon(Icons.grass),
            label: 'Farm',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Market',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Batches',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

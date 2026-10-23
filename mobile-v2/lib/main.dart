import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/theme.dart';
import 'data/services.dart';
import 'data/session.dart';
import 'ui/screens/auth/auth_screens.dart';
import 'ui/screens/collector/collector_home.dart';
import 'ui/screens/farmer/farm_home.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Services.init();
  runApp(const OrigoFieldApp());
}

class OrigoFieldApp extends StatelessWidget {
  const OrigoFieldApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Origo Field',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: const _Gate(),
    );
  }
}

/// Decides what to show from the session alone, on every launch and every change:
/// signed out → sign in · fresh sign-in → PIN setup · stored login → PIN unlock · otherwise the app.
class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Services.session,
      builder: (context, _) {
        final s = Services.session;
        switch (s.stage) {
          case AuthStage.booting:
            return const Scaffold(body: Center(child: CircularProgressIndicator(color: C.leaf600)));
          case AuthStage.signedOut:
            return const SignInScreen();
          case AuthStage.pinSetup:
            return const PinSetupScreen();
          case AuthStage.locked:
            return const PinUnlockScreen();
          case AuthStage.ready:
            if (!s.roleSupported) return const WrongRoleScreen();
            return s.isCollector ? const CollectorHome() : const FarmHome();
        }
      },
    );
  }
}

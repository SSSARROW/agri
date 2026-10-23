import 'package:flutter/material.dart';

/// Origo Field design tokens. High contrast and generous targets, because this
/// app is used outdoors, in sunlight, often with wet or gloved hands.
class C {
  static const paper = Color(0xFFFAF8F3);
  static const surface = Colors.white;
  static const sunken = Color(0xFFF1EEE5);
  static const line = Color(0xFFE2DDCF);
  static const lineStrong = Color(0xFFC9C3B0);

  static const ink = Color(0xFF14231C);
  static const inkSoft = Color(0xFF3F5047);
  static const inkMute = Color(0xFF6B7A72);

  static const leaf900 = Color(0xFF0F2A21);
  static const leaf700 = Color(0xFF25563F);
  static const leaf600 = Color(0xFF2F6B4F);
  static const leaf500 = Color(0xFF3D8461);
  static const leaf100 = Color(0xFFD9EADF);
  static const leaf50 = Color(0xFFEEF5F0);

  static const bark700 = Color(0xFF7F4D17);
  static const bark600 = Color(0xFFA1631F);
  static const bark500 = Color(0xFFC07A35);
  static const bark100 = Color(0xFFF5E2CC);
  static const bark50 = Color(0xFFFBF3EA);

  static const danger = Color(0xFFB3382C);
  static const danger50 = Color(0xFFFDEFED);
  static const warn = Color(0xFF9A6C0B);
  static const warn50 = Color(0xFFFDF6E3);
  static const info = Color(0xFF2B5F8A);
  static const info50 = Color(0xFFEDF4FA);
}

class Gaps {
  static const xs = SizedBox(height: 4, width: 4);
  static const s = SizedBox(height: 8, width: 8);
  static const m = SizedBox(height: 16, width: 16);
  static const l = SizedBox(height: 24, width: 24);
  static const xl = SizedBox(height: 32, width: 32);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: C.leaf600,
    brightness: Brightness.light,
    primary: C.leaf600,
    onPrimary: Colors.white,
    secondary: C.bark600,
    surface: C.surface,
    error: C.danger,
  );
  const radius = BorderRadius.all(Radius.circular(14));
  OutlineInputBorder border(Color c, [double w = 1.2]) => OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c, width: w));

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: C.paper,
    splashFactory: InkSparkle.splashFactory,
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: C.ink, height: 1.15),
      titleLarge: TextStyle(fontSize: 21, fontWeight: FontWeight.w700, color: C.ink),
      titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: C.ink),
      bodyLarge: TextStyle(fontSize: 17, color: C.ink, height: 1.35),
      bodyMedium: TextStyle(fontSize: 15.5, color: C.inkSoft, height: 1.35),
      bodySmall: TextStyle(fontSize: 13.5, color: C.inkMute, height: 1.3),
      labelLarge: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w600),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: C.paper,
      foregroundColor: C.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: C.ink),
    ),
    cardTheme: CardThemeData(
      color: C.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: C.line)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        foregroundColor: C.ink,
        side: const BorderSide(color: C.lineStrong, width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 48), textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: const TextStyle(color: C.inkMute, fontSize: 16),
      border: border(C.lineStrong),
      enabledBorder: border(C.lineStrong),
      focusedBorder: border(C.leaf600, 2),
      errorBorder: border(C.danger),
      focusedErrorBorder: border(C.danger, 2),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: C.surface,
      indicatorColor: C.leaf100,
      height: 72,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 13, fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500, color: C.ink)),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? C.leaf700 : C.inkMute, size: 26)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: C.surface,
      selectedColor: C.leaf100,
      side: const BorderSide(color: C.lineStrong),
      labelStyle: const TextStyle(fontSize: 15, color: C.ink),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
    ),
    dividerTheme: const DividerThemeData(color: C.line, space: 1, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: C.ink,
      contentTextStyle: const TextStyle(fontSize: 15.5, color: Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dialogTheme: DialogThemeData(backgroundColor: C.surface, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: C.surface,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
  );
}

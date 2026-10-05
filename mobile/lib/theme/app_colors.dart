import 'package:flutter/material.dart';

/// Semantic colors used across the app for status and emphasis — pulled out
/// so every screen means the same shade of "danger" instead of each one
/// redefining its own 0xFFB71C1C. Hues are unchanged from what was already
/// in use (that part was already fine); this just gives them one home so
/// a page can't drift from the rest.
class AppColors {
  AppColors._();

  static const primary = Color(0xFF1B5E20);
  static const success = primary;
  static const successBg = Color(0xFFE8F5E9);
  static const warning = Color(0xFF9A6B00);
  static const warningBg = Color(0xFFFFF3E0);
  static const danger = Color(0xFFB71C1C);
  static const dangerBg = Color(0xFFFDECEA);
}

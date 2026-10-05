import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// The small label above a group of related cards — previously every page
/// dimmed Theme.titleLarge down to a subheading slightly differently
/// (different font sizes, different weights). One look everywhere now.
class SectionHeader extends StatelessWidget {
  final String text;
  const SectionHeader(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleSmall
            ?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}

enum StatusLevel { neutral, success, warning, danger }

/// A small rounded status label — same shape and type everywhere a screen
/// needs to flag something (a plot's growing environment, "No registration
/// photo on file", a batch's pipeline stage), instead of each one hand-
/// rolling its own Container + BoxDecoration + hardcoded hex colors.
class StatusPill extends StatelessWidget {
  final String text;
  final StatusLevel level;
  // Overrides the level's color — for the batch pipeline, where each stage
  // has its own hue rather than a severity level.
  final Color? color;
  final Color? background;

  const StatusPill(
    this.text, {
    super.key,
    this.level = StatusLevel.neutral,
    this.color,
    this.background,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (level) {
      StatusLevel.success => (AppColors.successBg, AppColors.success),
      StatusLevel.warning => (AppColors.warningBg, AppColors.warning),
      StatusLevel.danger => (AppColors.dangerBg, AppColors.danger),
      StatusLevel.neutral => (
        Theme.of(context).colorScheme.surfaceContainerHighest,
        Colors.black87,
      ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background ?? bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color ?? fg,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// An icon + colored text line — lighter-weight than StatusPill, for
/// checklist-style rows (photo evidence, protocol stages) where a full pill
/// per line would be too heavy.
class StatusRow extends StatelessWidget {
  final String text;
  final StatusLevel level;
  const StatusRow(this.text, {super.key, this.level = StatusLevel.neutral});

  @override
  Widget build(BuildContext context) {
    final color = switch (level) {
      StatusLevel.success => AppColors.success,
      StatusLevel.warning => AppColors.warning,
      StatusLevel.danger => AppColors.danger,
      StatusLevel.neutral => Colors.black54,
    };
    final icon = switch (level) {
      StatusLevel.success => Icons.check_circle,
      StatusLevel.warning => Icons.error_outline,
      StatusLevel.danger => Icons.error_outline,
      StatusLevel.neutral => Icons.schedule,
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text, style: TextStyle(color: color, fontSize: 13)),
        ),
      ],
    );
  }
}

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

/// A big icon in a soft tonal circle — the same icon-with-visual-weight look
/// everywhere a card or empty state needs an anchor, instead of a small
/// inline glyph. Built for a farmer scanning a list to recognize something
/// by shape and color before reading a word.
class IconCircle extends StatelessWidget {
  final IconData icon;
  final double size;
  final Color? color;
  const IconCircle(this.icon, {super.key, this.size = 44, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: c, size: size * 0.5),
    );
  }
}

/// A big-icon, friendly empty state — replaces a plain grey line of text
/// ("No plots yet.") with something recognizable at a glance before reading
/// a word, and gives an empty screen visual weight instead of just blank
/// space under the header.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconCircle(icon, size: 72),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

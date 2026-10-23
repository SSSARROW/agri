import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../data/api_client.dart';

enum Tone { good, warn, bad, info, neutral, bark }

({Color bg, Color fg}) toneColors(Tone t) => switch (t) {
      Tone.good => (bg: C.leaf50, fg: C.leaf700),
      Tone.warn => (bg: C.warn50, fg: C.warn),
      Tone.bad => (bg: C.danger50, fg: C.danger),
      Tone.info => (bg: C.info50, fg: C.info),
      Tone.bark => (bg: C.bark50, fg: C.bark700),
      Tone.neutral => (bg: C.sunken, fg: C.inkSoft),
    };

String errText(Object e) => e is ApiException ? e.message : 'Something went wrong. Please try again.';

void snack(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg)));
}

Future<bool> confirmDialog(BuildContext context, {required String title, required String body, String confirm = 'Confirm', bool danger = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title, style: Theme.of(c).textTheme.titleLarge),
      content: Text(body, style: Theme.of(c).textTheme.bodyLarge),
      actionsPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Not now')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(120, 48), backgroundColor: danger ? C.danger : null),
          onPressed: () => Navigator.pop(c, true),
          child: Text(confirm),
        ),
      ],
    ),
  );
  return r == true;
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.tone = Tone.neutral, this.icon});
  final String text;
  final Tone tone;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 15, color: c.fg), const SizedBox(width: 5)],
        Flexible(child: Text(text, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: c.fg))),
      ]),
    );
  }
}

Tone statusTone(String s) => switch (s) {
      'approved' || 'done' || 'verified' || 'ready' || 'synced' => Tone.good,
      'pending' || 'requested' || 'upcoming' || 'failed' => Tone.warn,
      'overdue' || 'rejected' || 'declined' || 'removed' || 'cannot' => Tone.bad,
      'withdrawn' || 'cancelled' => Tone.neutral,
      _ => Tone.neutral,
    };

class Section extends StatelessWidget {
  const Section(this.title, {super.key, this.action, this.children = const [], this.subtitle});
  final String title;
  final String? subtitle;
  final Widget? action;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: t.titleLarge),
              if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: t.bodySmall)),
            ]),
          ),
          if (action != null) action!,
        ]),
      ),
      ...children,
    ]);
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key, this.valueWidget});
  final String label;
  final String? value;
  final Widget? valueWidget;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 118, child: Text(label, style: t.bodySmall)),
        Expanded(child: valueWidget ?? Text((value == null || value!.isEmpty) ? '—' : value!, style: t.bodyLarge)),
      ]),
    );
  }
}

class Banner2 extends StatelessWidget {
  const Banner2({super.key, required this.tone, required this.title, this.body, this.action, this.actionLabel, this.icon});
  final Tone tone;
  final String title;
  final String? body;
  final VoidCallback? action;
  final String? actionLabel;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.fg.withValues(alpha: 0.2))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon ?? (tone == Tone.good ? Icons.check_circle_outline : tone == Tone.info ? Icons.info_outline : Icons.warning_amber_rounded), color: c.fg, size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.fg)),
            if (body != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(body!, style: TextStyle(fontSize: 14.5, color: c.fg, height: 1.35))),
            if (action != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: TextButton(
                  onPressed: action,
                  style: TextButton.styleFrom(foregroundColor: c.fg, padding: EdgeInsets.zero, minimumSize: const Size(0, 40), alignment: Alignment.centerLeft),
                  child: Text(actionLabel ?? 'Fix this'),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel({super.key, required this.icon, required this.title, this.body, this.action, this.actionLabel});
  final IconData icon;
  final String title;
  final String? body;
  final VoidCallback? action;
  final String? actionLabel;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 48, 28, 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(color: C.leaf50, shape: BoxShape.circle),
          child: Icon(icon, size: 34, color: C.leaf600),
        ),
        Gaps.m,
        Text(title, style: t.titleLarge, textAlign: TextAlign.center),
        if (body != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(body!, style: t.bodyMedium, textAlign: TextAlign.center)),
        if (action != null) ...[Gaps.l, FilledButton(onPressed: action, child: Text(actionLabel ?? 'Continue'))],
      ]),
    );
  }
}

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.cloud_off_rounded, size: 44, color: C.danger),
        Gaps.m,
        Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
        if (onRetry != null) ...[Gaps.m, OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again'))],
      ]),
    );
  }
}

/// Loads once, shows spinner / error-with-retry / content, and offers pull-to-refresh.
/// A load failure never looks like "you have nothing".
class AsyncView<T> extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder, this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 32)});
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;
  final EdgeInsets padding;
  @override
  State<AsyncView<T>> createState() => _AsyncViewState<T>();
}

class _AsyncViewState<T> extends State<AsyncView<T>> {
  T? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    if (mounted) setState(() => _loading = _data == null);
    try {
      final d = await widget.load();
      if (!mounted) return;
      setState(() {
        _data = d;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errText(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: C.leaf600));
    if (_data == null) {
      return ListView(children: [SizedBox(height: 120), ErrorPanel(message: _error ?? 'Could not load.', onRetry: _run)]);
    }
    return RefreshIndicator(
      color: C.leaf600,
      onRefresh: _run,
      child: ListView(
        padding: widget.padding,
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (_error != null)
            Padding(padding: const EdgeInsets.only(bottom: 12), child: Banner2(tone: Tone.warn, title: 'Showing saved results', body: _error, action: _run, actionLabel: 'Refresh')),
          widget.builder(context, _data as T, _run),
        ],
      ),
    );
  }
}

class Tappable extends StatelessWidget {
  const Tappable({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

class BusyButton extends StatelessWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.busy = false, this.icon, this.outlined = false, this.danger = false});
  final String label;
  final VoidCallback? onPressed;
  final bool busy, outlined, danger;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white))
        : Row(mainAxisSize: MainAxisSize.min, children: [if (icon != null) ...[Icon(icon, size: 22), const SizedBox(width: 10)], Flexible(child: Text(label, textAlign: TextAlign.center))]);
    if (outlined) {
      return OutlinedButton(onPressed: busy ? null : onPressed, child: busy ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 3)) : child);
    }
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: danger ? FilledButton.styleFrom(backgroundColor: C.danger) : null,
      child: child,
    );
  }
}

/// A big, thumb-friendly choice row used instead of tiny dropdowns.
class ChoiceTile extends StatelessWidget {
  const ChoiceTile({super.key, required this.title, this.subtitle, required this.selected, required this.onTap, this.leading});
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;
  final Widget? leading;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? C.leaf50 : C.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? C.leaf600 : C.lineStrong, width: selected ? 2 : 1.2),
        ),
        child: Row(children: [
          if (leading != null) ...[leading!, const SizedBox(width: 12)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: Theme.of(context).textTheme.bodySmall)),
            ]),
          ),
          Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: selected ? C.leaf600 : C.lineStrong),
        ]),
      ),
    );
  }
}

/// A thumbnail that says what is happening: a spinner while it loads, a tap-to-retry tile if it fails.
/// Decodes at thumbnail size, so large field photos don't exhaust memory on low-end phones.
class NetPhoto extends StatefulWidget {
  const NetPhoto(this.url, {super.key, this.size = 88, this.onTap, this.flagged = false});
  final String url;
  final double size;
  final VoidCallback? onTap;
  final bool flagged;
  @override
  State<NetPhoto> createState() => _NetPhotoState();
}

class _NetPhotoState extends State<NetPhoto> {
  int _attempt = 0;

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final px = (size * MediaQuery.devicePixelRatioOf(context)).round();
    final tile = ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        widget.url,
        key: ValueKey('${widget.url}#$_attempt'),
        width: size,
        height: size,
        fit: BoxFit.cover,
        cacheWidth: px,
        gaplessPlayback: true,
        loadingBuilder: (c, child, p) => p == null
            ? child
            : Container(width: size, height: size, color: C.sunken, alignment: Alignment.center, child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: C.leaf600, value: p.expectedTotalBytes == null ? null : p.cumulativeBytesLoaded / p.expectedTotalBytes!))),
        errorBuilder: (c, e, _) => GestureDetector(
          onTap: () => setState(() => _attempt++),
          child: Container(
            width: size,
            height: size,
            color: C.sunken,
            padding: const EdgeInsets.all(6),
            alignment: Alignment.center,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.image_not_supported_outlined, color: C.inkMute),
              if (size >= 80) const Text('Tap to retry', textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: C.inkMute)),
            ]),
          ),
        ),
      ),
    );
    return GestureDetector(
      onTap: widget.onTap ?? () => showPhoto(context, widget.url),
      child: Stack(children: [
        tile,
        if (widget.flagged) const Positioned(right: 4, top: 4, child: CircleAvatar(radius: 11, backgroundColor: C.warn, child: Icon(Icons.location_off, size: 14, color: Colors.white))),
      ]),
    );
  }
}

void showPhoto(BuildContext context, String url, {String? caption}) {
  showDialog(
    context: context,
    builder: (c) => Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: Stack(children: [
        Center(child: InteractiveViewer(child: Image.network(url, fit: BoxFit.contain, loadingBuilder: (c, child, p) => p == null ? child : const Center(child: CircularProgressIndicator(color: Colors.white)), errorBuilder: (_, _, _) => const Column(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.broken_image_outlined, color: Colors.white54, size: 64), SizedBox(height: 8), Text('This photo could not be loaded. Check your connection.', style: TextStyle(color: Colors.white70))])))),
        Positioned(top: 8, right: 8, child: SafeArea(child: IconButton(onPressed: () => Navigator.pop(c), icon: const Icon(Icons.close, color: Colors.white, size: 30)))),
        if (caption != null) Positioned(left: 16, right: 16, bottom: 24, child: SafeArea(child: Text(caption, style: const TextStyle(color: Colors.white, fontSize: 16)))),
      ]),
    ),
  );
}

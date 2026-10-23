import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'common.dart';

/// A self-contained loader for one section of a page, so one failing call
/// shows its own message and retry without hiding the rest.
class LoadSection<T> extends StatefulWidget {
  const LoadSection({super.key, required this.load, required this.builder, this.sessionHint = true});
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, VoidCallback reload) builder;
  final bool sessionHint;
  @override
  State<LoadSection<T>> createState() => LoadSectionState<T>();
}

class LoadSectionState<T> extends State<LoadSection<T>> {
  late Future<T> _f = widget.load();
  void reload() => setState(() => _f = widget.load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: _f,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 3, color: C.leaf600))));
        }
        if (snap.hasError) {
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: C.danger50, borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              const Icon(Icons.cloud_off, color: C.danger),
              Gaps.s,
              Expanded(child: Text(errText(snap.error!), style: const TextStyle(color: C.danger, fontSize: 15))),
              TextButton(onPressed: reload, child: const Text('Retry')),
            ]),
          );
        }
        return widget.builder(context, snap.data as T, reload);
      },
    );
  }
}

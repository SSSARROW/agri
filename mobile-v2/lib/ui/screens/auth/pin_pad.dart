import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme.dart';

/// Four dots and a big numeric keypad that works with gloves and sunlight.
class PinPad extends StatefulWidget {
  const PinPad({super.key, required this.onComplete, this.enabled = true});
  final Future<void> Function(String pin) onComplete;
  final bool enabled;
  @override
  State<PinPad> createState() => PinPadState();
}

class PinPadState extends State<PinPad> {
  String _pin = '';
  bool _busy = false;

  void clear() => setState(() => _pin = '');

  Future<void> _tap(String d) async {
    if (!widget.enabled || _busy || _pin.length >= 4) {
      return;
    }
    HapticFeedback.selectionClick();
    setState(() => _pin += d);
    if (_pin.length == 4) {
      _busy = true;
      await widget.onComplete(_pin);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _pin = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget key(String label, {VoidCallback? onTap, IconData? icon}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: SizedBox(
              height: 68,
              child: Material(
                color: label.isEmpty && icon == null ? Colors.transparent : C.surface,
                borderRadius: BorderRadius.circular(18),
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: (label.isEmpty && icon == null) ? null : (onTap ?? () => _tap(label)),
                  child: Center(child: icon != null ? Icon(icon, size: 26, color: C.inkSoft) : Text(label, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: C.ink))),
                ),
              ),
            ),
          ),
        );

    return Column(mainAxisSize: MainAxisSize.min, children: [
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (var i = 0; i < 4; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            margin: const EdgeInsets.symmetric(horizontal: 10),
            width: 20,
            height: 20,
            decoration: BoxDecoration(shape: BoxShape.circle, color: i < _pin.length ? C.leaf600 : Colors.transparent, border: Border.all(color: i < _pin.length ? C.leaf600 : C.lineStrong, width: 2)),
          ),
      ]),
      const SizedBox(height: 28),
      for (final row in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]) Row(children: [for (final d in row) key(d)]),
      Row(children: [
        key(''),
        key('0'),
        key('', icon: Icons.backspace_outlined, onTap: () => setState(() => _pin = _pin.isEmpty ? '' : _pin.substring(0, _pin.length - 1))),
      ]),
    ]);
  }
}

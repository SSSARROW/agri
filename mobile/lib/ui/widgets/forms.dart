import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';

/// A large tappable field that opens a searchable bottom sheet. Replaces tiny dropdowns.
class PickerField extends StatelessWidget {
  const PickerField({super.key, required this.label, required this.value, required this.options, required this.onChanged, this.error, this.hint});
  final String label;
  final String? value, error, hint;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () async {
        final r = await showModalBottomSheet<String>(
          context: context,
          isScrollControlled: true,
          builder: (_) => _PickerSheet(title: label, options: options, selected: value),
        );
        if (r != null) onChanged(r);
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, errorText: error, helperText: hint, suffixIcon: const Icon(Icons.keyboard_arrow_down_rounded)),
        isEmpty: value == null || value!.isEmpty,
        child: Text(value ?? '', style: Theme.of(context).textTheme.bodyLarge),
      ),
    );
  }
}

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({required this.title, required this.options, this.selected});
  final String title;
  final List<String> options;
  final String? selected;
  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String q = '';
  @override
  Widget build(BuildContext context) {
    final shown = widget.options.where((o) => o.toLowerCase().contains(q.toLowerCase())).toList();
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.7,
          child: Column(children: [
            Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Align(alignment: Alignment.centerLeft, child: Text(widget.title, style: Theme.of(context).textTheme.titleLarge))),
            if (widget.options.length > 8)
              Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 8), child: TextField(decoration: const InputDecoration(hintText: 'Search', prefixIcon: Icon(Icons.search)), onChanged: (v) => setState(() => q = v))),
            Expanded(
              child: ListView.builder(
                itemCount: shown.length,
                itemBuilder: (_, i) => ListTile(
                  minVerticalPadding: 14,
                  title: Text(shown[i], style: Theme.of(context).textTheme.bodyLarge),
                  trailing: shown[i] == widget.selected ? const Icon(Icons.check_circle, color: C.leaf600) : null,
                  onTap: () => Navigator.pop(context, shown[i]),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class DistrictField extends StatelessWidget {
  const DistrictField({super.key, required this.value, required this.onChanged, this.error});
  final String? value, error;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => PickerField(label: 'District', value: value, options: districts, onChanged: onChanged, error: error);
}

/// Tea / Cinnamon / Pepper / Other (free text). Reports the effective crop name.
class CropPicker extends StatefulWidget {
  const CropPicker({super.key, required this.onChanged, this.initial = 'Tea'});
  final ValueChanged<String> onChanged;
  final String initial;
  @override
  State<CropPicker> createState() => _CropPickerState();
}

class _CropPickerState extends State<CropPicker> {
  late String _sel = knownCrops.where((c) => c.toLowerCase() == widget.initial.toLowerCase()).firstOrNull ?? 'Other';
  final _other = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (_sel == 'Other') _other.text = widget.initial == 'Other' ? '' : widget.initial;
  }

  void _emit() => widget.onChanged(_sel == 'Other' ? _other.text.trim() : _sel);

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Crop', style: Theme.of(context).textTheme.titleMedium),
      Gaps.s,
      Wrap(spacing: 10, runSpacing: 10, children: [
        for (final c in [...knownCrops, 'Other'])
          ChoiceChip(
            label: Text(c, style: const TextStyle(fontSize: 16)),
            selected: _sel == c,
            showCheckmark: false,
            onSelected: (_) {
              setState(() => _sel = c);
              _emit();
            },
          ),
      ]),
      if (_sel == 'Other') ...[
        Gaps.s,
        TextField(controller: _other, decoration: const InputDecoration(labelText: 'Which crop?'), textCapitalization: TextCapitalization.words, onChanged: (_) => _emit()),
      ],
    ]);
  }
}

final decimalOnly = [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))];

/// Parses a decimal the way people type it: tolerates a stray trailing dot and commas.
double? parseNum(String s) => double.tryParse(s.trim().replaceAll(',', '').replaceFirst(RegExp(r'\.$'), ''));

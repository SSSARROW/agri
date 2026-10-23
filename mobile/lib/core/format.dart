const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

DateTime? parseDate(dynamic v) {
  if (v == null) return null;
  return DateTime.tryParse(v.toString())?.toLocal();
}

String fmtDate(dynamic v) {
  final d = v is DateTime ? v.toLocal() : parseDate(v);
  if (d == null) return '—';
  return '${d.day} ${_months[d.month - 1]} ${d.year}';
}

String fmtDateTime(dynamic v) {
  final d = v is DateTime ? v.toLocal() : parseDate(v);
  if (d == null) return '—';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final m = d.minute.toString().padLeft(2, '0');
  return '${d.day} ${_months[d.month - 1]} ${d.year}, $h:$m ${d.hour >= 12 ? 'pm' : 'am'}';
}

/// "2026-11-01" → "November 2026"
String fmtMonth(String? v) {
  if (v == null || v.length < 7) return '—';
  final y = v.substring(0, 4);
  final m = int.tryParse(v.substring(5, 7));
  if (m == null || m < 1 || m > 12) return '—';
  return '${_monthsLong[m - 1]} $y';
}

String fmtKg(num? n) {
  if (n == null) return '—';
  final s = n == n.roundToDouble() ? n.toStringAsFixed(0) : n.toStringAsFixed(1);
  return '${_group(s)} kg';
}

String fmtLkr(num? n) {
  if (n == null) return '—';
  final s = n == n.roundToDouble() ? n.toStringAsFixed(0) : n.toStringAsFixed(2);
  return 'LKR ${_group(s)}';
}

String _group(String s) {
  final parts = s.split('.');
  final whole = parts[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
  return parts.length > 1 ? '$whole.${parts[1]}' : whole;
}

/// Areas under 0.01 ha read better in square metres.
String fmtHa(num? ha) {
  if (ha == null) return '—';
  if (ha < 0.01) return '${(ha * 10000).round()} m²';
  return '${ha.toStringAsFixed(ha < 1 ? 3 : 2).replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '')} ha';
}

String ago(dynamic v) {
  final d = v is DateTime ? v : parseDate(v);
  if (d == null) return '';
  final days = DateTime.now().difference(d).inDays;
  if (days <= 0) return 'today';
  if (days == 1) return '1 day ago';
  return '$days days ago';
}

String titleCase(String s) => s.replaceAll(RegExp(r'[_-]+'), ' ').split(' ').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1)).join(' ');

String cropLabel(String c) => titleCase(c);

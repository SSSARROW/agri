import 'package:flutter_test/flutter_test.dart';
import 'package:origo_field/core/format.dart';
import 'package:origo_field/core/geo.dart';
import 'package:origo_field/data/models.dart';
import 'package:origo_field/ui/screens/farmer/scanner.dart';
import 'package:origo_field/ui/widgets/forms.dart';

void main() {
  group('polygonAreaHa', () {
    test('a 100 m x 100 m square is about 1 ha', () {
      // ~0.0009 degrees is ~100 m near the equator
      const d = 0.000898;
      final sq = [const LatLon(7, 80), const LatLon(7, 80 + d), const LatLon(7 + d, 80 + d), const LatLon(7 + d, 80)];
      expect(polygonAreaHa(sq), closeTo(1.0, 0.05));
    });
    test('fewer than 3 points has no area', () {
      expect(polygonAreaHa([const LatLon(7, 80), const LatLon(7.1, 80)]), 0);
    });
    test('pins at one spot are detected as "did not walk"', () {
      final pts = [const LatLon(7, 80), const LatLon(7.0000001, 80), const LatLon(7, 80.0000001)];
      expect(maxSpreadM(pts), lessThan(3));
    });
  });

  group('input parsing', () {
    test('parseNum tolerates commas and a stray dot', () {
      expect(parseNum('1,250.5'), 1250.5);
      expect(parseNum('42.'), 42);
      expect(parseNum('1.2.3'), isNull);
      expect(parseNum(''), isNull);
    });
    test('codeFromScan takes the last path segment of a QR address', () {
      expect(codeFromScan('https://api.example.com/p/7kq2-m9xd'), '7KQ2-M9XD');
      expect(codeFromScan('  abc123 '), 'ABC123');
    });
  });

  group('formatting', () {
    test('areas under 0.01 ha show in square metres', () {
      expect(fmtHa(0.005), '50 m²');
      expect(fmtHa(0.4), '0.4 ha');
    });
    test('kg and months', () {
      expect(fmtKg(1250), '1,250 kg');
      expect(fmtKg(42.5), '42.5 kg');
      expect(fmtMonth('2026-11-01'), 'November 2026');
    });
  });

  group('models', () {
    test('batch journey groups the latest status', () {
      Batch b(String s) => Batch.fromJson({'id': '1', 'code': 'X', 'crop': 'Tea', 'latest_status': s, 'created_at': '2026-01-01T00:00:00Z'});
      expect(b('collect').journey, 'Collected');
      expect(b('grade').journey, 'Processing');
      expect(b('pack').journey, 'Packed');
      expect(b('mystery').journey, 'Other');
    });
    test('pickText falls back to English then anything', () {
      expect(pickText({'en': 'Hello', 'si': ''}, lang: 'si'), 'Hello');
      expect(pickText({'en': '', 'ta': 'வணக்கம்'}), 'வணக்கம்');
    });
    test('notice replies lock once the target month starts', () {
      NoticeDetail n(String m) => NoticeDetail.fromJson({'id': '1', 'target_month': m, 'stages': []});
      expect(n('2020-01-01').locked, isTrue);
      expect(n('2999-01-01').locked, isFalse);
    });
  });
}

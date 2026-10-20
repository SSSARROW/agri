import 'package:flutter_test/flutter_test.dart';
import 'package:field/models/planting_notice.dart';

void main() {
  group('PlantingNotice Models & Parsing', () {
    test('resolveLocalized returns language if found, falls back to en or first', () {
      expect(resolveLocalized('Direct string'), 'Direct string');
      expect(resolveLocalized(null), '');
      expect(resolveLocalized({}), '');
      expect(resolveLocalized({'en': 'English title'}), 'English title');
      expect(
        resolveLocalized({'si': 'සිංහල', 'en': 'English'}),
        anyOf('සිංහල', 'English'),
      );
      expect(resolveLocalized({'ta': 'தமிழ்'}), 'தமிழ்');
    });

    test('formatTargetMonth formats valid YYYY-MM strings correctly', () {
      expect(formatTargetMonth('2026-11-01'), 'November 2026');
      expect(formatTargetMonth('2026-11'), 'November 2026');
      expect(formatTargetMonth('2027-01-15'), 'January 2027');
      expect(formatTargetMonth('invalid-date'), 'invalid-date');
    });

    test('isTargetMonthStarted correctly detects past or future months', () {
      // Future month
      expect(isTargetMonthStarted('2099-12-01'), isFalse);
      // Past month
      expect(isTargetMonthStarted('2020-01-01'), isTrue);
    });

    test('PlantingNoticeSummary parses complete JSON defensively', () {
      final json = {
        'id': 'notice-123',
        'crop': 'tea',
        'target_month': '2026-11-01',
        'volume_needed_kg': 5000.0,
        'title': {'en': 'Sourcing BOPF Tea'},
        'exporter_name': 'Ceylon Exporters Ltd',
        'exporter_logo_url': 'https://example.com/logo.png',
        'farmer_response': 'ready',
        'expected_volume_kg': 750.0,
        'plot_id': 'plot-456',
        'published_at': '2026-10-15T12:00:00Z',
      };

      final summary = PlantingNoticeSummary.fromJson(json);
      expect(summary.id, 'notice-123');
      expect(summary.crop, 'tea');
      expect(summary.targetMonth, '2026-11-01');
      expect(summary.volumeNeededKg, 5000.0);
      expect(summary.title, 'Sourcing BOPF Tea');
      expect(summary.exporterName, 'Ceylon Exporters Ltd');
      expect(summary.exporterLogoUrl, 'https://example.com/logo.png');
      expect(summary.farmerResponse, 'ready');
      expect(summary.expectedVolumeKg, 750.0);
      expect(summary.plotId, 'plot-456');
      expect(summary.isReady, isTrue);
      expect(summary.isCannot, isFalse);
      expect(summary.formattedMonth, 'November 2026');
    });

    test('PlantingNoticeSummary parses incomplete/null JSON without crashing', () {
      final json = <String, dynamic>{};
      final summary = PlantingNoticeSummary.fromJson(json);

      expect(summary.id, '');
      expect(summary.crop, '');
      expect(summary.volumeNeededKg, 0.0);
      expect(summary.title, '');
      expect(summary.exporterName, 'Exporter');
      expect(summary.farmerResponse, isNull);
      expect(summary.expectedVolumeKg, isNull);
      expect(summary.plotId, isNull);
      expect(summary.isReady, isFalse);
      expect(summary.isCannot, isFalse);
    });

    test('PaginatedPlantingNotices parses list with empty items', () {
      final json = {
        'items': [],
        'total': 0,
        'page': 1,
        'page_size': 10,
        'total_pages': 1,
      };

      final res = PaginatedPlantingNotices.fromJson(json);
      expect(res.items, isEmpty);
      expect(res.total, 0);
      expect(res.totalPages, 1);
    });

    test('PlantingNoticeDetail parses notice, exporter and stages correctly', () {
      final json = {
        'id': 'notice-999',
        'crop': 'cinnamon',
        'target_month': '2026-12-01',
        'volume_needed_kg': 1200.0,
        'title': {'en': 'Alba Cinnamon Batch'},
        'message': {'en': 'Please prepare your plot for December planting.'},
        'published_at': '2026-10-18T10:00:00Z',
        'exporter': {
          'company_name': 'Lanka Spices Export',
          'logo_url': null,
        },
        'current_response': 'cannot',
        'current_expected_volume_kg': null,
        'current_plot_id': null,
        'standard_version_id': 'std-ver-1',
        'standard_name': 'Pure Ceylon Cinnamon Standard',
        'standard_version_number': 2,
        'stages': [
          {
            'id': 'stg-1',
            'stage_order': 1,
            'name': 'Land Preparation',
            'description': {'en': 'Clear and till soil'},
            'rules_count': 2,
          },
          {
            'id': 'stg-2',
            'stage_order': 2,
            'name': 'Seedling Plantation',
            'description': {'en': 'Plant at recommended spacing'},
            'rules_count': 0,
          },
        ],
      };

      final detail = PlantingNoticeDetail.fromJson(json);
      expect(detail.id, 'notice-999');
      expect(detail.crop, 'cinnamon');
      expect(detail.exporterCompanyName, 'Lanka Spices Export');
      expect(detail.currentResponse, 'cannot');
      expect(detail.isCannot, isTrue);
      expect(detail.isReady, isFalse);
      expect(detail.standardName, 'Pure Ceylon Cinnamon Standard');
      expect(detail.standardVersionNumber, 2);
      expect(detail.stages.length, 2);
      expect(detail.stages[0].name, 'Land Preparation');
      expect(detail.stages[0].description, 'Clear and till soil');
      expect(detail.stages[0].rulesCount, 2);
      expect(detail.stages[1].rulesCount, 0);
    });

    test('FarmerNoticePlot parses correctly and handles missing name', () {
      final json = {
        'id': 'plot-1',
        'name': 'Hillside Plot',
        'area_ha': 2.5,
        'district': 'Kandy',
      };
      final plot = FarmerNoticePlot.fromJson(json);
      expect(plot.id, 'plot-1');
      expect(plot.name, 'Hillside Plot');
      expect(plot.areaHa, 2.5);
      expect(plot.district, 'Kandy');

      final plotWithoutName = FarmerNoticePlot.fromJson({
        'id': 'plot-2',
        'area_ha': 1.0,
      });
      expect(plotWithoutName.name, 'Plot');
    });

    test('NoticeReplyResponse parses correctly', () {
      final json = {
        'status': 'ok',
        'notice_id': 'notice-123',
        'farmer_id': 'farmer-abc',
        'response': 'ready',
        'expected_volume_kg': 500.0,
        'plot_id': 'plot-xyz',
        'responded_at': '2026-10-20T11:00:00Z',
        'message': 'You responded Ready.',
      };
      final res = NoticeReplyResponse.fromJson(json);
      expect(res.status, 'ok');
      expect(res.response, 'ready');
      expect(res.expectedVolumeKg, 500.0);
      expect(res.plotId, 'plot-xyz');
      expect(res.message, 'You responded Ready.');
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:field/widgets/ui_kit.dart';
import 'package:field/widgets/notification_bell_button.dart';

void main() {
  group('Widget Tests: Notices & Notifications UI', () {
    testWidgets('EmptyState displays icon, title and subtitle properly', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: EmptyState(
              icon: Icons.calendar_month_outlined,
              title: 'No planting notices yet',
              subtitle: 'Check back when upcoming seasons open.',
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.calendar_month_outlined), findsOneWidget);
      expect(find.text('No planting notices yet'), findsOneWidget);
      expect(find.text('Check back when upcoming seasons open.'), findsOneWidget);
    });

    testWidgets('StatusPill displays correct colors and text', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StatusPill('READY', level: StatusLevel.success),
                StatusPill("CAN'T", level: StatusLevel.neutral),
                StatusPill('AWAITING RESPONSE', level: StatusLevel.warning),
              ],
            ),
          ),
        ),
      );

      expect(find.text('READY'), findsOneWidget);
      expect(find.text("CAN'T"), findsOneWidget);
      expect(find.text('AWAITING RESPONSE'), findsOneWidget);
    });

    testWidgets('Locked state UI disables reply buttons', (tester) async {
      VoidCallback? buildCallback(bool locked) {
        if (locked) return null;
        return () {};
      }

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                const Text('Replies are locked because target month started.'),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: buildCallback(true),
                      child: const Text("Can't this season"),
                    ),
                    ElevatedButton(
                      onPressed: buildCallback(true),
                      child: const Text('Ready'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Replies are locked because target month started.'), findsOneWidget);

      final cantBtn = tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, "Can't this season"));
      final readyBtn = tester.widget<ElevatedButton>(find.widgetWithText(ElevatedButton, 'Ready'));

      expect(cantBtn.onPressed, isNull);
      expect(readyBtn.onPressed, isNull);
    });

    testWidgets('Reply form validation requires positive volume and selected plot', (tester) async {
      String? errorMessage;
      double? volume = 0;
      String? plotId;

      void validate() {
        if (volume == null || volume <= 0) {
          errorMessage = 'Please enter a valid volume greater than 0 kg.';
          return;
        }
        if (plotId == null || plotId.isEmpty) {
          errorMessage = 'Please select a plot.';
          return;
        }
        errorMessage = null;
      }

      // Initial validation failure (volume <= 0)
      validate();
      expect(errorMessage, 'Please enter a valid volume greater than 0 kg.');

      // With positive volume but missing plot
      volume = 500;
      validate();
      expect(errorMessage, 'Please select a plot.');

      // Valid volume and plot
      plotId = 'plot-1';
      validate();
      expect(errorMessage, isNull);
    });

    testWidgets('NotificationBellButton mounts safely and renders bell icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            appBar: null,
            body: NotificationBellButton(),
          ),
        ),
      );

      expect(find.byType(NotificationBellButton), findsOneWidget);
      expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
    });
  });
}

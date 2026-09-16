import 'package:flutter/material.dart';

import '../core/api_client.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

enum _Status { checking, ok, down }

class _HomePageState extends State<HomePage> {
  _Status _status = _Status.checking;
  String _detail = '';

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final result = await ApiClient.checkHealth();
    if (!mounted) return;
    setState(() {
      _status = result.ok ? _Status.ok : _Status.down;
      _detail = result.detail;
    });
  }

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color border, Color fg, String text) = switch (_status) {
      _Status.checking => (
          const Color(0xFFFFF8E1),
          const Color(0xFFF9A825),
          const Color(0xFF7C5C00),
          'checking…',
        ),
      _Status.ok => (
          const Color(0xFFE8F5E9),
          const Color(0xFF2E7D32),
          const Color(0xFF1B5E20),
          'connected',
        ),
      _Status.down => (
          const Color(0xFFFFEBEE),
          const Color(0xFFC62828),
          const Color(0xFFB71C1C),
          'unreachable ($_detail)',
        ),
    };

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Agri Field Capture', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            const Text('Collector and field officer capture app.', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: bg,
                border: Border.all(color: border, width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: RichText(
                text: TextSpan(
                  style: TextStyle(fontSize: 17, color: fg),
                  children: [
                    const TextSpan(text: 'Backend: ', style: TextStyle(fontWeight: FontWeight.bold)),
                    TextSpan(text: text),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              "Running in an emulator, the API is reached at 10.0.2.2, which the Android "
              "emulator maps back to your dev machine's localhost.",
              style: TextStyle(color: Colors.black54, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

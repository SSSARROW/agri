import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/auth_service.dart';

/// Shown once, right after a network login/signup succeeds (M-07). The PIN
/// is what lets the farmer reopen the app on later days without needing a
/// live connection — logging in with email/password again always requires
/// one, since only the server can issue a fresh token.
class PinSetupPage extends StatefulWidget {
  final VoidCallback onDone;
  const PinSetupPage({super.key, required this.onDone});

  @override
  State<PinSetupPage> createState() => _PinSetupPageState();
}

class _PinSetupPageState extends State<PinSetupPage> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;

  Future<void> _save() async {
    final pin = _pinController.text;
    if (pin.length != 4) {
      setState(() => _error = 'Enter a 4-digit PIN.');
      return;
    }
    if (pin != _confirmController.text) {
      setState(() => _error = 'PINs do not match.');
      return;
    }
    await AuthService.instance.setPin(pin);
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Set a PIN', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 4),
              const Text(
                "You'll use this to open the app on days you have no signal — "
                "no need to log in with email again.",
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 28, letterSpacing: 12),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(counterText: '', labelText: '4-digit PIN'),
              ),
              TextField(
                controller: _confirmController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 28, letterSpacing: 12),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(counterText: '', labelText: 'Confirm PIN'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C)), textAlign: TextAlign.center),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B5E20),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _save,
                child: const Text('Set PIN', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: widget.onDone,
                child: const Text('Skip for now'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

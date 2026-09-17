import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/auth_service.dart';

/// The daily unlock screen (M-07) — no network involved. This is what makes
/// the app usable for a farmer with no signal for days: the stored token
/// might be long expired, but the PIN only proves it's still the same
/// person opening the same device, which is enough to keep capturing data
/// offline until a connection lets the queue sync and the token refresh.
class PinUnlockPage extends StatefulWidget {
  final VoidCallback onUnlocked;
  final VoidCallback onUseEmailInstead;
  const PinUnlockPage({super.key, required this.onUnlocked, required this.onUseEmailInstead});

  @override
  State<PinUnlockPage> createState() => _PinUnlockPageState();
}

class _PinUnlockPageState extends State<PinUnlockPage> {
  final _pinController = TextEditingController();
  String? _error;

  void _submit() {
    if (AuthService.instance.verifyPin(_pinController.text)) {
      widget.onUnlocked();
    } else {
      setState(() => _error = 'Incorrect PIN.');
      _pinController.clear();
    }
  }

  Future<void> _useEmailInstead() async {
    await AuthService.instance.logout();
    widget.onUseEmailInstead();
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
              Text('Welcome back', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 4),
              const Text('Enter your PIN to continue.', style: TextStyle(color: Colors.black54)),
              const SizedBox(height: 32),
              TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                autofocus: true,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 28, letterSpacing: 12),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(counterText: '', labelText: 'PIN'),
                onSubmitted: (_) => _submit(),
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
                onPressed: _submit,
                child: const Text('Unlock', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _useEmailInstead,
                child: const Text('Forgot PIN? Log in with email instead'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

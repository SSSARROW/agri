import 'package:flutter/material.dart';

import '../core/auth_service.dart';

class CollectorSignupPage extends StatefulWidget {
  final VoidCallback onSignedUp;
  const CollectorSignupPage({super.key, required this.onSignedUp});

  @override
  State<CollectorSignupPage> createState() => _CollectorSignupPageState();
}

class _CollectorSignupPageState extends State<CollectorSignupPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _phone = TextEditingController();
  final _nic = TextEditingController();
  final _district = TextEditingController(text: 'Nuwara Eliya');
  final _dsd = TextEditingController(text: 'Nuwara Eliya DSD');
  final _gnDivision = TextEditingController(text: 'Kandapola');

  bool _loading = false;
  String? _error;

  InputDecoration _dec(String label) =>
      InputDecoration(labelText: label, border: const OutlineInputBorder());

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await AuthService.instance.signupCollector(
      email: _email.text.trim(),
      password: _password.text,
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      nic: _nic.text.trim(),
      district: _district.text.trim(),
      dsd: _dsd.text.trim(),
      gnDivision: _gnDivision.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);
    if (result.ok) {
      widget.onSignedUp();
      Navigator.of(context).pop();
    } else {
      setState(() => _error = result.error ?? 'Signup failed');
    }
  }

  String? _required(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Collector sign up')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                'For collectors who buy leaf from multiple farmers and combine it into batches at a collection point.',
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: _dec('Full name'),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                decoration: _dec('Email'),
                keyboardType: TextInputType.emailAddress,
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                decoration: _dec('Password'),
                obscureText: true,
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: _dec('Phone'),
                keyboardType: TextInputType.phone,
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nic,
                decoration: _dec('NIC'),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _district,
                decoration: _dec('Operating district'),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dsd,
                decoration: _dec('DSD'),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _gnDivision,
                decoration: _dec('GN Division'),
                validator: _required,
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C))),
              ],
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B5E20),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Create account',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

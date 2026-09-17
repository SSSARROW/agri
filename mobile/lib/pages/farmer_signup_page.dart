import 'package:flutter/material.dart';

import '../core/auth_service.dart';

class FarmerSignupPage extends StatefulWidget {
  final VoidCallback onSignedUp;
  const FarmerSignupPage({super.key, required this.onSignedUp});

  @override
  State<FarmerSignupPage> createState() => _FarmerSignupPageState();
}

class _FarmerSignupPageState extends State<FarmerSignupPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _phone = TextEditingController();
  final _nic = TextEditingController();
  final _district = TextEditingController(text: 'Nuwara Eliya');
  final _dsd = TextEditingController(text: 'Nuwara Eliya DSD');
  final _gnDivision = TextEditingController(text: 'Kandapola');
  final _farmAddress = TextEditingController();
  final _farmSizeHa = TextEditingController(text: '0.5');

  bool _loading = false;
  String? _error;

  InputDecoration _dec(String label) => InputDecoration(labelText: label, border: const OutlineInputBorder());

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await AuthService.instance.signupFarmer(
      email: _email.text.trim(),
      password: _password.text,
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      nic: _nic.text.trim(),
      district: _district.text.trim(),
      dsd: _dsd.text.trim(),
      gnDivision: _gnDivision.text.trim(),
      farmAddress: _farmAddress.text.trim(),
      farmSizeHa: double.tryParse(_farmSizeHa.text.trim()) ?? 0,
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

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Farmer sign up')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              TextFormField(controller: _name, decoration: _dec('Full name'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                decoration: _dec('Email'),
                keyboardType: TextInputType.emailAddress,
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(controller: _password, decoration: _dec('Password'), obscureText: true, validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: _phone, decoration: _dec('Phone'), keyboardType: TextInputType.phone, validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: _nic, decoration: _dec('NIC'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: _district, decoration: _dec('District'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: _dsd, decoration: _dec('DSD'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: _gnDivision, decoration: _dec('GN Division'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(controller: _farmAddress, decoration: _dec('Farm address'), validator: _required),
              const SizedBox(height: 12),
              TextFormField(
                controller: _farmSizeHa,
                decoration: _dec('Farm size (hectares)'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Create account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

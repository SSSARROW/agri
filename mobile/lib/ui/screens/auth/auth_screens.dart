import 'package:flutter/material.dart';

import '../../../core/theme.dart';
import '../../../data/services.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'pin_pad.dart';

class _Brand extends StatelessWidget {
  const _Brand();
  final bool dark = false;
  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: dark ? Colors.white : C.leaf600, borderRadius: BorderRadius.circular(12)),
        child: Icon(Icons.eco_rounded, color: dark ? C.leaf600 : Colors.white, size: 24),
      ),
      const SizedBox(width: 10),
      Text('origo', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: dark ? Colors.white : C.leaf900)),
    ]);
  }
}

/* ── Sign in ──────────────────────────────────────────────────────────────── */

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController(text: Services.session.lastEmail ?? '');
  final _pw = TextEditingController();
  bool _busy = false, _show = false;
  String? _error;

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _pw.text.isEmpty) {
      setState(() => _error = 'Enter your email and password.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await Services.repo.login(_email.text.trim(), _pw.text);
      await Services.session.signedIn(accessToken: r.token, role: r.role, email: _email.text.trim());
    } catch (e) {
      if (mounted) setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          Gaps.l,
          const Align(alignment: Alignment.centerLeft, child: _Brand()),
          Gaps.xl,
          Text('Welcome back', style: t.headlineMedium),
          Gaps.s,
          Text('Sign in to record your fields, harvests and orders.', style: t.bodyMedium),
          Gaps.l,
          if (_error != null) ...[Banner2(tone: Tone.bad, title: _error!), Gaps.m],
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: const InputDecoration(labelText: 'Email')),
          Gaps.m,
          TextField(
            controller: _pw,
            obscureText: !_show,
            decoration: InputDecoration(labelText: 'Password', suffixIcon: IconButton(onPressed: () => setState(() => _show = !_show), icon: Icon(_show ? Icons.visibility_off : Icons.visibility))),
            onSubmitted: (_) => _submit(),
          ),
          Gaps.l,
          BusyButton(label: 'Sign in', busy: _busy, onPressed: _submit),
          Gaps.m,
          OutlinedButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SignUpScreen())), child: const Text('Create an account')),
        ]),
      ),
    );
  }
}

/// Shown when the server stops honouring the saved login. Recorded work is untouched.
class ReauthScreen extends StatefulWidget {
  const ReauthScreen({super.key});
  @override
  State<ReauthScreen> createState() => _ReauthScreenState();
}

class _ReauthScreenState extends State<ReauthScreen> {
  final _email = TextEditingController(text: Services.session.lastEmail ?? '');
  final _pw = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _go() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await Services.repo.login(_email.text.trim(), _pw.text);
      await Services.session.signedIn(accessToken: r.token, role: r.role, email: _email.text.trim());
      Services.sync.syncNow(force: true);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in again')),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        const Banner2(tone: Tone.info, title: 'Nothing you recorded is lost', body: 'Sign in with the same account and everything waiting on this phone uploads automatically.'),
        Gaps.l,
        if (_error != null) ...[Banner2(tone: Tone.bad, title: _error!), Gaps.m],
        TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        Gaps.m,
        TextField(controller: _pw, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
        Gaps.l,
        BusyButton(label: 'Sign in and sync', busy: _busy, onPressed: _go),
      ]),
    );
  }
}

/* ── Sign up ──────────────────────────────────────────────────────────────── */

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});
  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  String _role = 'farmer';
  final _c = <String, TextEditingController>{for (final k in ['name', 'email', 'password', 'phone', 'nic', 'dsd', 'gn_division', 'farm_address', 'farm_size_ha']) k: TextEditingController()};
  String? _district;
  final _err = <String, String>{};
  String? _top;
  bool _busy = false;

  Future<void> _submit() async {
    final need = ['name', 'email', 'password', 'phone', 'nic', 'dsd', 'gn_division', if (_role == 'farmer') ...['farm_address', 'farm_size_ha']];
    final e = <String, String>{};
    for (final k in need) {
      if (_c[k]!.text.trim().isEmpty) e[k] = 'Required';
    }
    if (_district == null) e['district'] = 'Choose your district';
    if (!_c['email']!.text.contains('@')) e['email'] = 'Enter a valid email';
    if (_c['password']!.text.length < 6) e['password'] = 'At least 6 characters';
    if (_role == 'farmer' && !e.containsKey('farm_size_ha') && (parseNum(_c['farm_size_ha']!.text) ?? 0) <= 0) e['farm_size_ha'] = 'Enter the size in hectares';
    setState(() {
      _err
        ..clear()
        ..addAll(e);
      _top = e.isEmpty ? null : 'Please fix the highlighted fields.';
    });
    if (e.isNotEmpty) return;

    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{
        'name': _c['name']!.text.trim(),
        'email': _c['email']!.text.trim(),
        'password': _c['password']!.text,
        'phone': _c['phone']!.text.trim(),
        'nic': _c['nic']!.text.trim(),
        'district': _district,
        'dsd': _c['dsd']!.text.trim(),
        'gn_division': _c['gn_division']!.text.trim(),
        if (_role == 'farmer') 'farm_address': _c['farm_address']!.text.trim(),
        if (_role == 'farmer') 'farm_size_ha': parseNum(_c['farm_size_ha']!.text),
      };
      final r = await Services.repo.signUp(_role, body);
      await Services.session.signedIn(accessToken: r.token, role: r.role, email: _c['email']!.text.trim());
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (err) {
      if (mounted) setState(() => _top = errText(err));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _tf(String key, String label, {TextInputType? type, bool obscure = false, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: _c[key],
        keyboardType: type,
        obscureText: obscure,
        textCapitalization: type == null && !obscure ? TextCapitalization.words : TextCapitalization.none,
        decoration: InputDecoration(labelText: label, errorText: _err[key], helperText: hint),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 32), children: [
          Row(children: [
            Expanded(child: ChoiceTile(title: 'Farmer', subtitle: 'I grow crops', selected: _role == 'farmer', onTap: () => setState(() => _role = 'farmer'), leading: const Icon(Icons.agriculture, color: C.leaf600))),
            Gaps.s,
            Expanded(child: ChoiceTile(title: 'Collector', subtitle: 'I buy leaf', selected: _role == 'collector', onTap: () => setState(() => _role = 'collector'), leading: const Icon(Icons.local_shipping_outlined, color: C.bark600))),
          ]),
          Gaps.l,
          if (_top != null) ...[Banner2(tone: Tone.bad, title: _top!), Gaps.m],
          _tf('name', 'Full name'),
          _tf('email', 'Email', type: TextInputType.emailAddress),
          _tf('password', 'Password', obscure: true),
          _tf('phone', 'Phone number', type: TextInputType.phone),
          _tf('nic', 'NIC number', hint: 'Stored only as a salted hash. Nobody can read it back.'),
          Padding(padding: const EdgeInsets.only(bottom: 16), child: DistrictField(value: _district, error: _err['district'], onChanged: (v) => setState(() => _district = v))),
          _tf('dsd', 'Divisional Secretariat (DSD)'),
          _tf('gn_division', 'GN division'),
          if (_role == 'farmer') ...[
            _tf('farm_address', 'Farm address'),
            _tf('farm_size_ha', 'Farm size (hectares)', type: const TextInputType.numberWithOptions(decimal: true)),
          ],
          Gaps.s,
          const Banner2(tone: Tone.info, title: 'Check your district', body: 'Buyer orders and planting notices are matched to the district you pick here, and it cannot be edited later.'),
          Gaps.l,
          BusyButton(label: 'Create account', busy: _busy, onPressed: _submit),
        ]),
      ),
    );
  }
}

/* ── PIN ──────────────────────────────────────────────────────────────────── */

class PinSetupScreen extends StatefulWidget {
  const PinSetupScreen({super.key, this.changing = false});
  final bool changing;
  @override
  State<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<PinSetupScreen> {
  String? _first;
  String? _msg;
  final _pad = GlobalKey<PinPadState>();

  Future<void> _done(String pin) async {
    if (_first == null) {
      setState(() {
        _first = pin;
        _msg = null;
      });
      return;
    }
    if (_first != pin) {
      setState(() {
        _first = null;
        _msg = 'PINs do not match. Start again.';
      });
      return;
    }
    await Services.session.setPin(pin);
    if (mounted && widget.changing) {
      Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: widget.changing ? AppBar(title: const Text('Change PIN')) : null,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            if (!widget.changing) ...[Gaps.l, const _Brand()],
            const Spacer(),
            const Icon(Icons.lock_outline_rounded, size: 40, color: C.leaf600),
            Gaps.m,
            Text(_first == null ? 'Choose a 4-digit PIN' : 'Enter it once more', style: t.titleLarge),
            Gaps.s,
            Text('You will use this to open the app, even with no signal.', style: t.bodyMedium, textAlign: TextAlign.center),
            if (_msg != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_msg!, style: const TextStyle(color: C.danger, fontWeight: FontWeight.w600))),
            const Spacer(),
            PinPad(key: _pad, onComplete: _done),
            if (!widget.changing) TextButton(onPressed: Services.session.skipPin, child: const Text('Skip for now')),
          ]),
        ),
      ),
    );
  }
}

class PinUnlockScreen extends StatefulWidget {
  const PinUnlockScreen({super.key});
  @override
  State<PinUnlockScreen> createState() => _PinUnlockScreenState();
}

class _PinUnlockScreenState extends State<PinUnlockScreen> {
  String? _msg;
  Duration? _locked;

  @override
  void initState() {
    super.initState();
    Services.session.lockRemaining().then((d) {
      if (mounted) setState(() => _locked = d);
    });
  }

  Future<void> _check(String pin) async {
    final r = await Services.session.unlock(pin);
    if (r.ok || !mounted) return;
    setState(() {
      _locked = r.lockedFor;
      _msg = r.lockedFor != null ? 'Too many tries. Wait ${r.lockedFor!.inSeconds >= 60 ? '${(r.lockedFor!.inSeconds / 60).ceil()} min' : '${r.lockedFor!.inSeconds} s'} and try again.' : 'Incorrect PIN. ${r.attemptsLeft} tr${r.attemptsLeft == 1 ? 'y' : 'ies'} left.';
    });
  }

  Future<void> _forgot() async {
    final ok = await confirmDialog(context, title: 'Sign in with email instead?', body: 'This signs you out of this phone. Anything already recorded stays saved and uploads once you sign in again.', confirm: 'Sign out');
    if (ok) await Services.session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            Gaps.l,
            const _Brand(),
            const Spacer(),
            Text('Enter your PIN', style: t.titleLarge),
            if (_msg != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_msg!, style: const TextStyle(color: C.danger, fontWeight: FontWeight.w600), textAlign: TextAlign.center)),
            const Spacer(),
            PinPad(onComplete: _check, enabled: _locked == null || _locked!.isNegative),
            TextButton(onPressed: _forgot, child: const Text('Forgot PIN? Sign in with email')),
          ]),
        ),
      ),
    );
  }
}

class WrongRoleScreen extends StatelessWidget {
  const WrongRoleScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final role = Services.session.role ?? 'this';
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.desktop_windows_outlined, size: 56, color: C.leaf600),
            Gaps.m,
            Text('This app is for farmers and collectors', style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
            Gaps.s,
            Text('Your account is an $role account. Exporters and administrators work on the Origo website.', style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
            Gaps.l,
            OutlinedButton(onPressed: Services.session.logout, child: const Text('Sign out')),
          ]),
        ),
      ),
    );
  }
}

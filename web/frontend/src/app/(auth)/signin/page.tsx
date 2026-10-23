"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, homeFor, parseError, session, type Role } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.200 1-3.700 1-2.800 0-5.200-1.900-6-4.500H2.400v2.800A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M6 14.100a6.600 6.600 0 0 1 0-4.200V7.100H2.400a11 11 0 0 0 0 9.800L6 14.100Z" />
      <path fill="#EA4335" d="M12 5.400c1.600 0 3 .6 4.200 1.600l3.100-3.100A11 11 0 0 0 2.400 7.100L6 9.900c.8-2.600 3.200-4.500 6-4.500Z" />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const { data } = await api.post<{ access_token: string; role: Role }>("/auth/login", { email: email.trim(), password });
      session.set(data.access_token, data.role);
      router.replace(homeFor(data.role));
    } catch (err) {
      const p = parseError(err, "Sign-in failed. Please try again.");
      setFields(p.fields);
      setError(Object.keys(p.fields).length ? null : p.message);
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    try {
      const { data } = await api.get<{ url: string }>("/auth/google");
      window.location.assign(data.url);
    } catch (err) {
      setError(parseError(err, "Google sign-in is unavailable right now.").message);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Sign in to your Origo workspace.</p>

      <div className="mt-6 space-y-3">
        {params.get("expired") && <Alert tone="warn" title="Your session ended">Please sign in again to continue.</Alert>}
        {params.get("google") && <Alert tone="bad" title="Google sign-in didn’t finish">{params.get("google")}</Alert>}
        {error && <Alert tone="bad">{error}</Alert>}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || !password}>Sign in</Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>

      <Button variant="secondary" size="lg" className="w-full" onClick={google}><GoogleMark /> Continue with Google</Button>
      <p className="mt-2 text-center text-xs text-ink-mute">Google sign-in creates a farmer account. Exporters register with email.</p>

      <p className="mt-8 text-center text-sm text-ink-soft">
        New to Origo? <Link href="/signup" className="font-medium text-leaf-700 hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>;
}

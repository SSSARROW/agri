"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { homeFor, session } from "@/lib/api";
import { Button, Icon } from "@/components/ui";
import { Logo } from "@/components/shell/Logo";

const PILLARS = [
  { icon: "leaf", title: "Farmers prove it", body: "Plots are walked, plantings and harvests are photographed and geotagged, and every step is stamped on a tamper-proof record." },
  { icon: "tag", title: "Exporters set the standard", body: "Publish a quality standard once, post buy requests against it, and review photo proof as it comes in." },
  { icon: "qr", title: "Anyone can verify", body: "Scan the QR on the pack and read where the batch grew, who handled it, and whether the standard was met." },
] as const;

export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [signedIn, setSignedIn] = useState<string | null>(null);

  useEffect(() => {
    const role = session.role;
    if (session.token && role) setSignedIn(homeFor(role));
  }, []);

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (c) router.push(`/batch/${encodeURIComponent(c.toUpperCase())}`);
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {signedIn ? (
            <Link href={signedIn} className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-700">Open workspace</Link>
          ) : (
            <>
              <Link href="/signin" className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-sunken">Sign in</Link>
              <Link href="/signup" className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-700">Create account</Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative overflow-hidden bg-leaf-900 text-white">
        <svg className="absolute -right-24 -bottom-24 h-[520px] w-[520px] text-leaf-700/40" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
          <path d="M10 90C10 40 40 8 92 8c0 52-28 80-70 80-4-14-6-24-12-26 8-2 14-8 22-18-12 6-18 10-22 18-2 4-2 18-2 18Z" />
        </svg>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.3fr_1fr] lg:py-28">
          <div>
            <p className="mb-4 text-xs font-medium tracking-[0.18em] text-leaf-200 uppercase">Tea · Cinnamon · Sri Lanka</p>
            <h1 className="font-display text-4xl leading-[1.08] font-semibold sm:text-6xl">
              Know exactly where every leaf and quill came from.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-leaf-100">
              Origo links smallholder farms to export buyers with evidence that holds up: photographed, geotagged and time-stamped from planting to the labelled pack.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {!signedIn && <Link href="/signup" className="inline-flex h-12 items-center rounded-lg bg-white px-6 font-medium text-leaf-900 hover:bg-leaf-50">Register as an exporter</Link>}
              <Link href="/signin" className="inline-flex h-12 items-center rounded-lg border border-white/30 px-6 font-medium text-white hover:bg-white/10">Sign in</Link>
            </div>
          </div>

          <form onSubmit={lookup} className="self-end rounded-2xl bg-white p-6 text-ink shadow-pop">
            <div className="mb-1 flex items-center gap-2 text-leaf-700"><Icon name="qr" /><span className="text-sm font-semibold">Check a batch</span></div>
            <h2 className="font-display text-2xl font-semibold">Holding a pack?</h2>
            <p className="mt-1 text-sm text-ink-soft">Type the batch code printed under the QR to see its full history.</p>
            <label htmlFor="code" className="sr-only">Batch code</label>
            <input
              id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 7KQ2-M9XD"
              className="mt-4 h-12 w-full rounded-lg border border-line-strong px-4 font-mono text-base tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/20 focus:outline-none"
            />
            <Button type="submit" size="lg" className="mt-3 w-full" disabled={!code.trim()}>View batch history</Button>
          </form>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-16 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-leaf-50 text-leaf-600"><Icon name={p.icon} size={20} /></div>
            <h3 className="text-lg font-semibold">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-mute">
        Farmers and collectors use the Origo Field app on Android. Exporters and administrators work here.
      </footer>
    </div>
  );
}

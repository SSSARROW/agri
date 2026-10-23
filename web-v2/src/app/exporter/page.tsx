"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { useFetch } from "@/hooks/useFetch";
import { useExporter } from "@/components/shell/ExporterContext";
import { Icon } from "@/components/ui";
import { StageBar } from "@/components/exporter/StageBar";
import type { NetworkProgress, StageState } from "@/lib/types";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "Two farmers are waiting on you, and 3 proof photos need review." */
function summary(requests: number, proofs: number, drafts: number): string {
  const parts: string[] = [];
  if (requests) parts.push(`${plural(requests, "farmer")} ${requests === 1 ? "is" : "are"} waiting for your decision`);
  if (proofs) parts.push(`${plural(proofs, "proof submission")} ${proofs === 1 ? "needs" : "need"} review`);
  if (parts.length) return parts.join(", and ") + ".";
  if (drafts) return `Nothing is waiting on you. You have ${plural(drafts, "draft buy request")} you could finish.`;
  return "Nothing is waiting on you right now.";
}

export default function ExporterOverview() {
  const { profile, verified, counts } = useExporter();

  const live = useFetch(async () => {
    const n = (r: PromiseSettledResult<{ data: { total?: number } }>) => (r.status === "fulfilled" ? r.value.data.total ?? 0 : 0);
    const [l, d, u, s] = await Promise.allSettled([
      api.get("/api/exporter/ads", { params: { status: "live", page_size: 1 } }),
      api.get("/api/exporter/ads", { params: { status: "draft", page_size: 1 } }),
      api.get("/api/exporter/planting-notices", { params: { state: "upcoming", page_size: 1 } }),
      api.get("/api/exporter/standards", { params: { is_archived: false, page_size: 1 } }),
    ]);
    return { liveAds: n(l), draftAds: n(d), notices: n(u), standards: n(s) };
  }, []);

  const prog = useFetch(() => api.get<NetworkProgress>("/api/exporter/farmers/progress").then((r) => r.data), []);
  const d = live.data;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const name = profile.contact_person?.split(" ")[0] || profile.company_name;

  const desk = [
    { n: counts.requests, title: "Farmer requests", note: "Accept or decline farmers who want to follow your standard", href: "/exporter/farmers" },
    { n: counts.proofs, title: "Proof to review", note: "Photos sent by your farmers for stages of your standards", href: "/exporter/stage-proofs" },
    { n: d?.draftAds ?? 0, title: "Unfinished buy requests", note: "Drafts that farmers can't see yet", href: "/exporter/ads" },
  ];

  return (
    <div className="pb-8">
      <header className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm text-ink-mute">{today}</p>
        <h1 className="text-4xl leading-[1.15] font-semibold text-ink sm:text-[2.75rem]">
          {greeting()}, {name}.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{summary(counts.requests, counts.proofs, d?.draftAds ?? 0)}</p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="desk">
          <h2 id="desk" className="mb-1 text-sm font-medium tracking-[0.12em] text-ink-mute uppercase">On your desk</h2>
          <ul className="divide-y divide-line border-y border-line">
            {desk.map((r) => (
              <li key={r.title}>
                <Link href={r.href} className="group flex items-center gap-6 py-5 transition-colors hover:bg-sunken/50">
                  <span className={`w-14 shrink-0 text-right text-4xl font-semibold tabular-nums ${r.n ? "text-bark-600" : "text-line-strong"}`}>{r.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{r.title}</span>
                    <span className="block text-sm text-ink-mute">{r.note}</span>
                  </span>
                  <Icon name="chevronRight" className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 mb-1 text-sm font-medium tracking-[0.12em] text-ink-mute uppercase">Farmer progress</h2>
          {prog.data && prog.data.items.length > 0 ? (
            <>
              <ul className="divide-y divide-line border-y border-line">
                {prog.data.items.slice(0, 5).map((r) => {
                  const segs = (["approved", "pending", "rejected", "reopened", "overdue", "upcoming", "waiting"] as StageState[]).flatMap((k) => Array(r.totals[k]).fill(k)).map((st, i) => ({ name: `Stage ${i + 1}`, status: st as StageState }));
                  return (
                    <li key={r.link_id}>
                      <Link href={`/exporter/farmers/${r.link_id}`} className="group flex items-center gap-5 py-4 transition-colors hover:bg-sunken/50">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">{r.farmer.name}</span>
                            {r.state === "needs_attention" && <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">Needs attention</span>}
                          </span>
                          <span className="mt-2 block"><StageBar stages={segs} /></span>
                        </span>
                        <span className="w-28 shrink-0 text-right text-sm text-ink-mute"><strong className="text-ink">{r.stages_approved}/{r.stages_total}</strong> stages{r.days_since_planting != null ? <><br />day {r.days_since_planting}</> : null}</span>
                        <Icon name="chevronRight" className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-sm"><Link className="font-medium text-leaf-700 hover:underline" href="/exporter/progress">See all {prog.data.summary.farmers} farmers</Link></p>
            </>
          ) : (
            <p className="border-y border-line py-5 text-sm text-ink-mute">Approved farmers and how far they are through your standard will show here.</p>
          )}

          <h2 className="mt-12 mb-1 text-sm font-medium tracking-[0.12em] text-ink-mute uppercase">What you have out there</h2>
          <dl className="grid grid-cols-3 gap-6 border-b border-line py-6">
            {[
              { v: d?.liveAds, l: "live buy requests", href: "/exporter/ads" },
              { v: d?.notices, l: "upcoming planting notices", href: "/exporter/planting-notices" },
              { v: d?.standards, l: "quality standards", href: "/exporter/standards" },
            ].map((x) => (
              <Link key={x.l} href={x.href} className="group">
                <dd className="text-3xl font-semibold tabular-nums text-leaf-700 group-hover:underline">{x.v ?? "–"}</dd>
                <dt className="mt-1 text-sm text-ink-mute">{x.l}</dt>
              </Link>
            ))}
          </dl>

          <p className="mt-6 text-sm text-ink-mute">
            Start something new:{" "}
            <Link className="font-medium text-leaf-700 hover:underline" href="/exporter/ads/new">a buy request</Link>,{" "}
            <Link className="font-medium text-leaf-700 hover:underline" href="/exporter/planting-notices/new">a planting notice</Link> or{" "}
            <Link className="font-medium text-leaf-700 hover:underline" href="/exporter/standards">a quality standard</Link>.
          </p>
        </section>

        <aside aria-labelledby="co" className="lg:border-l lg:border-line lg:pl-10">
          <h2 id="co" className="mb-4 text-sm font-medium tracking-[0.12em] text-ink-mute uppercase">Your company</h2>
          <p className="text-xl font-semibold">{profile.company_name}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {verified ? "Verified exporter" : profile.status === "rejected" ? "Application rejected" : "Waiting for verification"}
          </p>

          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-ink-mute">Buys</dt>
              <dd className="mt-0.5 text-ink">{profile.crops_bought.map((c) => CROP_LABEL[c] ?? c).join(", ") || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-ink-mute">Sources from</dt>
              <dd className="mt-0.5 text-ink">
                {profile.districts_served.length === 0
                  ? "No districts chosen yet"
                  : profile.districts_served.length > 5
                    ? `${profile.districts_served.slice(0, 4).join(", ")} and ${profile.districts_served.length - 4} more`
                    : profile.districts_served.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-mute">Certifications</dt>
              <dd className="mt-0.5 text-ink">{profile.certifications.join(", ") || "None declared"}</dd>
            </div>
          </dl>

          {!verified && profile.status === "pending" && (
            <p className="mt-6 border-l-2 border-bark-500 pl-4 text-sm leading-relaxed text-ink-soft">
              An administrator is checking your details, usually within 1–2 business days. Until then you can prepare standards, ads and notices, but not publish them.
            </p>
          )}

          <Link href="/exporter/profile" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-leaf-700 hover:underline">
            Edit company profile <Icon name="chevronRight" size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

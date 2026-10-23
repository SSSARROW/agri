"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { FIELD_API_URL, assetUrl } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtHa, titleCase } from "@/lib/format";
import type { ProvStage, Provenance } from "@/lib/types";
import { Logo } from "@/components/shell/Logo";
import { Alert, Badge, Icon, Modal, ProgressBar, Spinner, type Tone } from "@/components/ui";

const EVENT_LABEL: Record<string, string> = {
  planted: "Planted", plot_photo: "Plot registered", planting_photo: "Planting photo", progress_photo: "Progress photo", batch_photo: "Batch photo",
  collect: "Collected", weigh: "Weighed", process: "Processed", grade: "Graded", pack: "Packed", collector_attestation: "Collector’s check",
};
const HIDDEN = new Set(["photo_url", "caption", "location_flagged", "distance_from_plot_m", "crop"]);
const STAGE_TONE: Record<string, Tone> = { done: "good", overdue: "bad", upcoming: "info", pending: "warn", standing: "neutral" };

function payloadRows(p: Record<string, unknown>): { k: string; v: string }[] {
  return Object.entries(p)
    .filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      if (k === "weight_kg") return { k: "Weight", v: `${v} kg` };
      if (k === "area_ha") return { k: "Area", v: `${v} ha` };
      return { k: titleCase(k.replace(/_kg$/, "").replace(/_ha$/, "")), v: Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v) };
    });
}

export default function BatchPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<Provenance | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [zoom, setZoom] = useState<string | null>(null);
  const clean = decodeURIComponent(code).trim().toUpperCase();

  useEffect(() => {
    let live = true;
    axios
      .get<Provenance>(`${FIELD_API_URL}/api/v1/provenance/${encodeURIComponent(clean)}`)
      .then((r) => { if (live) { setData(r.data); setState("ok"); } })
      .catch((e) => { if (live) setState(axios.isAxiosError(e) && e.response?.status === 404 ? "missing" : "error"); });
    return () => { live = false; };
  }, [clean]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/"><Logo /></Link>
          <span className="text-xs tracking-wide text-ink-mute uppercase">Batch history</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-5 py-8">
        {state === "loading" && <Spinner label="Looking up this batch…" />}

        {state === "missing" && (
          <div className="rounded-2xl border border-danger-600/25 bg-danger-50 p-8 text-center">
            <Icon name="alert" size={28} className="mx-auto mb-3 text-danger-600" />
            <h1 className="font-display text-2xl font-semibold text-danger-700">Batch not found</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-danger-700/90">
              We couldn’t verify the code <code className="rounded bg-white px-1.5 py-0.5 font-mono">{clean}</code>. It may be mistyped, the label may be damaged, or it may not be genuine. If you bought this product, please contact the seller.
            </p>
            <Link href="/" className="mt-5 inline-block text-sm font-medium text-leaf-700 hover:underline">Try another code</Link>
          </div>
        )}
        {state === "error" && (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <h1 className="font-display text-xl font-semibold">We couldn’t load this batch</h1>
            <p className="mt-1 text-sm text-ink-soft">Check your connection and reload the page.</p>
          </div>
        )}

        {state === "ok" && data && <Body d={data} onZoom={setZoom} />}
      </main>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Photo" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {zoom && <img src={zoom} alt="Full-size photo from the batch record" className="max-h-[70dvh] w-full rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-sunken px-3.5 py-3">
      <dt className="text-[11px] tracking-wide text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

function Card({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="mb-3 flex items-center font-display text-lg font-semibold">{title}{tag && <span className="ml-auto text-xs font-medium text-ink-mute">{tag}</span>}</h2>
      {children}
    </section>
  );
}

function Body({ d, onZoom }: { d: Provenance; onZoom: (u: string) => void }) {
  const p = d.protocol;
  const s = d.summary;
  const verdict = !p ? null : p.tier_achieved ? "verified" : p.required_satisfied > 0 ? "progress" : "none";
  const kg = (n?: number | null) => (n == null ? "—" : `${Number(n.toFixed(1)).toLocaleString("en-GB")} kg`);
  const photos = d.timeline.filter((e) => typeof e.payload.photo_url === "string");
  const STEP: Record<string, string> = { collect: "Collected", weigh: "Weighed", process: "Processed", grade: "Graded", pack: "Packed", collector_attestation: "Condition check" };

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-leaf-900 p-6 text-white shadow-card">
        <div className="absolute -right-14 -bottom-16 h-52 w-52 rounded-full bg-leaf-500/30" />
        <p className="text-xs tracking-[0.16em] text-leaf-200 uppercase">{CROP_LABEL[d.batch.crop.toLowerCase()] ?? d.batch.crop}{s?.grade ? ` · ${s.grade}` : ""}</p>
        <h1 className="mt-1 font-mono text-3xl font-semibold tracking-wider break-all">{d.batch.code}</h1>
        <p className="mt-1 text-sm text-leaf-100">Registered {fmtDate(d.batch.created_at)}{d.plot?.district ? ` · grown in ${d.plot.district}` : d.lineage.length ? ` · combined from ${d.lineage.length} batches` : ""}</p>
        <dl className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {s?.weight_kg != null && <div className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-3"><dd className="text-2xl font-semibold">{kg(s.weight_kg)}</dd><dt className="text-xs text-leaf-200">{s.weight_source === "sum_of_parents" ? "Total weight" : "Batch weight"}</dt></div>}
          {!!s?.packages && <div className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-3"><dd className="text-2xl font-semibold">{s.packages}</dd><dt className="text-xs text-leaf-200">Packages</dt></div>}
          {s?.days_to_harvest != null && d.plot && <div className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-3"><dd className="text-2xl font-semibold">{s.days_to_harvest} days</dd><dt className="text-xs text-leaf-200">Planting to harvest</dt></div>}
          {(s?.growers ?? 0) > 1 && <div className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-3"><dd className="text-2xl font-semibold">{s!.growers}</dd><dt className="text-xs text-leaf-200">Farms combined</dt></div>}
        </dl>
      </section>

      {d.scan_warning && <Alert tone="warn" title="Buy with caution">{d.scan_warning}</Alert>}

      {p && verdict && (
        <section className={`rounded-2xl border p-5 ${verdict === "verified" ? "border-leaf-500/30 bg-leaf-50" : verdict === "progress" ? "border-warn-600/25 bg-warn-50" : "border-line bg-surface"}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${verdict === "verified" ? "bg-leaf-600" : verdict === "progress" ? "bg-warn-600" : "bg-ink-mute"}`}>
              <Icon name={verdict === "verified" ? "shield" : "clock"} size={18} />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold">{verdict === "verified" ? "Verified" : verdict === "progress" ? "In progress" : "Not yet verified"} · {p.protocol_name}</h2>
              <p className="text-sm text-ink-soft">
                {verdict === "verified" ? `Every checkable requirement (${p.required_total} of ${p.required_total}) has a matching recorded event on this batch.` : `${p.required_satisfied} of ${p.required_total} required steps have a matching recorded event.`}
              </p>
            </div>
          </div>
        </section>
      )}

      <Card title="At a glance">
        <dl className="grid grid-cols-2 gap-2.5">
          <Fact label="Crop" value={CROP_LABEL[d.batch.crop.toLowerCase()] ?? d.batch.crop} />
          <Fact label="Grade" value={s?.grade || "—"} />
          <Fact label={s?.weight_source === "sum_of_parents" ? "Total weight" : "Weight"} value={kg(s?.weight_kg)} />
          <Fact label="Packages" value={s?.packages || "—"} />
          <Fact label="Planted" value={d.plot ? fmtDate(s?.planted_at) : "—"} />
          <Fact label="Harvested" value={fmtDate(s?.harvested_at)} />
          <Fact label="Condition on arrival" value={s?.condition ? titleCase(s.condition) : "Not checked"} />
          <Fact label="Photos on record" value={s?.photo_count ?? 0} />
        </dl>
        {s?.condition_note && <p className="mt-3 text-sm text-ink-mute">Collector’s note: {s.condition_note}</p>}
        {!!s?.steps_done.length && <div className="mt-3 flex flex-wrap gap-1.5">{s.steps_done.map((x) => <Badge key={x} tone="good">✓ {STEP[x] ?? titleCase(x)}</Badge>)}</div>}
      </Card>

      {!!d.exporters?.length && (
        <Card title="Sourced for">
          {d.exporters.map((e) => (
            <div key={e.company_name} className="mb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-xl font-bold text-leaf-700">{e.company_name.charAt(0)}</span>
                <div><p className="font-semibold">{e.company_name}</p>{e.description && <p className="text-sm text-ink-soft">{e.description.length > 190 ? `${e.description.slice(0, 190)}…` : e.description}</p>}</div>
              </div>
              {e.certifications.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{e.certifications.map((c) => <Badge key={c} tone="info">{c}</Badge>)}</div>}
            </div>
          ))}
          {d.exporter_standards?.map((x) => (
            <div key={x.name} className="mt-3 border-t border-line pt-3">
              <div className="mb-2 flex justify-between gap-3 text-sm"><span className="text-ink-mute">Exporter’s own standard</span><span className="text-right font-medium">{x.name} · v{x.version}</span></div>
              <ProgressBar value={x.stages_total ? (x.stages_approved / x.stages_total) * 100 : 0} label="Stages approved" />
              <p className="mt-2 text-sm text-ink-soft">{x.stages_approved} of {x.stages_total} stage{x.stages_total === 1 ? "" : "s"} reviewed and approved by {x.exporter} from {x.growers === 1 ? "the grower’s" : `the ${x.growers} growers’`} photo proof.</p>
            </div>
          ))}
        </Card>
      )}

      {d.plot && (
        <Card title="Where it was grown">
          <dl className="divide-y divide-line text-sm">
            {[
              ["District", d.plot.district], ["DS division", d.plot.dsd], ["GN division", d.plot.gn_division], ["Plot size", fmtHa(d.plot.area_ha)],
              ["Growing environment", d.plot.plot_type ? titleCase(d.plot.plot_type) : null],
              ["Boundary", d.plot.boundary_source ? (d.plot.boundary_source === "estimated_square" ? "Estimated" : "Measured on foot or on map") : null],
              ["Grown on this plot", d.plot.crops?.join(", ")], ["Plot on record since", d.plot.registered_at ? fmtDate(d.plot.registered_at) : null],
            ].filter(([, v]) => v).map(([k, v]) => <div key={k as string} className="flex justify-between gap-4 py-2.5"><dt className="text-ink-mute">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-ink-mute">Exact coordinates are never shared.</p>
        </Card>
      )}

      {p && p.stages.length > 0 && (
        <Card title={p.protocol_name} tag={`${p.required_satisfied}/${p.required_total} verified`}>
          <ol className="space-y-3">
            {p.stages.map((st: ProvStage) => (
              <li key={st.sequence} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{st.title}</p>
                  <Badge tone={STAGE_TONE[st.status] ?? "neutral"} dot>{st.day_offset === null && st.status !== "done" ? "Standing rule" : titleCase(st.status)}</Badge>
                </div>
                {st.instructions && <p className="mt-1 text-sm text-ink-soft">{st.instructions}</p>}
                {st.due_date && <p className="mt-1 text-xs text-ink-mute">Due {fmtDate(st.due_date)}</p>}
              </li>
            ))}
          </ol>
          {p.protocol_source && <p className="mt-3 text-xs text-ink-mute">Source: {p.protocol_source}</p>}
        </Card>
      )}

      <Card title="Journey" tag={`${d.timeline.length} events`}>
        {d.timeline.length === 0 ? <p className="text-sm text-ink-soft">No events recorded yet.</p> : (
          <ol className="relative space-y-6 border-l-2 border-leaf-100 pl-6">
            {d.timeline.map((e, i) => {
              const photo = typeof e.payload.photo_url === "string" ? assetUrl(e.payload.photo_url) : null;
              const rows = payloadRows(e.payload);
              const far = !!e.payload.location_flagged && typeof e.payload.distance_from_plot_m === "number";
              return (
                <li key={i} className="relative">
                  <span className="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full border-2 border-surface bg-leaf-500" />
                  <p className="font-medium">{EVENT_LABEL[e.event_type] ?? titleCase(e.event_type)}
                    {e.batch_code && e.batch_code !== d.batch.code && <span className="ml-2 font-mono text-xs text-ink-mute">from {e.batch_code}</span>}</p>
                  <p className="text-xs text-ink-mute">{fmtDateTime(e.occurred_at)}</p>
                  {rows.length > 0 && <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-sm">{rows.map((r) => <div key={r.k}><dt className="inline text-ink-mute">{r.k}: </dt><dd className="inline font-medium">{r.v}</dd></div>)}</dl>}
                  {typeof e.payload.caption === "string" && e.payload.caption && <p className="mt-1 text-sm text-ink-soft italic">“{e.payload.caption}”</p>}
                  {photo && (
                    <button onClick={() => onZoom(photo)} className="mt-2 block overflow-hidden rounded-lg" aria-label="Open photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt="" loading="lazy" className="h-32 w-auto max-w-full object-cover" />
                    </button>
                  )}
                  {far && <p className="mt-1 text-xs text-warn-600">Taken {Math.round(e.payload.distance_from_plot_m as number)} m from the plot</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {photos.length > 3 && (
        <Card title="Photos" tag={`${photos.length}`}>
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(-9).map((e, i) => (
              <button key={i} onClick={() => onZoom(assetUrl(e.payload.photo_url as string))} className="aspect-square overflow-hidden rounded-xl bg-sunken" aria-label="Open photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(e.payload.photo_url as string)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {d.lineage.length > 0 && (
        <Card title={`Combined from ${d.lineage.length} farm batches`}>
          <ul className="space-y-2">
            {d.lineage.map((l) => (
              <li key={l.code}>
                <Link href={`/batch/${l.code}`} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm hover:bg-sunken">
                  <span><span className="font-mono font-medium">{l.code}</span> · {CROP_LABEL[l.crop.toLowerCase()] ?? l.crop}{l.district ? ` · ${l.district}` : ""}</span>
                  <span className="text-ink-mute">{l.weight_kg != null ? kg(l.weight_kg) : fmtDate(l.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="pb-6 text-center text-xs leading-relaxed text-ink-mute">
        Scanned {s?.scan_count ?? 0} time{s?.scan_count === 1 ? "" : "s"}. Scans are counted to spot copied labels; your identity and location are never recorded.<br />
        Data here is recorded in the Origo Field app and cannot be edited after the fact.
      </p>
    </>
  );
}

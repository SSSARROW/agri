"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { emptyStage, timingText } from "@/lib/standards";
import type { BannedInput, GradeSpecField, Stage, Standard, StandardTemplate, TemplatesResponse, VersionDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import {
  Alert, Badge, Button, Card, ErrorState, Icon, LinesField, Modal, MultilingualField, PageHeader, SelectField, Spinner, StatusBadge, TextField, cx, useConfirm, useToast,
} from "@/components/ui";

interface UiStage extends Stage { key: string; allowedText: string; open: boolean }
interface OtherRow { key: string; k: string; v: string }

let uid = 0;
const nextKey = () => `k${++uid}`;

const toUi = (s: Stage, open = false): UiStage => ({
  ...s,
  instructions: { en: s.instructions?.en ?? "", si: s.instructions?.si ?? "", ta: s.instructions?.ta ?? "" },
  dos: { en: s.dos?.en ?? [], si: s.dos?.si ?? [], ta: s.dos?.ta ?? [] },
  donts: { en: s.donts?.en ?? [], si: s.donts?.si ?? [], ta: s.donts?.ta ?? [] },
  allowed_inputs: s.allowed_inputs ?? [],
  banned_inputs: s.banned_inputs ?? [],
  required_proof: {
    photo_count: s.required_proof?.photo_count ?? 0,
    photo_descriptions: s.required_proof?.photo_descriptions ?? [],
    quick_fields: s.required_proof?.quick_fields ?? [],
  },
  key: nextKey(),
  allowedText: (s.allowed_inputs ?? []).join(", "),
  open,
});

const clean = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);

function toPayload(stages: UiStage[]): Stage[] {
  return stages.map((s, i) => ({
    position: i + 1,
    name: s.name.trim(),
    timing_type: s.timing_type,
    start_offset_days: Number(s.start_offset_days) || 0,
    repeat_interval_days: s.timing_type === "recurring" ? Number(s.repeat_interval_days) || null : null,
    end_offset_days: s.timing_type === "recurring" && s.end_offset_days !== null && s.end_offset_days !== undefined && `${s.end_offset_days}` !== "" ? Number(s.end_offset_days) : null,
    instructions: { en: s.instructions.en.trim(), si: s.instructions.si.trim(), ta: s.instructions.ta.trim() },
    dos: { en: clean(s.dos.en), si: clean(s.dos.si), ta: clean(s.dos.ta) },
    donts: { en: clean(s.donts.en), si: clean(s.donts.si), ta: clean(s.donts.ta) },
    allowed_inputs: s.allowedText.split(",").map((x) => x.trim()).filter(Boolean),
    banned_inputs: s.banned_inputs.filter((b) => b.name.trim()).map((b) => ({ name: b.name.trim(), min_days_before_harvest: Number(b.min_days_before_harvest) || 0 })),
    required_proof: {
      photo_count: Math.max(0, Number(s.required_proof.photo_count) || 0),
      photo_descriptions: clean(s.required_proof.photo_descriptions),
      quick_fields: clean(s.required_proof.quick_fields),
    },
  }));
}

function validate(name: string, stages: UiStage[]): string[] {
  const out: string[] = [];
  if (!name.trim()) out.push("Give this version a name.");
  stages.forEach((s, i) => {
    const n = `Stage ${i + 1}`;
    if (!s.name.trim()) out.push(`${n}: name is required.`);
    if (!s.instructions.en.trim()) out.push(`${n}: English instructions are required.`);
    if (s.timing_type === "recurring") {
      if (!(Number(s.repeat_interval_days) > 0)) out.push(`${n}: repeat interval must be more than 0 days.`);
      if (s.end_offset_days !== null && s.end_offset_days !== undefined && `${s.end_offset_days}` !== "" && Number(s.end_offset_days) < Number(s.start_offset_days)) {
        out.push(`${n}: end day can’t be before the start day.`);
      }
    }
  });
  return out;
}

export default function VersionEditor() {
  const { id, n } = useParams<{ id: string; n: string }>();
  const router = useRouter();
  const toast = useToast();
  const { verified } = useExporter();
  const { confirm, dialog } = useConfirm();

  const std = useFetch(() => api.get<Standard>(`/api/exporter/standards/${id}`).then((r) => r.data), [id]);
  const ver = useFetch(() => api.get<VersionDetail>(`/api/exporter/standards/${id}/versions/${n}`).then((r) => r.data), [id, n]);
  const tpl = useFetch(
    () => (std.data ? api.get<TemplatesResponse>("/api/exporter/standards/templates", { params: { crop: std.data.crop } }).then((r) => r.data).catch(() => null) : Promise.resolve(null)),
    [std.data?.crop],
  );

  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Record<string, string>>({});
  const [others, setOthers] = useState<OtherRow[]>([]);
  const [stages, setStages] = useState<UiStage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const loadedFor = useRef<string>("");

  const fields: GradeSpecField[] = useMemo(() => tpl.data?.grade_spec_fields?.[std.data?.crop ?? ""] ?? [], [tpl.data, std.data?.crop]);

  useEffect(() => {
    const v = ver.data;
    if (!v || loadedFor.current === `${v.id}:${v.status}:${v.published_at}`) return;
    loadedFor.current = `${v.id}:${v.status}:${v.published_at}`;
    setName(v.name);
    setStages([...v.stages].sort((a, b) => a.position - b.position).map((s) => toUi(s)));
    setDirty(false);
  }, [ver.data]);

  // Split the stored grade_spec into named fields and "other parameters" once field defs are known.
  useEffect(() => {
    const v = ver.data;
    if (!v) return;
    const named = new Set(fields.map((f) => f.key));
    const g: Record<string, string> = {};
    const o: OtherRow[] = [];
    Object.entries(v.grade_spec ?? {}).forEach(([k, val]) => {
      const s = typeof val === "string" ? val : JSON.stringify(val);
      if (named.has(k)) g[k] = s;
      else o.push({ key: nextKey(), k, v: s });
    });
    setGrade(g);
    setOthers(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver.data, fields]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const touch = useCallback(() => setDirty(true), []);
  const editable = ver.data?.status === "draft";

  const patchStage = (key: string, patch: Partial<UiStage>) => { setStages((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s))); touch(); };
  const move = (i: number, d: -1 | 1) => {
    setStages((ss) => { const c = [...ss]; const j = i + d; if (j < 0 || j >= c.length) return ss; [c[i], c[j]] = [c[j], c[i]]; return c; });
    touch();
  };

  const buildGrade = () => {
    const out: Record<string, string> = {};
    Object.entries(grade).forEach(([k, v]) => { if (v.trim()) out[k] = v.trim(); });
    others.forEach((r) => { if (r.k.trim() && r.v.trim()) out[r.k.trim()] = r.v.trim(); });
    return out;
  };

  const save = async (silent = false): Promise<boolean> => {
    const errs = validate(name, stages);
    setProblems(errs);
    if (errs.length) { if (!silent) toast.error("Fix the highlighted problems before saving."); return false; }
    setSaving(true);
    try {
      const { data } = await api.put<VersionDetail>(`/api/exporter/standards/${id}/versions/${n}`, { name: name.trim(), grade_spec: buildGrade(), stages: toPayload(stages) });
      ver.setData(data);
      loadedFor.current = `${data.id}:${data.status}:${data.published_at}`;
      setDirty(false);
      if (!silent) toast.success("Draft saved");
      return true;
    } catch (e) {
      toast.error(parseError(e, "Couldn’t save the draft.").message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = () => {
    const errs = validate(name, stages);
    setProblems(errs);
    if (errs.length) { toast.error("Fix the highlighted problems before publishing."); return; }
    if (stages.length === 0) { setProblems(["Add at least one stage before publishing."]); toast.error("A standard needs at least one stage."); return; }
    confirm({
      title: "Publish this version?",
      body: <>Once published, <strong>v{n}</strong> can never be edited. To change it later you’ll create a new draft version. Farmers will see this standard immediately.</>,
      confirmLabel: "Publish version",
      onConfirm: async () => {
        if (dirty && !(await save(true))) throw new Error("Couldn’t save your latest changes first.");
        try {
          await api.post(`/api/exporter/standards/${id}/versions/${n}/publish`);
        } catch (e) { throw new Error(parseError(e).message); }
        toast.success(`Version ${n} published`);
        loadedFor.current = "";
        ver.reload(); std.reload();
      },
    });
  };

  const applyTemplate = (t: StandardTemplate) => {
    setStages([...t.stages].sort((a, b) => a.position - b.position).map((s) => toUi(s)));
    const named = new Set(fields.map((f) => f.key));
    const g: Record<string, string> = {};
    const o: OtherRow[] = [];
    Object.entries(t.grade_spec ?? {}).forEach(([k, v]) => { if (!`${v}`.trim()) return; if (named.has(k)) g[k] = `${v}`; else o.push({ key: nextKey(), k, v: `${v}` }); });
    setGrade(g); setOthers(o);
    if (!name.trim()) setName(t.name);
    touch(); setTplOpen(false);
    toast.info("Template applied. Review every value with an agronomist before publishing.");
  };

  if ((ver.loading && !ver.data) || (std.loading && !std.data)) return <Spinner />;
  if (ver.error || std.error) return <ErrorState message={(ver.status === 404 || std.status === 404) ? "This version wasn’t found, or it belongs to another exporter." : (ver.error || std.error)!} onRetry={() => { ver.reload(); std.reload(); }} />;
  const s = std.data!;
  const v = ver.data!;

  const preview = [...toPayload(stages)].sort((a, b) => a.start_offset_days - b.start_offset_days);

  return (
    <>
      <PageHeader
        back={{ href: `/exporter/standards/${id}`, label: "Version history" }}
        title={<span className="flex flex-wrap items-center gap-3">{CROP_LABEL[s.crop]} · v{v.version_number}<StatusBadge status={v.status} /></span>}
        subtitle={editable ? "Edit freely; nothing is visible to farmers until you publish." : "Published versions are read-only. To change this standard, start a new draft from its version history."}
        actions={editable ? (
          <>
            {dirty && <Badge tone="warn" dot>Unsaved changes</Badge>}
            <Button variant="secondary" onClick={() => setTplOpen(true)}><Icon name="copy" size={16} /> Start from template</Button>
            <Button variant="secondary" onClick={() => save()} loading={saving} disabled={!dirty}>Save draft</Button>
            <Button onClick={publish} disabled={!verified}>Publish</Button>
          </>
        ) : undefined}
      />
      {editable && !verified && <div className="-mt-3 mb-4 text-right"><VerificationNote action="publish a version" /></div>}

      {problems.length > 0 && (
        <div className="mb-6">
          <Alert tone="bad" title="Please fix these first">
            <ul className="list-disc pl-4">{problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>
          </Alert>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Details</h2>
            <TextField label="Version name" required disabled={!editable} value={name} onChange={(e) => { setName(e.target.value); touch(); }} />
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Grade specification</h2>
              <p className="text-sm text-ink-soft">What the finished {CROP_LABEL[s.crop].toLowerCase()} must look like. Empty fields are left out.</p>
            </div>
            {fields.length === 0 && <p className="text-sm text-ink-mute">Suggested fields couldn’t be loaded; use the free-form rows below.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <TextField key={f.key} label={f.label} hint={f.hint} disabled={!editable} value={grade[f.key] ?? ""} onChange={(e) => { setGrade({ ...grade, [f.key]: e.target.value }); touch(); }} />
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Other parameters</p>
              <div className="space-y-2">
                {others.map((r) => (
                  <div key={r.key} className="flex gap-2">
                    <input aria-label="Parameter name" disabled={!editable} placeholder="Name" value={r.k} onChange={(e) => { setOthers(others.map((x) => (x.key === r.key ? { ...x, k: e.target.value } : x))); touch(); }} className="h-10 w-2/5 rounded-lg border border-line-strong px-3 text-sm disabled:bg-sunken" />
                    <input aria-label="Parameter value" disabled={!editable} placeholder="Value" value={r.v} onChange={(e) => { setOthers(others.map((x) => (x.key === r.key ? { ...x, v: e.target.value } : x))); touch(); }} className="h-10 flex-1 rounded-lg border border-line-strong px-3 text-sm disabled:bg-sunken" />
                    {editable && <Button variant="ghost" size="sm" aria-label="Remove parameter" onClick={() => { setOthers(others.filter((x) => x.key !== r.key)); touch(); }}><Icon name="x" size={16} /></Button>}
                  </div>
                ))}
                {editable && <Button variant="ghost" size="sm" onClick={() => { setOthers([...others, { key: nextKey(), k: "", v: "" }]); touch(); }}><Icon name="plus" size={14} /> Add parameter</Button>}
              </div>
            </div>
          </Card>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Stages <span className="ml-1 text-sm font-normal text-ink-mute">({stages.length})</span></h2>
              {editable && <Button size="sm" onClick={() => { setStages([...stages, toUi(emptyStage(stages.length + 1), true)]); touch(); }}><Icon name="plus" size={14} /> Add stage</Button>}
            </div>
            {stages.length === 0 && (
              <Card className="py-10 text-center text-sm text-ink-soft">
                No stages yet. A standard needs at least one stage before it can be published.
                {editable && <div className="mt-4 flex justify-center gap-2"><Button size="sm" onClick={() => setStages([toUi(emptyStage(1), true)])}>Add the first stage</Button><Button size="sm" variant="secondary" onClick={() => setTplOpen(true)}>Use a template</Button></div>}
              </Card>
            )}
            <ol className="space-y-3">
              {stages.map((st, i) => (
                <StageCard
                  key={st.key} index={i} total={stages.length} stage={st} editable={editable}
                  onChange={(p) => patchStage(st.key, p)}
                  onMove={(d) => move(i, d)}
                  onRemove={() => { setStages(stages.filter((x) => x.key !== st.key)); touch(); }}
                />
              ))}
            </ol>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6">
          <Card>
            <h2 className="text-base font-semibold">How farmers will see it</h2>
            <p className="mt-0.5 mb-4 text-xs text-ink-mute">Stages ordered by start day.</p>
            {preview.length === 0 ? <p className="text-sm text-ink-mute">Add a stage to see the preview.</p> : (
              <ol className="relative space-y-4 border-l-2 border-leaf-100 pl-5">
                {preview.map((p, i) => (
                  <li key={i} className="relative">
                    <span className="absolute top-1 -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-leaf-500" />
                    <p className="text-xs font-medium text-leaf-700">{timingText(p)}</p>
                    <p className="font-medium">{p.name || "Untitled stage"}</p>
                    {p.allowed_inputs.length > 0 && <p className="mt-0.5 text-xs text-ink-mute">Allowed: {p.allowed_inputs.join(", ")}</p>}
                    {p.required_proof.photo_count > 0 && <p className="mt-0.5 text-xs text-bark-700">📷 {p.required_proof.photo_count} photo{p.required_proof.photo_count > 1 ? "s" : ""} required</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>

      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Start from a template" wide>
        <p className="mb-4">Templates are generic samples. {stages.length > 0 && <strong>Applying one replaces your current stages and grade spec.</strong>}</p>
        <div className="space-y-3">
          {(tpl.data?.templates ?? []).map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-4 rounded-lg border border-line p-4">
              <div>
                <p className="font-medium text-ink">{t.name}</p>
                <p className="mt-0.5 text-xs text-ink-mute">{t.stages.length} stages · includes example photo proof</p>
              </div>
              <Button size="sm" onClick={() => applyTemplate(t)}>Use</Button>
            </div>
          ))}
          {!tpl.data?.templates?.length && <p className="text-ink-mute">No templates available for this crop.</p>}
        </div>
      </Modal>
      {dialog}
    </>
  );
}

function StageCard({
  index, total, stage: st, editable, onChange, onMove, onRemove,
}: {
  index: number; total: number; stage: UiStage; editable: boolean;
  onChange: (p: Partial<UiStage>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const num = (v: string): number | null => (v === "" ? null : Number(v));
  const setBanned = (b: BannedInput[]) => onChange({ banned_inputs: b });
  return (
    <li className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 p-3">
        <button type="button" onClick={() => onChange({ open: !st.open })} aria-expanded={st.open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-50 font-display text-sm font-semibold text-leaf-700">{index + 1}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{st.name || <span className="text-ink-mute">Untitled stage</span>}</span>
            <span className="block text-xs text-ink-mute">{timingText(st)}</span>
          </span>
          <Icon name="chevronDown" className={cx("ml-auto shrink-0 text-ink-mute transition-transform", st.open && "rotate-180")} />
        </button>
        {editable && (
          <div className="flex shrink-0 items-center">
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move stage up"><Icon name="chevronDown" size={16} className="rotate-180" /></Button>
            <Button variant="ghost" size="sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move stage down"><Icon name="chevronDown" size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={onRemove} aria-label="Remove stage"><Icon name="trash" size={16} className="text-danger-600" /></Button>
          </div>
        )}
      </div>
      {st.open && (
        <div className="space-y-5 border-t border-line p-5">
          <TextField label="Stage name" required disabled={!editable} value={st.name} onChange={(e) => onChange({ name: e.target.value })} />

          <div className="grid gap-4 sm:grid-cols-4">
            <SelectField label="Timing" disabled={!editable} value={st.timing_type} onChange={(e) => {
              const t = e.target.value as Stage["timing_type"];
              onChange({ timing_type: t, repeat_interval_days: t === "recurring" ? st.repeat_interval_days || 7 : null, end_offset_days: t === "recurring" ? st.end_offset_days : null });
            }}>
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </SelectField>
            <TextField label="Start (day from planting)" type="number" disabled={!editable} value={st.start_offset_days} onChange={(e) => onChange({ start_offset_days: Number(e.target.value) })} />
            {st.timing_type === "recurring" && (
              <>
                <TextField label="Repeat every (days)" type="number" min={1} disabled={!editable} value={st.repeat_interval_days ?? ""} onChange={(e) => onChange({ repeat_interval_days: num(e.target.value) })} />
                <TextField label="Until day (optional)" type="number" disabled={!editable} value={st.end_offset_days ?? ""} onChange={(e) => onChange({ end_offset_days: num(e.target.value) })} />
              </>
            )}
          </div>

          <MultilingualField label="Instructions" multiline rows={4} disabled={!editable} value={st.instructions} onChange={(v) => onChange({ instructions: v })} error={!st.instructions.en.trim() ? "English instructions are required." : undefined} />

          <div className="grid gap-4 md:grid-cols-2">
            <LinesField label="Do" disabled={!editable} value={st.dos} onChange={(v) => onChange({ dos: v })} />
            <LinesField label="Don’t" disabled={!editable} value={st.donts} onChange={(v) => onChange({ donts: v })} />
          </div>

          <TextField label="Allowed inputs" disabled={!editable} value={st.allowedText} onChange={(e) => onChange({ allowedText: e.target.value })} hint="Comma-separated, e.g. compost, neem cake" />

          <div>
            <p className="mb-2 text-sm font-medium">Banned inputs</p>
            <div className="space-y-2">
              {st.banned_inputs.map((b, bi) => (
                <div key={bi} className="flex flex-wrap items-center gap-2">
                  <input aria-label="Banned input name" disabled={!editable} placeholder="Input name" value={b.name} onChange={(e) => setBanned(st.banned_inputs.map((x, xi) => (xi === bi ? { ...x, name: e.target.value } : x)))} className="h-10 min-w-40 flex-1 rounded-lg border border-line-strong px-3 text-sm disabled:bg-sunken" />
                  <label className="flex items-center gap-2 text-sm text-ink-soft">not within
                    <input aria-label="Days before harvest" type="number" min={0} disabled={!editable} value={b.min_days_before_harvest} onChange={(e) => setBanned(st.banned_inputs.map((x, xi) => (xi === bi ? { ...x, min_days_before_harvest: Number(e.target.value) } : x)))} className="h-10 w-20 rounded-lg border border-line-strong px-3 text-sm disabled:bg-sunken" />
                    days of harvest
                  </label>
                  {editable && <Button variant="ghost" size="sm" aria-label="Remove banned input" onClick={() => setBanned(st.banned_inputs.filter((_, xi) => xi !== bi))}><Icon name="x" size={16} /></Button>}
                </div>
              ))}
              {editable && <Button variant="ghost" size="sm" onClick={() => setBanned([...st.banned_inputs, { name: "", min_days_before_harvest: 30 }])}><Icon name="plus" size={14} /> Add banned input</Button>}
            </div>
          </div>

          <div className="rounded-lg bg-bark-50/70 p-4">
            <p className="text-sm font-semibold text-bark-700">Proof farmers must submit</p>
            <p className="mb-3 text-xs text-ink-soft">Shown in the Origo Field app when a farmer submits this stage for your review. Leave at 0 photos if no proof is needed (farmers still attach at least one photo).</p>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Photos required" type="number" min={0} max={10} disabled={!editable} value={st.required_proof.photo_count} onChange={(e) => onChange({ required_proof: { ...st.required_proof, photo_count: Number(e.target.value) } })} />
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-sm font-medium">What each photo shows</label>
                <textarea rows={3} disabled={!editable} value={st.required_proof.photo_descriptions.join("\n")} onChange={(e) => onChange({ required_proof: { ...st.required_proof, photo_descriptions: e.target.value.split("\n") } })} placeholder="One description per line" className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm disabled:bg-sunken" />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-sm font-medium">Quick answers to collect</label>
                <textarea rows={3} disabled={!editable} value={st.required_proof.quick_fields.join("\n")} onChange={(e) => onChange({ required_proof: { ...st.required_proof, quick_fields: e.target.value.split("\n") } })} placeholder="e.g. soil_ph_reading" className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm disabled:bg-sunken" />
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

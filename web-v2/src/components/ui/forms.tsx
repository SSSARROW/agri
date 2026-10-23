"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { LANGS, type LangCode } from "@/lib/constants";
import { cx } from "./primitives";

const CONTROL =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-mute transition-colors " +
  "focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/20 disabled:bg-sunken disabled:text-ink-mute";

export function Field({
  label, hint, error, required, children, htmlFor, className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export function TextField({ label, hint, error, required, wrapperClassName, className, id, ...rest }: TextFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fid} className={wrapperClassName}>
      <input
        id={fid}
        required={required}
        aria-invalid={!!error}
        className={cx(CONTROL, "h-10", error ? "border-danger-600" : "border-line-strong", className)}
        {...rest}
      />
    </Field>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextAreaField({ label, hint, error, required, className, id, rows = 4, ...rest }: TextAreaFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fid}>
      <textarea
        id={fid}
        rows={rows}
        aria-invalid={!!error}
        className={cx(CONTROL, "py-2.5", error ? "border-danger-600" : "border-line-strong", className)}
        {...rest}
      />
    </Field>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export function SelectField({ label, hint, error, required, wrapperClassName, className, id, children, ...rest }: SelectFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const control = (
    <select
      id={fid}
      aria-invalid={!!error}
      className={cx(CONTROL, "h-10 pr-8", error ? "border-danger-600" : "border-line-strong", className)}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fid} className={wrapperClassName}>
      {control}
    </Field>
  );
}

export function SearchInput({
  value, onChange, placeholder = "Search…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-mute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cx(CONTROL, "h-10 border-line-strong pl-9")}
      />
    </div>
  );
}

/** Multi-select rendered as toggleable chips, with optional select-all / clear. */
export function ChipSelect({
  label, options, value, onChange, hint, columns = false, bulk = false,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  hint?: ReactNode;
  columns?: boolean;
  bulk?: boolean;
}) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <fieldset>
      <div className="mb-1.5 flex items-center justify-between">
        <legend className="text-sm font-medium text-ink">{label}</legend>
        {bulk && (
          <span className="flex gap-3 text-xs">
            <button type="button" className="text-leaf-700 hover:underline" onClick={() => onChange([...options])}>Select all</button>
            <button type="button" className="text-ink-mute hover:underline" onClick={() => onChange([])}>Clear</button>
          </span>
        )}
      </div>
      <div className={cx("gap-2", columns ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "flex flex-wrap")}>
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={cx(
                "rounded-full border px-3 py-1 text-left text-[13px] transition-colors",
                on ? "border-leaf-600 bg-leaf-50 font-medium text-leaf-800" : "border-line-strong bg-surface text-ink-soft hover:bg-sunken",
              )}
            >
              {on && <span className="mr-1">✓</span>}
              {o}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-mute">{hint}</p>}
    </fieldset>
  );
}

export function Checkbox({
  checked, onChange, children, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2.5 text-sm text-ink", disabled && "cursor-not-allowed opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-leaf-600"
      />
      <span>{children}</span>
    </label>
  );
}

/* ── Multilingual editors ───────────────────────────────────────────────── */

export function LangTabs({ value, onChange, filled }: { value: LangCode; onChange: (l: LangCode) => void; filled?: Partial<Record<LangCode, boolean>> }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-sunken p-0.5" role="tablist" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="tab"
          aria-selected={value === l.code}
          onClick={() => onChange(l.code)}
          className={cx(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === l.code ? "bg-surface text-ink shadow-card" : "text-ink-mute hover:text-ink",
          )}
        >
          {l.label}
          {l.code !== "en" && filled?.[l.code] && <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />}
          {l.code === "en" && <span className="text-danger-600" title="Required">*</span>}
        </button>
      ))}
    </div>
  );
}

/** One text value per language; English is required, Sinhala and Tamil optional. */
export function MultilingualField({
  label, value, onChange, multiline, rows = 4, error, hint, disabled,
}: {
  label: string;
  value: { en?: string; si?: string; ta?: string };
  onChange: (v: { en: string; si: string; ta: string }) => void;
  multiline?: boolean;
  rows?: number;
  error?: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const [lang, setLang] = useState<LangCode>("en");
  const cur = { en: value.en ?? "", si: value.si ?? "", ta: value.ta ?? "" };
  const set = (v: string) => onChange({ ...cur, [lang]: v });
  const id = useId();
  const common = {
    id,
    value: cur[lang],
    disabled,
    onChange: (e: { target: { value: string } }) => set(e.target.value),
    placeholder: lang === "en" ? "Required" : "Optional — farmers using this language see it instead of English",
    lang: lang === "en" ? "en" : lang === "si" ? "si" : "ta",
    className: cx(CONTROL, error && lang === "en" ? "border-danger-600" : "border-line-strong"),
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <LangTabs value={lang} onChange={setLang} filled={{ si: !!cur.si, ta: !!cur.ta }} />
      </div>
      {multiline ? <textarea rows={rows} {...common} className={cx(common.className, "py-2.5")} /> : <input type="text" {...common} className={cx(common.className, "h-10")} />}
      {error ? <p role="alert" className="mt-1.5 text-xs text-danger-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-mute">{hint}</p> : null}
    </div>
  );
}

/** Bullet list editor: one item per line, per language. */
export function LinesField({
  label, value, onChange, hint, disabled,
}: {
  label: string;
  value: { en: string[]; si: string[]; ta: string[] };
  onChange: (v: { en: string[]; si: string[]; ta: string[] }) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const [lang, setLang] = useState<LangCode>("en");
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <LangTabs value={lang} onChange={setLang} filled={{ si: value.si.length > 0, ta: value.ta.length > 0 }} />
      </div>
      <textarea
        id={id}
        rows={4}
        disabled={disabled}
        value={(value[lang] ?? []).join("\n")}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value.split("\n") })}
        onBlur={() => onChange({ ...value, [lang]: (value[lang] ?? []).map((s) => s.trim()).filter(Boolean) })}
        placeholder="One item per line"
        className={cx(CONTROL, "border-line-strong py-2.5")}
      />
      {hint && <p className="mt-1.5 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Field, ImageOption, Row } from "@/lib/dashboard/website-config";
import { deleteWebsiteRow, saveWebsiteRow } from "./actions";

type Values = Record<string, unknown>;
type Nudge = { enabled: boolean; delay_seconds: number; scroll_ratio: number; max_per_session: number };

const blank = (fields: Field[]): Values =>
  Object.fromEntries(
    fields.map((f) => [f.name, f.type === "bool" ? f.name === "published" : f.type === "lines" || f.type === "csv" || f.type === "faqs" ? [] : f.name === "rating" ? 5 : f.name === "sort_order" ? 0 : ""]),
  );

/** A list of editable website entries. Each opens into a form; saving refreshes that part of the public site. */
export function CollectionEditor({ collectionKey, fields, rows, canAdd, studios, images, single }: {
  collectionKey: string;
  fields: Field[];
  rows: Row[];
  canAdd: boolean;
  studios: { id: string; label: string }[];
  images: ImageOption[];
  single?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3">
      {canAdd && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-charcoal px-4 text-sm text-ivory">
          <Plus className="size-4" strokeWidth={1.75} /> Add new
        </button>
      )}
      {adding && (
        <Entry collectionKey={collectionKey} fields={fields} row={{ id: "", label: "New entry", values: blank(fields) }} isNew open studios={studios} images={images} onDone={() => setAdding(false)} />
      )}
      {rows.map((r) => (
        <Entry key={r.id} collectionKey={collectionKey} fields={fields} row={r} open={single} studios={studios} images={images} />
      ))}
      {rows.length === 0 && !adding && <p className="py-10 text-center text-sm text-stone">Nothing here yet.</p>}
    </div>
  );
}

function Entry({ collectionKey, fields, row, isNew, open, studios, images, onDone }: {
  collectionKey: string;
  fields: Field[];
  row: Row;
  isNew?: boolean;
  open?: boolean;
  studios: { id: string; label: string }[];
  images: ImageOption[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(row.values);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveWebsiteRow(collectionKey, isNew ? null : row.id, values);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: "Saved. The website is updated." });
      router.refresh();
      onDone?.();
    });
  const remove = () =>
    start(async () => {
      if (!confirm(`Delete “${row.label}”? This can't be undone.`)) return;
      const r = await deleteWebsiteRow(collectionKey, row.id);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else router.refresh();
    });

  const flags = [values.published === false && "Hidden", values.is_sample === true && "Sample", values.featured === true && "Featured", values.highlight === true && "Highlighted", values.public_profile === false && "No profile page"].filter(Boolean) as string[];

  return (
    <details open={open || isNew} className="group rounded-2xl border border-line bg-white [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{row.label}</span>
          {row.sub && <span className="block truncate text-xs text-stone">{row.sub}</span>}
        </span>
        {flags.map((f) => <span key={f} className="hidden rounded-full bg-linen px-2.5 py-0.5 text-[0.6875rem] text-stone sm:inline">{f}</span>)}
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-stone transition-transform group-open:rotate-180" strokeWidth={1.5} />
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2"
      >
        {fields.map((f) => (
          <FieldInput key={f.name} f={f} value={values[f.name]} onChange={(v) => set(f.name, v)} studios={studios} images={images} />
        ))}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={pending} className="min-h-10 rounded-full bg-charcoal px-5 text-sm text-ivory disabled:opacity-50">{pending ? "Saving…" : isNew ? "Add" : "Save"}</button>
          {isNew && <button type="button" onClick={onDone} className="min-h-10 rounded-full px-4 text-sm text-stone ring-1 ring-line">Cancel</button>}
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
          {!isNew && fields.some((f) => f.name === "is_sample") && (
            <button type="button" onClick={remove} disabled={pending} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-danger hover:bg-danger/5">
              <Trash2 className="size-4" strokeWidth={1.5} /> Delete
            </button>
          )}
        </div>
      </form>
    </details>
  );
}

function FieldInput({ f, value, onChange, studios, images }: { f: Field; value: unknown; onChange: (v: unknown) => void; studios: { id: string; label: string }[]; images: ImageOption[] }) {
  const id = useId();
  const wide = ["textarea", "lines", "faqs", "nudge", "image"].includes(f.type) || f.name === "is_sample";
  const label = (
    <span className="label">
      {f.label}
      {f.required && <span className="text-danger"> *</span>}
    </span>
  );
  const hint = f.hint && <span className="mt-1 block text-xs text-stone">{f.hint}</span>;
  const box = wide ? "sm:col-span-2" : "";

  switch (f.type) {
    case "bool":
      return (
        <label className={`flex items-center gap-3 text-sm ${box}`}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-charcoal" />
          {f.label}
        </label>
      );
    case "textarea":
      return (
        <label htmlFor={id} className={`block ${box}`}>
          {label}
          <textarea id={id} value={String(value ?? "")} maxLength={f.max} onChange={(e) => onChange(e.target.value)} className="field min-h-28" />
          {hint}
        </label>
      );
    case "lines":
    case "csv": {
      const arr = (value as string[]) ?? [];
      const sep = f.type === "lines" ? "\n" : ", ";
      return (
        <label htmlFor={id} className={`block ${box}`}>
          {label}
          {f.type === "lines" ? (
            <textarea id={id} defaultValue={arr.join(sep)} onChange={(e) => onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} className="field min-h-28" />
          ) : (
            <input id={id} defaultValue={arr.join(sep)} onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} className="field" />
          )}
          {hint}
        </label>
      );
    }
    case "select":
    case "studio": {
      const opts = f.type === "studio" ? studios.map((s) => ({ value: s.id, label: s.label })) : f.options!;
      return (
        <label htmlFor={id} className={`block ${box}`}>
          {label}
          <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="field">
            {!f.required && <option value="">{f.type === "studio" ? "All studios" : "—"}</option>}
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      );
    }
    case "image":
      return <ImagePicker id={id} label={label} f={f} value={String(value ?? "")} onChange={onChange} images={images} />;
    case "faqs":
      return <FaqsInput label={label} hint={hint} value={(value as { q: string; a: string }[]) ?? []} onChange={onChange} />;
    case "nudge":
      return <NudgeInput label={label} value={value as Nudge} onChange={onChange} />;
    default:
      return (
        <label htmlFor={id} className={`block ${box}`}>
          {label}
          <input
            id={id}
            type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
            value={value == null ? "" : String(value)}
            min={f.min}
            max={f.type === "number" ? f.max : undefined}
            maxLength={f.type === "text" ? f.max : undefined}
            onChange={(e) => onChange(e.target.value)}
            className="field"
          />
          {hint}
        </label>
      );
  }
}

function ImagePicker({ id, label, f, value, onChange, images }: { id: string; label: React.ReactNode; f: Field; value: string; onChange: (v: string) => void; images: ImageOption[] }) {
  const opts = f.sections?.length ? images.filter((i) => f.sections!.includes(i.id.split(".")[0])) : images;
  const current = images.find((i) => i.id === value);
  return (
    <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
      <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-sand">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element -- a small dashboard preview; the site itself uses next/image
          <img src={current.file} alt={current.alt} className="size-full object-cover" />
        )}
      </div>
      <label htmlFor={id} className="block min-w-0 flex-1">
        {label}
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="field">
          {!f.required && <option value="">No photo</option>}
          {opts.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.alt.slice(0, 60)}</option>)}
        </select>
        <span className="mt-1 block text-xs text-stone">Photos come from the site&apos;s image library (public/images). Add your own shoot there to see it here.</span>
      </label>
    </div>
  );
}

function FaqsInput({ label, hint, value, onChange }: { label: React.ReactNode; hint: React.ReactNode; value: { q: string; a: string }[]; onChange: (v: unknown) => void }) {
  const update = (i: number, k: "q" | "a", v: string) => onChange(value.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend>{label}</legend>
      {hint}
      <ol className="mt-3 grid gap-3">
        {value.map((x, i) => (
          <li key={i} className="grid gap-2 rounded-xl bg-linen/50 p-3">
            <input aria-label={`Question ${i + 1}`} value={x.q} onChange={(e) => update(i, "q", e.target.value)} placeholder="Question" className="field" />
            <textarea aria-label={`Answer ${i + 1}`} value={x.a} onChange={(e) => update(i, "a", e.target.value)} placeholder="Answer" className="field min-h-20" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="w-fit text-xs text-danger">Remove</button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onChange([...value, { q: "", a: "" }])} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm ring-1 ring-line">
        <Plus className="size-4" strokeWidth={1.5} /> Add a question
      </button>
    </fieldset>
  );
}

function NudgeInput({ label, value, onChange }: { label: React.ReactNode; value: Nudge; onChange: (v: unknown) => void }) {
  const v = value ?? { enabled: true, delay_seconds: 20, scroll_ratio: 0.5, max_per_session: 2 };
  const set = (k: keyof Nudge, x: unknown) => onChange({ ...v, [k]: x });
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-xl bg-linen/50 p-4 sm:col-span-2 sm:grid-cols-3">
      <legend className="mb-2">{label}</legend>
      <label className="flex items-center gap-3 text-sm sm:col-span-3">
        <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-charcoal" />
        Let the concierge greet visitors with a short, helpful message
      </label>
      <label className="block">
        <span className="label">After (seconds)</span>
        <input type="number" min={5} max={300} value={v.delay_seconds} onChange={(e) => set("delay_seconds", Number(e.target.value))} className="field" />
      </label>
      <label className="block">
        <span className="label">Or after scrolling (%)</span>
        <input type="number" min={10} max={100} step={5} value={Math.round(v.scroll_ratio * 100)} onChange={(e) => set("scroll_ratio", Number(e.target.value) / 100)} className="field" />
      </label>
      <label className="block">
        <span className="label">At most per visit</span>
        <input type="number" min={0} max={5} value={v.max_per_session} onChange={(e) => set("max_per_session", Number(e.target.value))} className="field" />
      </label>
    </fieldset>
  );
}

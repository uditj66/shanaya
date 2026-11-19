"use client";
import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Field, ImageOption, Row } from "@/lib/dashboard/website-config";
import { Button, Card, EmptyState, Input, Label, Select, Textarea, cn } from "@/components/admin/kit";
import { ConfirmAction } from "@/components/admin/confirm-action";
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
        <Button type="button" onClick={() => setAdding(true)} className="w-fit">
          <Plus aria-hidden /> Add new
        </Button>
      )}
      {adding && (
        <Entry collectionKey={collectionKey} fields={fields} row={{ id: "", label: "New entry", values: blank(fields) }} isNew open studios={studios} images={images} onDone={() => setAdding(false)} />
      )}
      {rows.map((r) => (
        <Entry key={r.id} collectionKey={collectionKey} fields={fields} row={r} open={single} studios={studios} images={images} />
      ))}
      {rows.length === 0 && !adding && (
        <Card className="py-0">
          <EmptyState title="Nothing here yet" />
        </Card>
      )}
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
  const [pending, start] = useTransition();
  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));

  const save = () =>
    start(async () => {
      const r = await saveWebsiteRow(collectionKey, isNew ? null : row.id, values);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Saved. The website is updated.");
      router.refresh();
      onDone?.();
    });
  const remove = async () => {
    const r = await deleteWebsiteRow(collectionKey, row.id);
    if (!r.ok) return r.error;
    router.refresh();
  };

  const flags = [values.published === false && "Hidden", values.is_sample === true && "Sample", values.featured === true && "Featured", values.highlight === true && "Highlighted", values.public_profile === false && "No profile page"].filter(Boolean) as string[];

  return (
    <Card className="gap-0 py-0">
      <details open={open || isNew} className="group [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{row.label}</span>
            {row.sub && <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>}
          </span>
          {flags.map((f) => (
            <span key={f} className="hidden rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">{f}</span>
          ))}
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="grid gap-4 border-t px-5 py-5 sm:grid-cols-2"
        >
          {fields.map((f) => (
            <FieldInput key={f.name} f={f} value={values[f.name]} onChange={(v) => set(f.name, v)} studios={studios} images={images} />
          ))}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button disabled={pending}>{pending ? "Saving…" : isNew ? "Add" : "Save"}</Button>
            {isNew && (
              <Button type="button" variant="outline" onClick={onDone}>
                Cancel
              </Button>
            )}
            {!isNew && fields.some((f) => f.name === "is_sample") && (
              <ConfirmAction
                destructive
                title={`Delete “${row.label}”?`}
                description="This can't be undone."
                confirmLabel="Delete"
                onConfirm={remove}
                trigger={
                  <Button type="button" variant="ghost" disabled={pending} className="ml-auto text-destructive hover:text-destructive">
                    <Trash2 aria-hidden /> Delete
                  </Button>
                }
              />
            )}
          </div>
        </form>
      </details>
    </Card>
  );
}

/** Label above a control (htmlFor-linked), with an optional hint under it. */
function Labelled({ id, label, hint, className, children }: { id?: string; label: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint}
    </div>
  );
}

function FieldInput({ f, value, onChange, studios, images }: { f: Field; value: unknown; onChange: (v: unknown) => void; studios: { id: string; label: string }[]; images: ImageOption[] }) {
  const id = useId();
  const wide = ["textarea", "lines", "faqs", "nudge", "image"].includes(f.type) || f.name === "is_sample";
  const label = (
    <span>
      {f.label}
      {f.required && <span className="text-destructive"> *</span>}
    </span>
  );
  const hint = f.hint && <span className="text-xs text-muted-foreground">{f.hint}</span>;
  const box = wide ? "sm:col-span-2" : "";

  switch (f.type) {
    case "bool":
      return (
        <Label className={cn("font-normal", box)}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />
          {f.label}
        </Label>
      );
    case "textarea":
      return (
        <Labelled id={id} label={label} hint={hint} className={box}>
          <Textarea id={id} value={String(value ?? "")} maxLength={f.max} onChange={(e) => onChange(e.target.value)} className="min-h-28" />
        </Labelled>
      );
    case "lines":
    case "csv": {
      const arr = (value as string[]) ?? [];
      const sep = f.type === "lines" ? "\n" : ", ";
      return (
        <Labelled id={id} label={label} hint={hint} className={box}>
          {f.type === "lines" ? (
            <Textarea id={id} defaultValue={arr.join(sep)} onChange={(e) => onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} className="min-h-28" />
          ) : (
            <Input id={id} defaultValue={arr.join(sep)} onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
          )}
        </Labelled>
      );
    }
    case "select":
    case "studio": {
      const opts = f.type === "studio" ? studios.map((s) => ({ value: s.id, label: s.label })) : f.options!;
      return (
        <Labelled id={id} label={label} className={box}>
          <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {!f.required && <option value="">{f.type === "studio" ? "All studios" : "—"}</option>}
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Labelled>
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
        <Labelled id={id} label={label} hint={hint} className={box}>
          <Input
            id={id}
            type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
            value={value == null ? "" : String(value)}
            min={f.min}
            max={f.type === "number" ? f.max : undefined}
            maxLength={f.type === "text" ? f.max : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
        </Labelled>
      );
  }
}

function ImagePicker({ id, label, f, value, onChange, images }: { id: string; label: ReactNode; f: Field; value: string; onChange: (v: string) => void; images: ImageOption[] }) {
  const opts = f.sections?.length ? images.filter((i) => f.sections!.includes(i.id.split(".")[0])) : images;
  const current = images.find((i) => i.id === value);
  return (
    <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
      <div className="size-24 shrink-0 overflow-hidden rounded-md border bg-muted">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element -- a small dashboard preview; the site itself uses next/image
          <img src={current.file} alt={current.alt} className="size-full object-cover" />
        )}
      </div>
      <Labelled
        id={id}
        label={label}
        className="min-w-0 flex-1"
        hint={<span className="text-xs text-muted-foreground">Photos come from the site&apos;s image library (public/images). Add your own shoot there to see it here.</span>}
      >
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">No photo</option>}
          {opts.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.alt.slice(0, 60)}</option>)}
        </Select>
      </Labelled>
    </div>
  );
}

function FaqsInput({ label, hint, value, onChange }: { label: ReactNode; hint: ReactNode; value: { q: string; a: string }[]; onChange: (v: unknown) => void }) {
  const update = (i: number, k: "q" | "a", v: string) => onChange(value.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <div className="mt-1">{hint}</div>}
      <ol className="mt-3 grid gap-3">
        {value.map((x, i) => (
          <li key={i} className="grid gap-2 rounded-lg border bg-muted/50 p-3">
            <Input aria-label={`Question ${i + 1}`} value={x.q} onChange={(e) => update(i, "q", e.target.value)} placeholder="Question" />
            <Textarea aria-label={`Answer ${i + 1}`} value={x.a} onChange={(e) => update(i, "a", e.target.value)} placeholder="Answer" className="min-h-20" />
            <Button type="button" variant="ghost" size="xs" onClick={() => onChange(value.filter((_, j) => j !== i))} className="w-fit text-destructive hover:text-destructive">
              Remove
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { q: "", a: "" }])} className="mt-3">
        <Plus aria-hidden /> Add a question
      </Button>
    </fieldset>
  );
}

function NudgeInput({ label, value, onChange }: { label: ReactNode; value: Nudge; onChange: (v: unknown) => void }) {
  const v = value ?? { enabled: true, delay_seconds: 20, scroll_ratio: 0.5, max_per_session: 2 };
  const set = (k: keyof Nudge, x: unknown) => onChange({ ...v, [k]: x });
  const ids = useId();
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-lg border bg-muted/50 p-4 sm:col-span-2 sm:grid-cols-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Label className="font-normal sm:col-span-3">
        <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-primary" />
        Let the concierge greet visitors with a short, helpful message
      </Label>
      <Labelled id={`${ids}-d`} label="After (seconds)">
        <Input id={`${ids}-d`} type="number" min={5} max={300} value={v.delay_seconds} onChange={(e) => set("delay_seconds", Number(e.target.value))} />
      </Labelled>
      <Labelled id={`${ids}-s`} label="Or after scrolling (%)">
        <Input id={`${ids}-s`} type="number" min={10} max={100} step={5} value={Math.round(v.scroll_ratio * 100)} onChange={(e) => set("scroll_ratio", Number(e.target.value) / 100)} />
      </Labelled>
      <Labelled id={`${ids}-m`} label="At most per visit">
        <Input id={`${ids}-m`} type="number" min={0} max={5} value={v.max_per_session} onChange={(e) => set("max_per_session", Number(e.target.value))} />
      </Labelled>
    </fieldset>
  );
}

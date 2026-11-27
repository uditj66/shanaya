"use client";
import { useActionState } from "react";
import Link from "next/link";
import * as m from "motion/react-m";
import { submitEnquiry, type EnquiryKind, type EnquiryState } from "@/app/(site)/enquiries";
import { siteHref } from "@/lib/brand/href";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form-controls";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";

export type FieldDef =
  | { name: string; label: string; type: "text" | "tel" | "email" | "number"; autoComplete?: string; placeholder?: string; optional?: boolean; wide?: boolean; inputMode?: "numeric" | "tel" }
  | { name: string; label: string; type: "textarea"; placeholder?: string; optional?: boolean; wide?: boolean }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; optional?: boolean; wide?: boolean }
  | { name: string; label: string; type: "chips"; options: { value: string; label: string }[]; wide?: boolean };

/** Accessible, progressively enhanced form (works before JS loads) posting to the enquiry Server Action. */
export function EnquiryForm({ brand, kind, fields, submitLabel }: { brand: string; kind: EnquiryKind; fields: FieldDef[]; submitLabel: string }) {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(submitEnquiry, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};

  if (state?.ok) {
    return (
      <m.div role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT_SOFT }} className="rounded-2xl border border-line bg-white/60 p-8 md:p-10">
        <p className="eyebrow">Received</p>
        <p className="display-cut mt-4 text-h2">{state.message}</p>
      </m.div>
    );
  }

  const describe = (n: string) => (fe[n] ? { "aria-invalid": true as const, "aria-describedby": `e-${kind}-${n}` } : {});
  const err = (n: string) => (fe[n] ? <p id={`e-${kind}-${n}`} className="text-[0.8125rem] text-danger">{fe[n]}</p> : null);

  return (
    <form action={action} noValidate className="grid gap-6 md:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="brand" value={brand} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {state && !state.ok && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger md:col-span-2">{state.error}</p>
      )}
      {fields.map((f) => {
        const id = `${kind}-${f.name}`;
        return (
          <div key={f.name} className={cn("grid content-start gap-2", (f.wide || f.type === "textarea" || f.type === "chips") && "md:col-span-2")}>
            {f.type === "chips" ? (
              <fieldset>
                <legend className="text-[0.8125rem] font-medium tracking-[0.02em]">{f.label}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.options.map((o, i) => (
                    <label key={o.value} className="cursor-pointer">
                      <input type="radio" name={f.name} value={o.value} defaultChecked={values[f.name] ? values[f.name] === o.value : i === 1} className="peer sr-only" />
                      <span className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm transition-colors peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-ivory peer-focus-visible:ring-4 peer-focus-visible:ring-brass/20 hover:border-champagne">
                        {o.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <Label htmlFor={id}>
                  {f.label} {f.optional && <span className="font-normal text-stone">(optional)</span>}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea id={id} name={f.name} defaultValue={values[f.name]} placeholder={f.placeholder} maxLength={1000} {...describe(f.name)} />
                ) : f.type === "select" ? (
                  <select id={id} name={f.name} defaultValue={values[f.name] ?? ""} className="h-12 w-full rounded-lg border border-line bg-white/80 px-4 text-[0.9375rem] focus-visible:border-brass focus-visible:ring-4 focus-visible:ring-brass/12 focus-visible:outline-none" {...describe(f.name)}>
                    <option value="">{f.optional ? "No preference" : "Choose…"}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input id={id} name={f.name} defaultValue={values[f.name]} type={f.type} autoComplete={f.autoComplete} placeholder={f.placeholder} inputMode={f.inputMode} {...describe(f.name)} />
                )}
              </>
            )}
            {err(f.name)}
          </div>
        );
      })}
      <div className="grid gap-2 md:col-span-2">
        <div className="flex items-start gap-3">
          <Checkbox id={`${kind}-consent`} name="consent" className="mt-0.5" {...describe("consent")} />
          <Label htmlFor={`${kind}-consent`} className="font-normal leading-relaxed text-stone">
            I agree that Lumière may contact me about this. See our <Link href={siteHref("/privacy")} className="underline underline-offset-4">privacy notice</Link>.
          </Label>
        </div>
        {err("consent")}
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : submitLabel}</Button>
      </div>
    </form>
  );
}

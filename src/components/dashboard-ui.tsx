// Dashboard building blocks in the Lumière design language (same tokens and type as the brand site, denser for daily use).
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnVariant = "primary" | "ghost" | "danger" | "outline";
const btn = (v: BtnVariant = "primary") =>
  cx(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium tracking-[0.01em] transition-[background-color,border-color,color,box-shadow] duration-[var(--duration-ui)] disabled:opacity-50 cursor-pointer [&_svg]:size-4",
    v === "primary" && "bg-charcoal text-ivory hover:bg-[#3a3230]",
    v === "outline" && "border border-line bg-white/70 text-charcoal hover:border-champagne hover:bg-white",
    v === "ghost" && "text-stone hover:bg-linen hover:text-charcoal",
    v === "danger" && "text-danger hover:bg-danger/10",
  );

export function Button({ variant, className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button {...p} className={cx(btn(variant), className)} />;
}

// Generic so typed routes check every href (e.g. `/w/${slug}`) at the call site.
export function ButtonLink<T extends string>({ variant, className, ...p }: ComponentProps<typeof Link<T>> & { variant?: BtnVariant }) {
  return <Link {...p} className={cx(btn(variant), className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-2xl border border-line bg-white/75 p-5 shadow-[0_1px_2px_rgb(43_37_35/0.04)]", className)} />;
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display-cut text-[2rem] leading-tight md:text-[2.375rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-stone">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone">{hint}</span>}
    </label>
  );
}

export function Input(p: ComponentProps<"input">) {
  return <input {...p} className={cx("field", p.className)} />;
}
export function Textarea(p: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx("field min-h-24", p.className)} />;
}
export function Select(p: ComponentProps<"select">) {
  return <select {...p} className={cx("field", p.className)} />;
}

const tones: Record<string, string> = {
  confirmed: "bg-success/10 text-success",
  completed: "bg-linen text-charcoal",
  cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger",
  phone: "bg-blush text-blush-ink",
  web: "bg-[#e6eef0] text-[#355a66]",
  staff: "bg-linen text-stone",
  booked: "bg-success/10 text-success",
  callback: "bg-blush text-blush-ink",
  open: "bg-blush text-blush-ink",
  done: "bg-linen text-stone",
  new: "bg-blush text-blush-ink",
  contacted: "bg-[#efe6d6] text-brass-ink",
  converted: "bg-success/10 text-success",
  closed: "bg-linen text-stone",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium capitalize", tones[tone ?? String(children)] ?? "bg-linen text-stone")}>
      {String(children).replace("_", " ")}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-12 text-center text-sm text-stone">{children}</p>;
}

export function Stat({ label, value, hint, trend }: { label: string; value: ReactNode; hint?: string; trend?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-[0.75rem] font-medium tracking-[0.04em] text-stone">{label}</p>
      <p className="display-cut mt-2 text-[2rem] leading-none tabular-nums">{value}</p>
      {(hint || trend) && (
        <p className="mt-2 flex items-center gap-2 text-xs text-stone">
          {trend}
          {hint}
        </p>
      )}
    </Card>
  );
}

export const money = (n: number | string, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n));

export { cx };

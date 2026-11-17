import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnVariant = "primary" | "ghost" | "danger" | "outline";
const btn = (v: BtnVariant = "primary") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 cursor-pointer",
    v === "primary" && "bg-ink text-ivory hover:bg-black",
    v === "outline" && "border border-line bg-white hover:border-gold",
    v === "ghost" && "text-muted hover:bg-cream hover:text-ink",
    v === "danger" && "text-danger hover:bg-danger/10",
  );

export function Button({ variant, className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button {...p} className={cx(btn(variant), className)} />;
}

export function ButtonLink({ variant, className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link {...p} className={cx(btn(variant), className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(42,34,32,0.04)]", className)} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
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
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
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
  confirmed: "bg-sage/15 text-sage",
  completed: "bg-ink/10 text-ink",
  cancelled: "bg-danger/10 text-danger",
  no_show: "bg-danger/10 text-danger",
  phone: "bg-gold/15 text-gold-dark",
  web: "bg-rose/15 text-rose",
  staff: "bg-cream text-muted",
  booked: "bg-sage/15 text-sage",
  callback: "bg-gold/15 text-gold-dark",
  open: "bg-gold/15 text-gold-dark",
  done: "bg-cream text-muted",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", tones[tone ?? String(children)] ?? "bg-cream text-muted")}>
      {String(children).replace("_", " ")}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export const money = (n: number | string, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n));

export { cx };

// The team app's shared building blocks. Every dashboard page builds from these plus the
// shadcn primitives in ./ui. Server-safe: no client hooks here (client pieces live in their own files).
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Route } from "next";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "./ui/native-select";
import { Label } from "./ui/label";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "./ui/empty";

export { Button, buttonVariants, Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction, Input, Textarea, Label };
export { NativeSelect as Select, NativeSelectOption as Option, NativeSelectOptGroup as OptGroup };
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./ui/table";

/** A Link styled as a button. Generic so typed routes check every href at the call site. */
export function ButtonLink<T extends string>({
  variant,
  size,
  className,
  ...p
}: ComponentProps<typeof Link<T>> & VariantProps<typeof buttonVariants>) {
  return <Link {...p} className={cn(buttonVariants({ variant, size }), className)} />;
}

/** Title row at the top of every page: title, one-line description, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A titled card section: header (title, description, action) and body. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      {(title || action) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

/** KPI tile. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  trend?: ReactNode;
}) {
  return (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardDescription className="flex items-center justify-between gap-2 font-medium">
          {label}
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        </CardDescription>
        <CardTitle className="tabular text-2xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      {(hint || trend) && (
        <CardContent className="flex items-center gap-2 px-5 text-xs text-muted-foreground">
          {trend}
          {hint}
        </CardContent>
      )}
    </Card>
  );
}

/** Label + control + hint, stacked. Wraps in <label> so clicking the text focuses the control. */
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Nothing-here message, optionally with an icon and an action. */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("py-10 md:py-12", className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon aria-hidden />
          </EmptyMedia>
        )}
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

const tone = cva("inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize", {
  variants: {
    tone: {
      success: "bg-success/12 text-success",
      danger: "bg-destructive/12 text-destructive",
      warning: "bg-warning/15 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]",
      info: "bg-chart-2/12 text-chart-2",
      brand: "bg-primary/12 text-primary",
      neutral: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export type Tone = NonNullable<VariantProps<typeof tone>["tone"]>;

// Every status word used across bookings, leads, callbacks, payments, gift cards and members.
const STATUS_TONES: Record<string, Tone> = {
  confirmed: "success",
  booked: "success",
  converted: "success",
  paid: "success",
  captured: "success",
  active: "success",
  completed: "neutral",
  done: "neutral",
  closed: "neutral",
  redeemed: "neutral",
  expired: "neutral",
  staff: "neutral",
  cancelled: "danger",
  no_show: "danger",
  failed: "danger",
  refunded: "warning",
  pending: "warning",
  created: "warning",
  contacted: "warning",
  open: "brand",
  new: "brand",
  callback: "brand",
  phone: "brand",
  web: "info",
  website: "info",
  chat: "info",
};

/** Status pill. Pass a status word (tone is looked up) or force a tone. */
export function StatusBadge({ status, tone: forced, children, className }: { status?: string | null; tone?: Tone; children?: ReactNode; className?: string }) {
  const key = String(status ?? "").toLowerCase();
  return <span className={cn(tone({ tone: forced ?? STATUS_TONES[key] ?? "neutral" }), className)}>{children ?? key.replace(/_/g, " ")}</span>;
}

/** A row of filters above a table (GET form; values live in the URL). */
export function FilterBar({ children, className, ...p }: ComponentProps<"form">) {
  return (
    <form {...p} className={cn("mb-4 flex flex-wrap items-end gap-2 [&_[data-slot=native-select-wrapper]]:w-auto", className)}>
      {children}
    </form>
  );
}

/** Segmented link control for URL-driven views and filters (date range, tabs, sort). Zero client JS. */
export function SegmentedNav({
  label,
  items,
  className,
}: {
  label: string;
  items: { href: Route; label: ReactNode; active: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1", className)}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={cn(
            "inline-flex h-7 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            it.active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** Wraps a <Table> in a bordered card that scrolls sideways on small screens. */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border bg-card shadow-sm [&_[data-slot=table-container]]:overflow-x-auto", className)}>{children}</div>;
}

/** Thin horizontal bar for simple share-of-total lists (top treatments, occupancy). */
export function Meter({ pct, color = "var(--chart-1)", className }: { pct: number; color?: string; className?: string }) {
  return (
    <div className={cn("mt-1.5 h-1.5 rounded-full bg-muted", className)} aria-hidden>
      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export const money = (n: number | string, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n));

export { cn };

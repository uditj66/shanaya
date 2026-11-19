"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Activity, CalendarDays, ChartLine, Globe, Inbox, LayoutDashboard, ListChecks, Menu, PhoneCall, Settings, Sparkles, UserRound, Users, X,
} from "lucide-react";
import { switchSalon } from "./switch-action";

const ICONS = { LayoutDashboard, CalendarDays, ListChecks, Users, Inbox, PhoneCall, Globe, ChartLine, Sparkles, UserRound, Settings, Activity };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; tone?: "accent" | "danger" };
export type NavGroup = { label: string; items: NavItem[] };
type StudioOption = { id: string; label: string; city: string };

function Links({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Dashboard" className="grid gap-6">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-stone/80">{g.label}</p>
          <ul className="mt-2 grid gap-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon];
              const on = active(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href as Route}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${on ? "bg-charcoal text-ivory" : "text-stone hover:bg-linen hover:text-charcoal"}`}
                  >
                    <Icon className="size-[1.0625rem] shrink-0" strokeWidth={1.5} aria-hidden />
                    <span className="flex-1 truncate">{it.label}</span>
                    {!!it.badge && (
                      <span className={`min-w-5 rounded-full px-1.5 text-center text-[0.6875rem] font-semibold leading-5 ${on ? "bg-ivory text-charcoal" : it.tone === "danger" ? "bg-danger text-white" : "bg-blush text-blush-ink"}`}>
                        {it.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function StudioSwitcher({ studios, current, allowAll, allCount }: { studios: StudioOption[]; current: string; allowAll: boolean; allCount: number }) {
  const [pending, start] = useTransition();
  const cities = [...new Set(studios.map((s) => s.city))];
  return (
    <div>
      <label htmlFor="studio-switcher" className="sr-only">Studio</label>
      <select
        id="studio-switcher"
        value={current}
        disabled={pending}
        onChange={(e) => start(() => switchSalon(e.target.value))}
        className="w-full cursor-pointer rounded-xl border border-line bg-white/80 px-3 py-2.5 text-sm font-medium outline-none hover:border-champagne focus:border-brass disabled:opacity-60"
      >
        {allowAll && <option value="all">All studios ({allCount})</option>}
        {cities.map((c) => (
          <optgroup key={c} label={c}>
            {studios.filter((s) => s.city === c).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function DashboardNav({
  brand, groups, studios, current, allowAll, user, signOut,
}: {
  brand: string;
  groups: NavGroup[];
  studios: StudioOption[];
  current: string;
  allowAll: boolean;
  user: string;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const header = (
    <div className="px-3">
      <p className="display-cut text-[1.625rem] leading-none">{brand}</p>
      <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.2em] text-brass-ink">Studio dashboard</p>
    </div>
  );
  const footer = (
    <div className="border-t border-line px-3 pt-4 text-xs text-stone">
      <p className="truncate">{user}</p>
      <form action={signOut}>
        <button className="mt-1 min-h-8 hover:text-charcoal">Sign out</button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-ivory/80 px-3 py-6 lg:flex">
        {header}
        <StudioSwitcher studios={studios} current={current} allowAll={allowAll} allCount={studios.length} />
        <div className="flex-1">
          <Links groups={groups} />
        </div>
        {footer}
      </aside>

      {/* Phone / tablet top bar + slide-out menu */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ivory/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <p className="display-cut text-xl">{brand}</p>
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-linen" aria-label="Open menu" aria-expanded={open}>
          <Menu className="size-5" strokeWidth={1.5} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-charcoal/25" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-ivory px-3 py-5 shadow-lift">
            <div className="flex items-start justify-between">
              {header}
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-linen" aria-label="Close menu">
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            <StudioSwitcher studios={studios} current={current} allowAll={allowAll} allCount={studios.length} />
            <div className="flex-1">
              <Links groups={groups} onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      )}
    </>
  );
}

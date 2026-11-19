import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireArea } from "@/lib/session";
import { loadCalendar } from "@/lib/dashboard/calendar";
import { addDays, isDate, todayIn, zonedToDate } from "@/lib/time";
import { ButtonLink, Card, PageHeader } from "@/components/dashboard-ui";
import { CalendarBoard } from "./board";

type SP = { date?: string; view?: string; staff?: string };

async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireArea("calendar");
  const sp = await searchParams;
  const tz = s.salon.timezone;
  const view = sp.view === "week" || s.role === "stylist" ? "week" : "day";
  const date = isDate(sp.date) ? sp.date : todayIn(tz);
  const cal = await loadCalendar(s, { date, view, staffId: sp.staff ?? null });
  const step = view === "week" ? 7 : 1;
  const q = (patch: Partial<SP>) => {
    const p = new URLSearchParams({ date, view, ...(cal.focus && view === "week" ? { staff: cal.focus } : {}), ...patch } as Record<string, string>);
    return `/dashboard/calendar?${p}` as Route;
  };
  const label =
    view === "week"
      ? `${formatInTimeZone(zonedToDate(date, "12:00", tz), tz, "d MMM")} – ${formatInTimeZone(zonedToDate(addDays(date, 6), "12:00", tz), tz, "d MMM")}`
      : formatInTimeZone(zonedToDate(date, "12:00", tz), tz, "EEEE d MMMM");

  return (
    <div>
      <PageHeader
        eyebrow={s.salon.area ?? s.salon.name}
        title={label}
        subtitle={s.isAll ? "Showing the flagship studio. Pick a studio in the sidebar to see its calendar." : view === "week" ? `Week for ${cal.staff.find((x) => x.id === cal.focus)?.name ?? "therapist"}` : `${cal.columns.length} therapists`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {s.role !== "stylist" && (
              <div className="flex rounded-full border border-line bg-white/70 p-1 text-sm" role="group" aria-label="View">
                <Link href={q({ view: "day" })} aria-current={view === "day" ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${view === "day" ? "bg-charcoal text-ivory" : "text-stone hover:text-charcoal"}`}>Day</Link>
                <Link href={q({ view: "week" })} aria-current={view === "week" ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${view === "week" ? "bg-charcoal text-ivory" : "text-stone hover:text-charcoal"}`}>Week</Link>
              </div>
            )}
            <ButtonLink variant="outline" href={q({ date: addDays(date, -step) })} aria-label="Previous"><ChevronLeft strokeWidth={1.5} /></ButtonLink>
            <ButtonLink variant="outline" href={q({ date: todayIn(tz) })}>Today</ButtonLink>
            <ButtonLink variant="outline" href={q({ date: addDays(date, step) })} aria-label="Next"><ChevronRight strokeWidth={1.5} /></ButtonLink>
            {s.role !== "stylist" && <ButtonLink href={`/dashboard/bookings/new?date=${date}`}>New booking</ButtonLink>}
          </div>
        }
      />
      {view === "week" && s.role !== "stylist" && (
        <nav aria-label="Therapist" className="-mt-3 mb-5 flex flex-wrap gap-2">
          {cal.staff.map((p) => (
            <Link key={p.id} href={q({ staff: p.id })} aria-current={cal.focus === p.id ? "page" : undefined} className={`min-h-9 rounded-full border px-3.5 py-1.5 text-sm ${cal.focus === p.id ? "border-charcoal bg-charcoal text-ivory" : "border-line text-stone hover:border-champagne hover:text-charcoal"}`}>
              {p.name}
            </Link>
          ))}
        </nav>
      )}
      {cal.columns.length ? (
        <CalendarBoard
          columns={cal.columns}
          events={cal.events}
          blocks={cal.blocks}
          startMin={cal.startMin}
          endMin={cal.endMin}
          interval={cal.interval}
          canMove={s.role !== "stylist" && !s.isAll}
        />
      ) : (
        <Card><p className="py-10 text-center text-sm text-stone">No active therapists yet. Add your team in Team &amp; hours.</p></Card>
      )}
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page(props: Parameters<typeof CalendarPage>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <CalendarPage {...props} />
    </Suspense>
  );
}

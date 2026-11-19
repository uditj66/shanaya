import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarPlus, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { requireArea } from "@/lib/session";
import { loadCalendar } from "@/lib/dashboard/calendar";
import { addDays, isDate, todayIn, zonedToDate } from "@/lib/time";
import { ButtonLink, Card, EmptyState, PageHeader, SegmentedNav } from "@/components/admin/kit";
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
    <div className="grid gap-6">
      <PageHeader
        eyebrow={s.salon.area ?? s.salon.name}
        title={label}
        description={
          s.isAll
            ? "Showing the flagship studio. Pick a studio in the sidebar to see its calendar."
            : view === "week"
              ? `Week for ${cal.staff.find((x) => x.id === cal.focus)?.name ?? "therapist"}`
              : `${cal.columns.length} therapists`
        }
        actions={
          <>
            {s.role !== "stylist" && (
              <SegmentedNav label="View" items={(["day", "week"] as const).map((v) => ({ href: q({ view: v }), label: v === "day" ? "Day" : "Week", active: view === v }))} />
            )}
            <div className="flex items-center gap-1">
              <ButtonLink variant="outline" size="icon" href={q({ date: addDays(date, -step) })} aria-label="Previous">
                <ChevronLeft aria-hidden />
              </ButtonLink>
              <ButtonLink variant="outline" href={q({ date: todayIn(tz) })}>
                Today
              </ButtonLink>
              <ButtonLink variant="outline" size="icon" href={q({ date: addDays(date, step) })} aria-label="Next">
                <ChevronRight aria-hidden />
              </ButtonLink>
            </div>
            {s.role !== "stylist" && (
              <ButtonLink href={`/dashboard/bookings/new?date=${date}`}>
                <CalendarPlus aria-hidden /> New booking
              </ButtonLink>
            )}
          </>
        }
      />
      {view === "week" && s.role !== "stylist" && (
        <nav aria-label="Therapist" className="-mt-6 flex flex-wrap gap-2">
          {cal.staff.map((p) => (
            <ButtonLink
              key={p.id}
              href={q({ staff: p.id })}
              aria-current={cal.focus === p.id ? "page" : undefined}
              variant={cal.focus === p.id ? "default" : "outline"}
              size="sm"
            >
              {p.name}
            </ButtonLink>
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
        <Card>
          <EmptyState icon={Users} title="No active therapists yet" description="Add your team in Team & hours." />
        </Card>
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
